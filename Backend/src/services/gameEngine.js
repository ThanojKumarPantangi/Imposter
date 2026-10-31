import { v4 as uuidv4 } from 'uuid';
import roomRepository from '../redis/roomRepository.js';
import Category from '../models/Category.js';
import GameHistory from '../models/GameHistory.js';
import Guest from '../models/Guest.js';

class GameEngine {
  /**
   * Generate an uppercase 4-letter room code (e.g. "KXZR")
   */
  generateRoomCode() {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    let code = '';
    for (let i = 0; i < 4; i++) {
      code += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return code;
  }

  /**
   * Create a new room in Redis
   */
  async createRoom(hostPlayer, options = {}) {
    let roomCode = this.generateRoomCode();
    let attempts = 0;
    while (await roomRepository.getRoom(roomCode) && attempts < 10) {
      roomCode = this.generateRoomCode();
      attempts++;
    }

    const room = {
      code: roomCode,
      hostId: hostPlayer.id,
      status: 'WAITING',
      settings: {
        categorySlug: options.categorySlug || 'fruits',
        categoryName: options.categoryName || 'Fruits',
        impostersCount: options.impostersCount || 1,
        turnDurationSeconds: options.turnDurationSeconds || 30,
        votingDurationSeconds: options.votingDurationSeconds || 45,
        lobbyDisconnectTimeout: options.lobbyDisconnectTimeout || 5,
        maxPlayers: options.maxPlayers || 20
      },
      players: [
        {
          id: hostPlayer.id,
          username: hostPlayer.username,
          avatar: hostPlayer.avatar || 'avatar-1',
          isHost: true,
          isConnected: true,
          isAlive: true,
          role: null,
          secretWord: null,
          hint: null,
          clues: []
        }
      ],
      currentRound: 1,
      turnOrder: [],
      activeTurnIndex: 0,
      activeTurnPlayerId: null,
      turnDeadline: null,
      secretWord: null,
      hint: null,
      clueHistory: [],
      votes: {},
      votingDeadline: null,
      eliminationResult: null,
      winnerResult: null,
      createdAt: Date.now()
    };

    await roomRepository.saveRoom(roomCode, room);
    await roomRepository.setPlayerRoomMapping(hostPlayer.id, roomCode);

    return room;
  }

  /**
   * Player joins an existing room
   */
  async joinRoom(roomCode, player) {
    const room = await roomRepository.getRoom(roomCode);
    if (!room) {
      throw new Error('Room not found with code ' + roomCode);
    }

    if (room.status !== 'WAITING') {
      const existingPlayer = room.players.find(p => p.id === player.id);
      if (!existingPlayer) {
        throw new Error('Game is already in progress and you are not a participant in this room');
      }
      existingPlayer.isConnected = true;
      await roomRepository.saveRoom(roomCode, room);
      await roomRepository.setPlayerRoomMapping(player.id, roomCode);
      return room;
    }

    if (room.players.length >= room.settings.maxPlayers) {
      throw new Error('Room has reached maximum capacity');
    }

    let existing = room.players.find(p => p.id === player.id);
    if (existing) {
      existing.isConnected = true;
      existing.username = player.username;
      existing.avatar = player.avatar || existing.avatar;
    } else {
      room.players.push({
        id: player.id,
        username: player.username,
        avatar: player.avatar || `avatar-${Math.floor(1 + Math.random() * 8)}`,
        isHost: false,
        isConnected: true,
        isAlive: true,
        role: null,
        secretWord: null,
        hint: null,
        clues: []
      });
    }

    await roomRepository.saveRoom(roomCode, room);
    await roomRepository.setPlayerRoomMapping(player.id, roomCode);

    return room;
  }

  /**
   * Update Room Settings (Host only)
   */
  async updateSettings(roomCode, hostId, newSettings) {
    const room = await roomRepository.getRoom(roomCode);
    if (!room) throw new Error('Room not found');
    if (room.hostId !== hostId) throw new Error('Only the room host can modify settings');
    if (room.status !== 'WAITING') throw new Error('Settings can only be changed in the lobby');

    if (newSettings.categorySlug) room.settings.categorySlug = newSettings.categorySlug;
    if (newSettings.categoryName) room.settings.categoryName = newSettings.categoryName;
    if (newSettings.impostersCount) {
      const impCount = Math.max(1, Math.min(parseInt(newSettings.impostersCount, 10), Math.floor((room.players.length || 3) / 2)));
      room.settings.impostersCount = impCount;
    }
    if (newSettings.turnDurationSeconds) room.settings.turnDurationSeconds = parseInt(newSettings.turnDurationSeconds, 10);
    if (newSettings.votingDurationSeconds) room.settings.votingDurationSeconds = parseInt(newSettings.votingDurationSeconds, 10);
    if (newSettings.lobbyDisconnectTimeout) {
      const allowed = [3, 5, 10, 15, 30];
      const t = parseInt(newSettings.lobbyDisconnectTimeout, 10);
      if (allowed.includes(t)) {
        room.settings.lobbyDisconnectTimeout = t;
      }
    }

    await roomRepository.saveRoom(roomCode, room);
    return room;
  }

  /**
   * Host kicks/removes a player
   */
  async removePlayerByHost(roomCode, hostId, targetPlayerId) {
    const room = await roomRepository.getRoom(roomCode);
    if (!room) throw new Error('Room not found');
    if (room.hostId !== hostId) throw new Error('Only the room host can remove players');
    if (hostId === targetPlayerId) throw new Error('Host cannot kick themselves');

    const index = room.players.findIndex(p => p.id === targetPlayerId);
    if (index === -1) throw new Error('Player not found in this room');

    const removedPlayer = room.players.splice(index, 1)[0];

    await roomRepository.removePlayerRoomMapping(targetPlayerId);
    await roomRepository.clearLobbyDisconnectTimer(roomCode, targetPlayerId);

    if (room.status !== 'WAITING' && room.status !== 'FINISHED') {
      await this.evaluateDepartureVictory(room, removedPlayer);
    }

    await roomRepository.saveRoom(roomCode, room);
    return { room, removedPlayer };
  }

  /**
   * Check if Start Game is ready
   */
  canStartGame(room) {
    if (!room || room.status !== 'WAITING') return { ready: false, reason: 'Game not in lobby state' };
    if (room.players.length < 3) return { ready: false, reason: 'Minimum 3 players required to start' };
    
    const disconnected = room.players.filter(p => !p.isConnected);
    if (disconnected.length > 0) {
      return {
        ready: false,
        reason: `Cannot start while player "${disconnected[0].username}" is temporarily disconnected`,
        disconnectedPlayer: disconnected[0]
      };
    }

    const impCount = room.settings.impostersCount || 1;
    if (room.players.length <= impCount + 1) {
      return { ready: false, reason: 'Need more Civilians than Imposters' };
    }

    return { ready: true };
  }

  /**
   * Start Game
   */
  async startGame(roomCode, hostId) {
    const room = await roomRepository.getRoom(roomCode);
    if (!room) throw new Error('Room not found');
    if (room.hostId !== hostId) throw new Error('Only the room host can start the game');

    const readiness = this.canStartGame(room);
    if (!readiness.ready) {
      throw new Error(readiness.reason);
    }

    const category = await Category.findOne({
      $or: [
        { slug: room.settings.categorySlug },
        { id: room.settings.categorySlug },
        { name: room.settings.categoryName }
      ]
    });

    let selectedWord = 'Apple';
    let selectedHint = 'Crisp fruit, often red or green';

    if (category && category.words && category.words.length > 0) {
      const activeWords = category.words.filter(w => w.enabled !== false);
      const chosen = activeWords[Math.floor(Math.random() * activeWords.length)];
      selectedWord = chosen.word;
      selectedHint = chosen.hint;
      room.settings.categoryName = category.name;
    }

    room.secretWord = selectedWord;
    room.hint = selectedHint;

    const playerCount = room.players.length;
    const imposterTarget = Math.min(room.settings.impostersCount || 1, Math.floor(playerCount / 2));
    
    const indices = Array.from({ length: playerCount }, (_, i) => i);
    for (let i = indices.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [indices[i], indices[j]] = [indices[j], indices[i]];
    }

    const imposterIndices = new Set(indices.slice(0, imposterTarget));

    room.players.forEach((player, idx) => {
      player.isAlive = true;
      player.clues = [];
      if (imposterIndices.has(idx)) {
        player.role = 'IMPOSTER';
        player.hint = selectedHint;
        player.secretWord = null;
      } else {
        player.role = 'CIVILIAN';
        player.secretWord = selectedWord;
        player.hint = selectedHint;
      }
    });

    room.status = 'ROLE_REVEAL';
    room.currentRound = 1;
    room.clueHistory = [];
    room.votes = {};
    room.eliminationResult = null;
    room.winnerResult = null;

    await roomRepository.saveRoom(roomCode, room);
    return room;
  }

  /**
   * Transition from ROLE_REVEAL to CLUE_ROUND
   */
  async startClueRound(roomCode) {
    const room = await roomRepository.getRoom(roomCode);
    if (!room) return null;

    const livingPlayers = room.players.filter(p => p.isAlive);
    if (livingPlayers.length === 0) return room;

    room.turnOrder = livingPlayers.map(p => p.id);
    room.activeTurnIndex = 0;
    room.activeTurnPlayerId = room.turnOrder[0];
    room.turnDeadline = Date.now() + (room.settings.turnDurationSeconds * 1000);
    room.status = 'CLUE_ROUND';

    await roomRepository.saveRoom(roomCode, room);
    return room;
  }

  /**
   * Submit Clue or Imposter Word Guess
   */
  async submitClueOrGuess(roomCode, playerId, clueText) {
    const room = await roomRepository.getRoom(roomCode);
    if (!room) throw new Error('Room not found');
    if (room.status !== 'CLUE_ROUND') throw new Error('Not currently in clue submission phase');
    if (room.activeTurnPlayerId !== playerId) throw new Error('It is not your turn');

    const player = room.players.find(p => p.id === playerId);
    if (!player || !player.isAlive) throw new Error('Active player not eligible');

    const cleanClue = (clueText || '').trim();
    if (!cleanClue) throw new Error('Clue cannot be empty');

    const isDuplicate = room.clueHistory.some(c => c.clue.toLowerCase() === cleanClue.toLowerCase());
    if (isDuplicate) throw new Error('This word has already been entered in this game. Choose another related word.');

    if (player.role === 'CIVILIAN') {
      if (cleanClue.toLowerCase() === room.secretWord.toLowerCase()) {
        throw new Error('Civilians cannot submit the exact secret word!');
      }
    }

    if (player.role === 'IMPOSTER') {
      if (cleanClue.toLowerCase() === room.secretWord.toLowerCase()) {
        room.clueHistory.push({
          playerId: player.id,
          username: player.username,
          clue: cleanClue,
          round: room.currentRound,
          timestamp: Date.now(),
          isWinningGuess: true
        });

        return await this.endGameWithWinner(room, 'IMPOSTER', 'IMPOSTER_GUESSED_WORD');
      }
    }

    player.clues.push(cleanClue);
    room.clueHistory.push({
      playerId: player.id,
      username: player.username,
      clue: cleanClue,
      round: room.currentRound,
      timestamp: Date.now()
    });

    room.activeTurnIndex += 1;
    if (room.activeTurnIndex < room.turnOrder.length) {
      room.activeTurnPlayerId = room.turnOrder[room.activeTurnIndex];
      room.turnDeadline = Date.now() + (room.settings.turnDurationSeconds * 1000);
      await roomRepository.saveRoom(roomCode, room);
      return { room, phaseChanged: false };
    }

    room.status = 'VOTING';
    room.activeTurnPlayerId = null;
    room.turnDeadline = null;
    room.votes = {};
    room.votingDeadline = Date.now() + (room.settings.votingDurationSeconds * 1000);

    await roomRepository.saveRoom(roomCode, room);
    return { room, phaseChanged: true };
  }

  /**
   * Submit Vote during VOTING phase
   */
  async submitVote(roomCode, voterId, targetPlayerId) {
    const room = await roomRepository.getRoom(roomCode);
    if (!room) throw new Error('Room not found');
    if (room.status !== 'VOTING') throw new Error('Not currently in voting phase');

    const voter = room.players.find(p => p.id === voterId);
    if (!voter || !voter.isAlive) throw new Error('Only living players can vote');

    const target = room.players.find(p => p.id === targetPlayerId);
    if (!target || !target.isAlive) throw new Error('Vote target must be an active living player');

    if (voterId === targetPlayerId) throw new Error('You cannot vote for yourself');

    room.votes[voterId] = targetPlayerId;

    const livingCount = room.players.filter(p => p.isAlive).length;
    const votesCount = Object.keys(room.votes).length;

    await roomRepository.saveRoom(roomCode, room);

    if (votesCount >= livingCount) {
      return await this.tallyVotesAndProcessElimination(roomCode);
    }

    return { room, finishedVoting: false };
  }

  /**
   * Tally votes
   */
  async tallyVotesAndProcessElimination(roomCode) {
    const room = await roomRepository.getRoom(roomCode);
    if (!room) return null;

    const voteCounts = {};
    for (const [voterId, targetId] of Object.entries(room.votes)) {
      voteCounts[targetId] = (voteCounts[targetId] || 0) + 1;
    }

    let maxVotes = 0;
    let eliminatedPlayerId = null;
    let isTie = false;

    for (const [playerId, count] of Object.entries(voteCounts)) {
      if (count > maxVotes) {
        maxVotes = count;
        eliminatedPlayerId = playerId;
        isTie = false;
      } else if (count === maxVotes) {
        isTie = true;
      }
    }

    let eliminatedPlayer = null;
    if (eliminatedPlayerId && !isTie) {
      eliminatedPlayer = room.players.find(p => p.id === eliminatedPlayerId);
      if (eliminatedPlayer) {
        eliminatedPlayer.isAlive = false;
        eliminatedPlayer.eliminatedAtRound = room.currentRound;
      }
    }

    room.eliminationResult = {
      eliminatedPlayer: eliminatedPlayer ? {
        id: eliminatedPlayer.id,
        username: eliminatedPlayer.username,
        role: eliminatedPlayer.role
      } : null,
      wasTie: isTie,
      voteCounts,
      round: room.currentRound
    };

    room.status = 'RESULTS';

    const livingImposters = room.players.filter(p => p.isAlive && p.role === 'IMPOSTER');
    const livingCivilians = room.players.filter(p => p.isAlive && p.role === 'CIVILIAN');

    if (livingImposters.length === 0) {
      return await this.endGameWithWinner(room, 'CIVILIAN', 'ALL_IMPOSTERS_ELIMINATED');
    }

    const totalLiving = livingImposters.length + livingCivilians.length;
    if (totalLiving <= 2) {
      if (livingImposters.length >= livingCivilians.length) {
        return await this.endGameWithWinner(room, 'IMPOSTER', 'FINAL_SHOWDOWN_DECISIVE');
      }
    } else if (totalLiving === 3 && eliminatedPlayer && eliminatedPlayer.role === 'CIVILIAN') {
      return await this.endGameWithWinner(room, 'IMPOSTER', 'FINAL_SHOWDOWN_DECISIVE');
    }

    if (livingImposters.length >= livingCivilians.length) {
      return await this.endGameWithWinner(room, 'IMPOSTER', 'IMPOSTERS_PARITY');
    }

    room.currentRound += 1;
    await roomRepository.saveRoom(roomCode, room);

    return { room, finishedVoting: true, gameOver: false };
  }

  /**
   * Evaluate departure victory
   */
  async evaluateDepartureVictory(room, departedPlayer) {
    if (!departedPlayer.isAlive) return;

    const livingImposters = room.players.filter(p => p.isAlive && p.role === 'IMPOSTER');
    const livingCivilians = room.players.filter(p => p.isAlive && p.role === 'CIVILIAN');

    if (livingImposters.length === 0) {
      await this.endGameWithWinner(room, 'CIVILIAN', 'PERMANENT_DEPARTURE');
      return;
    }

    if (departedPlayer.role === 'CIVILIAN' && (livingCivilians.length + livingImposters.length) <= 2) {
      await this.endGameWithWinner(room, 'IMPOSTER', 'PERMANENT_DEPARTURE');
      return;
    }

    if (livingImposters.length >= livingCivilians.length) {
      await this.endGameWithWinner(room, 'IMPOSTER', 'PERMANENT_DEPARTURE');
    }
  }

  /**
   * Finalize Game
   */
  async endGameWithWinner(room, winnerRole, winCondition) {
    room.status = 'FINISHED';
    const impostersList = room.players.filter(p => p.role === 'IMPOSTER').map(p => ({
      id: p.id,
      username: p.username
    }));

    room.winnerResult = {
      winnerRole,
      winCondition,
      secretWord: room.secretWord,
      hint: room.hint,
      imposters: impostersList
    };

    await roomRepository.saveRoom(room.code, room);

    try {
      const historyRecord = new GameHistory({
        roomCode: room.code,
        hostId: room.hostId,
        categoryName: room.settings.categoryName,
        secretWord: room.secretWord,
        hint: room.hint,
        winnerRole,
        winCondition,
        impostersCount: impostersList.length,
        roundsCount: room.currentRound,
        players: room.players.map(p => ({
          playerId: p.id,
          username: p.username,
          role: p.role,
          isWinner: p.role === winnerRole,
          isAlive: p.isAlive,
          eliminatedAtRound: p.eliminatedAtRound || null,
          clues: p.clues,
          votesReceived: (room.eliminationResult && room.eliminationResult.voteCounts && room.eliminationResult.voteCounts[p.id]) || 0
        }))
      });
      await historyRecord.save();

      for (const p of room.players) {
        const isWinner = p.role === winnerRole;
        await Guest.findByIdAndUpdate(p.id, {
          $inc: {
            'stats.gamesPlayed': 1,
            'stats.wins': isWinner ? 1 : 0,
            'stats.civilianWins': isWinner && p.role === 'CIVILIAN' ? 1 : 0,
            'stats.imposterWins': isWinner && p.role === 'IMPOSTER' ? 1 : 0,
            'stats.cluesGiven': (p.clues || []).length
          }
        });
      }
      console.log(`💾 [GameEngine] Stored completed match in MongoDB for room ${room.code}`);
    } catch (err) {
      console.error('Error saving game history to MongoDB:', err);
    }

    return { room, gameOver: true, winnerResult: room.winnerResult };
  }

  /**
   * Sanitize room state
   */
  sanitizeRoomForPlayer(room, playerId) {
    if (!room) return null;
    const cloned = JSON.parse(JSON.stringify(room));
    const isFinished = cloned.status === 'FINISHED';

    cloned.players = cloned.players.map(p => {
      const isSelf = p.id === playerId;
      return {
        id: p.id,
        username: p.username,
        avatar: p.avatar,
        isHost: p.isHost,
        isConnected: p.isConnected,
        isAlive: p.isAlive,
        role: (isSelf || isFinished) ? p.role : null,
        clues: p.clues
      };
    });

    const player = room.players.find(p => p.id === playerId);
    if (player && !isFinished) {
      if (player.role === 'IMPOSTER') {
        cloned.secretWord = null;
        cloned.myRole = 'IMPOSTER';
        cloned.myHint = room.hint;
        cloned.myWord = null;
      } else if (player.role === 'CIVILIAN') {
        cloned.secretWord = room.secretWord;
        cloned.myRole = 'CIVILIAN';
        cloned.myWord = room.secretWord;
        cloned.myHint = room.hint;
      }
    } else if (isFinished) {
      cloned.secretWord = room.secretWord;
    }

    return cloned;
  }
}

const gameEngine = new GameEngine();
export default gameEngine;
