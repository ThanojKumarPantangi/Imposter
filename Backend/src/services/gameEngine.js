import crypto from 'crypto';
import mongoose from 'mongoose';
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
      code += chars.charAt(crypto.randomInt(0, chars.length));
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

    const categorySlugs = Array.isArray(options.categorySlugs) && options.categorySlugs.length > 0
      ? options.categorySlugs
      : (options.categorySlug ? [options.categorySlug] : ['fruits']);

    const categoryNames = Array.isArray(options.categoryNames) && options.categoryNames.length > 0
      ? options.categoryNames
      : (options.categoryName ? [options.categoryName] : ['Fruits']);

    const room = {
      code: roomCode,
      hostId: hostPlayer.id,
      status: 'WAITING',
      settings: {
        categorySlugs,
        categoryNames,
        selectedCategories: categorySlugs,
        categorySlug: categorySlugs[0],
        categoryName: categoryNames.join(', '),
        impostersCount: options.impostersCount || 1,
        turnDurationSeconds: options.turnDurationSeconds || 30,
        votingDurationSeconds: options.votingDurationSeconds || 45,
        lobbyDisconnectTimeout: options.lobbyDisconnectTimeout || 5,
        gameDisconnectGracePeriod: options.gameDisconnectGracePeriod || 30,
        maxPlayers: options.maxPlayers || 50
      },
      players: [
        {
          id: hostPlayer.id,
          username: hostPlayer.username,
          avatar: hostPlayer.avatar || 'avatar-1',
          isHost: true,
          isConnected: true,
          isAlive: true,
          permanentlyDeparted: false,
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
      lastImposters: [],
      createdAt: Date.now(),
      updatedAt: Date.now()
    };

    await roomRepository.saveRoom(roomCode, room);
    await roomRepository.setPlayerRoomMapping(hostPlayer.id, roomCode);

    return room;
  }

  /**
   * Player joins an existing room
   */
  async joinRoom(roomCode, player) {
    if (!roomCode) throw new Error('Room code is required');
    const normalizedCode = roomCode.toUpperCase();
    const room = await roomRepository.getRoom(normalizedCode);
    if (!room) {
      throw new Error('Room not found with code ' + normalizedCode);
    }

    if (room.status !== 'WAITING') {
      const existingPlayer = room.players.find(p => p.id === player.id);
      if (!existingPlayer) {
        throw new Error('Game is already in progress and you are not a participant in this room');
      }
      existingPlayer.isConnected = true;
      existingPlayer.permanentlyDeparted = false;
      await roomRepository.saveRoom(normalizedCode, room);
      await roomRepository.setPlayerRoomMapping(player.id, normalizedCode);
      return room;
    }

    if (room.players.length >= (room.settings.maxPlayers || 50)) {
      throw new Error('Room has reached maximum capacity');
    }

    let existing = room.players.find(p => p.id === player.id);
    if (existing) {
      existing.isConnected = true;
      existing.permanentlyDeparted = false;
      existing.username = player.username;
      existing.avatar = player.avatar || existing.avatar;
    } else {
      room.players.push({
        id: player.id,
        username: player.username,
        avatar: player.avatar || `avatar-${crypto.randomInt(1, 9)}`,
        isHost: false,
        isConnected: true,
        isAlive: true,
        permanentlyDeparted: false,
        role: null,
        secretWord: null,
        hint: null,
        clues: []
      });
    }

    await roomRepository.saveRoom(normalizedCode, room);
    await roomRepository.setPlayerRoomMapping(player.id, normalizedCode);

    return room;
  }

  /**
   * Update Room Settings (Host only - Authoritative global controls)
   */
  async updateSettings(roomCode, hostId, newSettings) {
    const room = await roomRepository.getRoom(roomCode);
    if (!room) throw new Error('Room not found');
    if (room.hostId !== hostId) throw new Error('Only the room host can modify settings');
    if (room.status !== 'WAITING') throw new Error('Settings can only be changed in the lobby');

    if (newSettings.categorySlugs && Array.isArray(newSettings.categorySlugs)) {
      if (newSettings.categorySlugs.length === 0) {
        throw new Error('At least one category must be selected');
      }
      const cleanSlugs = Array.from(new Set(newSettings.categorySlugs));
      room.settings.categorySlugs = cleanSlugs;
      room.settings.selectedCategories = cleanSlugs;
      room.settings.categorySlug = cleanSlugs[0];
      if (newSettings.categoryNames && Array.isArray(newSettings.categoryNames)) {
        room.settings.categoryNames = newSettings.categoryNames;
        room.settings.categoryName = newSettings.categoryNames.join(', ');
      }
    } else if (newSettings.categorySlug) {
      room.settings.categorySlug = newSettings.categorySlug;
      room.settings.categorySlugs = [newSettings.categorySlug];
      room.settings.selectedCategories = [newSettings.categorySlug];
      if (newSettings.categoryName) {
        room.settings.categoryName = newSettings.categoryName;
        room.settings.categoryNames = [newSettings.categoryName];
      }
    }

    if (newSettings.impostersCount !== undefined) {
      const impCount = Math.max(1, Math.min(parseInt(newSettings.impostersCount, 10), Math.max(1, Math.floor((room.players.length || 3) / 2))));
      room.settings.impostersCount = impCount;
    }
    if (newSettings.turnDurationSeconds !== undefined) {
      room.settings.turnDurationSeconds = parseInt(newSettings.turnDurationSeconds, 10);
    }
    if (newSettings.votingDurationSeconds !== undefined) {
      room.settings.votingDurationSeconds = parseInt(newSettings.votingDurationSeconds, 10);
    }
    if (newSettings.lobbyDisconnectTimeout !== undefined) {
      const allowed = [3, 5, 10, 15, 30];
      const t = parseInt(newSettings.lobbyDisconnectTimeout, 10);
      if (allowed.includes(t)) {
        room.settings.lobbyDisconnectTimeout = t;
      }
    }
    if (newSettings.gameDisconnectGracePeriod !== undefined) {
      room.settings.gameDisconnectGracePeriod = parseInt(newSettings.gameDisconnectGracePeriod, 10);
    }

    await roomRepository.saveRoom(roomCode, room);
    return room;
  }

  /**
   * Update Shared Room Categories (Any active player in lobby)
   */
  async updateRoomCategories(roomCode, playerId, categorySlugs, categoryNames = []) {
    if (!roomCode) throw new Error('Room code is required');
    const normalizedCode = roomCode.toUpperCase();
    const room = await roomRepository.getRoom(normalizedCode);
    if (!room) throw new Error('Room not found');

    if (room.status !== 'WAITING') {
      throw new Error('Categories can only be modified in the lobby before the match begins');
    }

    const player = room.players.find(p => p.id === playerId);
    if (!player || player.permanentlyDeparted) {
      throw new Error('Player is not an active member of this room');
    }

    if (!Array.isArray(categorySlugs) || categorySlugs.length === 0) {
      throw new Error('You must select at least one word category');
    }

    const cleanSlugs = Array.from(new Set(categorySlugs.map(s => String(s).trim()))).filter(Boolean);
    if (cleanSlugs.length === 0) {
      throw new Error('You must select at least one valid category');
    }

    const cleanNames = Array.isArray(categoryNames) && categoryNames.length === cleanSlugs.length
      ? categoryNames
      : cleanSlugs.map(s => s.charAt(0).toUpperCase() + s.slice(1).replace(/-/g, ' '));

    // Update the ONE authoritative shared room categories in Redis
    room.settings.categorySlugs = cleanSlugs;
    room.settings.selectedCategories = cleanSlugs;
    room.settings.categorySlug = cleanSlugs[0];
    room.settings.categoryNames = cleanNames;
    room.settings.categoryName = cleanNames.join(', ');

    await roomRepository.saveRoom(normalizedCode, room);
    return {
      room,
      player,
      categorySlugs: cleanSlugs,
      categoryNames: cleanNames,
      selectedCategories: cleanSlugs
    };
  }

  /**
   * Backward-compatible alias for updateRoomCategories
   */
  async updatePlayerCategories(roomCode, playerId, categorySlugs, categoryNames = []) {
    return this.updateRoomCategories(roomCode, playerId, categorySlugs, categoryNames);
  }

  /**
   * Host kicks/removes a player
   */
  async removePlayerByHost(roomCode, hostId, targetPlayerId) {
    const room = await roomRepository.getRoom(roomCode);
    if (!room) throw new Error('Room not found');
    if (room.hostId !== hostId) throw new Error('Only the room host can remove players');
    if (hostId === targetPlayerId) throw new Error('Host cannot kick themselves');

    return await this.leaveRoom(roomCode, targetPlayerId, true);
  }

  /**
   * Check if Start Game is ready
   */
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

    // Validate that at least one valid category is selected for the room
    const sharedSlugs = (room.settings && (room.settings.categorySlugs || room.settings.selectedCategories)) || [];
    if (!Array.isArray(sharedSlugs) || sharedSlugs.length === 0) {
      return {
        ready: false,
        reason: 'At least one word category must be selected for the room'
      };
    }

    return { ready: true };
  }

  /**
   * Retrieve eligible words pool for specified category slugs
   */
  async getWordsForCategories(slugs = ['fruits']) {
    const cleanSlugs = Array.isArray(slugs) && slugs.length > 0
      ? slugs
      : ['fruits'];

    let categories = [];
    if (mongoose.connection && mongoose.connection.readyState === 1) {
      try {
        categories = await Category.find({
          $or: [
            { slug: { $in: cleanSlugs } },
            { id: { $in: cleanSlugs } }
          ]
        }).maxTimeMS(3000);
      } catch (err) {
        console.warn('Could not query Category collection:', err.message);
      }
    }

    let words = [];
    categories.forEach(cat => {
      if (cat.words && cat.words.length > 0) {
        const active = cat.words.filter(w => w.enabled !== false);
        active.forEach(w => {
          words.push({
            word: w.word,
            hint: w.hint,
            categoryName: cat.name,
            categorySlug: cat.slug || cat.id
          });
        });
      }
    });

    // Fallback if no words found or offline / mock test mode
    if (words.length === 0) {
      const fallbackMap = {
        fruits: [
          { word: 'Apple', hint: 'Crisp fruit, often red or green', categoryName: 'Fruits' },
          { word: 'Banana', hint: 'Curved yellow fruit rich in potassium', categoryName: 'Fruits' },
          { word: 'Mango', hint: 'Tropical sweet stone fruit', categoryName: 'Fruits' }
        ],
        vegetables: [
          { word: 'Carrot', hint: 'Orange root vegetable loved by rabbits', categoryName: 'Vegetables' },
          { word: 'Broccoli', hint: 'Tree-like green vegetable with florets', categoryName: 'Vegetables' }
        ],
        animals: [
          { word: 'Elephant', hint: 'Largest living land animal with a trunk', categoryName: 'Animals & Pets' },
          { word: 'Dolphin', hint: 'Highly intelligent aquatic mammal', categoryName: 'Animals & Pets' }
        ],
        movies: [
          { word: 'Inception', hint: 'Dream heist thriller directed by Nolan', categoryName: 'Movies & Cinema' },
          { word: 'Titanic', hint: 'Epic romantic disaster film with a ship', categoryName: 'Movies & Cinema' }
        ],
        gaming: [
          { word: 'Minecraft', hint: 'Block-building sandbox survival game', categoryName: 'Video Games' },
          { word: 'Portal', hint: 'Physics puzzle game with a gun making portals', categoryName: 'Video Games' }
        ]
      };

      cleanSlugs.forEach(s => {
        const norm = (s || '').toLowerCase();
        if (fallbackMap[norm]) {
          words.push(...fallbackMap[norm]);
        }
      });

      if (words.length === 0) {
        words.push({
          word: 'Apple',
          hint: 'Crisp fruit, often red or green',
          categoryName: 'Fruits'
        });
      }
    }

    return words;
  }

  /**
   * Start Game with Multi-Category support and Fair Imposter Assignment
   */
  async startGame(roomCode, hostId) {
    const room = await roomRepository.getRoom(roomCode);
    if (!room) throw new Error('Room not found');
    if (room.hostId !== hostId) throw new Error('Only the room host can start the game');

    const readiness = this.canStartGame(room);
    if (!readiness.ready) {
      throw new Error(readiness.reason);
    }

    const playerCount = room.players.length;
    const imposterTarget = Math.min(room.settings.impostersCount || 1, Math.floor(playerCount / 2));

    // Fair Imposter Assignment:
    // Create candidate pool of indices. If playerCount > imposterTarget + 1 and previous imposters exist,
    // prefer selecting from non-previous imposters first to avoid repetition, while maintaining true randomness.
    const lastImposterIds = new Set(room.lastImposters || []);
    let eligibleIndices = Array.from({ length: playerCount }, (_, i) => i);

    // Shuffle indices with crypto unbiased Fisher-Yates
    for (let i = eligibleIndices.length - 1; i > 0; i--) {
      const j = crypto.randomInt(0, i + 1);
      [eligibleIndices[i], eligibleIndices[j]] = [eligibleIndices[j], eligibleIndices[i]];
    }

    if (lastImposterIds.size > 0 && playerCount > imposterTarget * 2) {
      const nonRecent = eligibleIndices.filter(idx => !lastImposterIds.has(room.players[idx].id));
      const recent = eligibleIndices.filter(idx => lastImposterIds.has(room.players[idx].id));
      eligibleIndices = [...nonRecent, ...recent];
    }

    const chosenImposterIndices = new Set(eligibleIndices.slice(0, imposterTarget));
    const newImposterIds = [];

    // Word selection: Draw word and hint from the SHARED room categories!
    const roomSlugs = (room.settings && (room.settings.categorySlugs || room.settings.selectedCategories)) || ['fruits'];
    const eligibleWords = await this.getWordsForCategories(roomSlugs);
    const chosenWordIndex = crypto.randomInt(0, eligibleWords.length);
    const chosenWordEntry = eligibleWords[chosenWordIndex];

    for (let idx = 0; idx < room.players.length; idx++) {
      const player = room.players[idx];
      player.isAlive = true;
      player.permanentlyDeparted = false;
      player.eliminatedAtRound = null;
      player.clues = [];

      if (chosenImposterIndices.has(idx)) {
        player.role = 'IMPOSTER';
        player.hint = chosenWordEntry.hint;
        player.secretWord = null;
        player.assignedSecretWord = chosenWordEntry.word;
        player.categoryName = chosenWordEntry.categoryName;
        newImposterIds.push(player.id);
      } else {
        player.role = 'CIVILIAN';
        player.secretWord = chosenWordEntry.word;
        player.assignedSecretWord = chosenWordEntry.word;
        player.hint = chosenWordEntry.hint;
        player.categoryName = chosenWordEntry.categoryName;
      }
    }

    room.secretWord = chosenWordEntry.word;
    room.hint = chosenWordEntry.hint;
    room.settings.categoryName = chosenWordEntry.categoryName;

    room.lastImposters = newImposterIds;
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
   * Transition from ROLE_REVEAL to CLUE_ROUND with randomized starting player
   */
  async startClueRound(roomCode) {
    const room = await roomRepository.getRoom(roomCode);
    if (!room) return null;

    const livingPlayers = room.players.filter(p => p.isAlive && !p.permanentlyDeparted);
    if (livingPlayers.length === 0) return room;

    // Random starting player selection (Unbiased, host not always first)
    const shuffledLiving = [...livingPlayers];
    for (let i = shuffledLiving.length - 1; i > 0; i--) {
      const j = crypto.randomInt(0, i + 1);
      [shuffledLiving[i], shuffledLiving[j]] = [shuffledLiving[j], shuffledLiving[i]];
    }

    room.turnOrder = shuffledLiving.map(p => p.id);
    room.activeTurnIndex = 0;
    room.activeTurnPlayerId = room.turnOrder[0];

    // Synchronize active word & hint to active player's categories for this turn
    const activePlayer = room.players.find(p => p.id === room.activeTurnPlayerId);
    if (activePlayer) {
      room.secretWord = activePlayer.secretWord || activePlayer.assignedSecretWord || room.secretWord;
      room.hint = activePlayer.hint || room.hint;
      room.settings.categoryName = activePlayer.categoryName || (room.settings && room.settings.categoryName);
    }

    room.turnDeadline = Date.now() + (room.settings.turnDurationSeconds * 1000);
    room.status = 'CLUE_ROUND';

    await roomRepository.setTurnTimer(roomCode, room.turnDeadline, room.settings.turnDurationSeconds);
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
    if (!player || !player.isAlive || player.permanentlyDeparted) {
      throw new Error('Active player not eligible');
    }

    const cleanClue = (clueText || '').trim();
    if (!cleanClue) throw new Error('Clue cannot be empty');

    const isDuplicate = room.clueHistory.some(c => c.clue && c.clue.toLowerCase() === cleanClue.toLowerCase());
    if (isDuplicate) {
      throw new Error('This word has already been entered in this game. Choose another related word.');
    }

    if (player.role === 'CIVILIAN') {
      const targetWord = player.secretWord || room.secretWord;
      if (targetWord && cleanClue.toLowerCase() === targetWord.toLowerCase()) {
        throw new Error('Civilians cannot submit the exact secret word!');
      }
    }

    if (player.role === 'IMPOSTER') {
      const targetWord = player.assignedSecretWord || room.secretWord;
      if (targetWord && cleanClue.toLowerCase() === targetWord.toLowerCase()) {
        room.clueHistory.push({
          playerId: player.id,
          username: player.username,
          clue: cleanClue,
          round: room.currentRound,
          skipped: false,
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
      skipped: false,
      timestamp: Date.now()
    });

    return await this.advanceTurnOrder(room);
  }

  /**
   * Authoritative Turn Timeout (Skipped turn)
   */
  async handleTurnTimeout(roomCode, activeTurnPlayerId, expectedTurnIndex) {
    const room = await roomRepository.getRoom(roomCode);
    if (!room) return null;
    if (room.status !== 'CLUE_ROUND') return null;
    if (room.activeTurnPlayerId !== activeTurnPlayerId) return null;
    if (room.activeTurnIndex !== expectedTurnIndex) return null;

    const player = room.players.find(p => p.id === activeTurnPlayerId);
    const username = player ? player.username : 'Player';

    // Record skipped clue
    room.clueHistory.push({
      playerId: activeTurnPlayerId,
      username: username,
      clue: null,
      skipped: true,
      round: room.currentRound,
      timestamp: Date.now()
    });

    console.log(`⏱️ [GameEngine] Turn expired for ${username} in ${roomCode}. Turn SKIPPED.`);
    return await this.advanceTurnOrder(room, { wasSkipped: true, skippedPlayer: player });
  }

  /**
   * Advance turn order to next living eligible player or transition to VOTING
   */
  async advanceTurnOrder(room, meta = {}) {
    room.activeTurnIndex += 1;

    // Find next eligible living player
    while (room.activeTurnIndex < room.turnOrder.length) {
      const nextPlayerId = room.turnOrder[room.activeTurnIndex];
      const p = room.players.find(x => x.id === nextPlayerId);
      if (p && p.isAlive && !p.permanentlyDeparted) {
        room.activeTurnPlayerId = nextPlayerId;

        // Synchronize active word & hint to next living player's turn
        room.secretWord = p.secretWord || p.assignedSecretWord || room.secretWord;
        room.hint = p.hint || room.hint;
        room.settings.categoryName = p.categoryName || (room.settings && room.settings.categoryName);

        room.turnDeadline = Date.now() + (room.settings.turnDurationSeconds * 1000);
        await roomRepository.setTurnTimer(room.code, room.turnDeadline, room.settings.turnDurationSeconds);
        await roomRepository.saveRoom(room.code, room);
        return { room, phaseChanged: false, wasSkipped: meta.wasSkipped, skippedPlayer: meta.skippedPlayer };
      }
      room.activeTurnIndex += 1;
    }

    // All living players have had their turn -> Transition to VOTING
    room.status = 'VOTING';
    room.activeTurnPlayerId = null;
    room.turnDeadline = null;
    room.votes = {};
    room.votingDeadline = Date.now() + (room.settings.votingDurationSeconds * 1000);
    await roomRepository.clearTurnTimer(room.code);

    await roomRepository.saveRoom(room.code, room);
    return { room, phaseChanged: true, wasSkipped: meta.wasSkipped, skippedPlayer: meta.skippedPlayer };
  }

  /**
   * Submit Vote during VOTING phase
   */
  async submitVote(roomCode, voterId, targetPlayerId) {
    const room = await roomRepository.getRoom(roomCode);
    if (!room) throw new Error('Room not found');
    if (room.status !== 'VOTING') throw new Error('Not currently in voting phase');

    const voter = room.players.find(p => p.id === voterId);
    if (!voter || !voter.isAlive || voter.permanentlyDeparted) {
      throw new Error('Only living players can vote');
    }

    const target = room.players.find(p => p.id === targetPlayerId);
    if (!target || !target.isAlive || target.permanentlyDeparted) {
      throw new Error('Vote target must be an active living player');
    }

    if (voterId === targetPlayerId) throw new Error('You cannot vote for yourself');

    room.votes[voterId] = targetPlayerId;

    const livingCount = room.players.filter(p => p.isAlive && !p.permanentlyDeparted).length;
    const votesCount = Object.keys(room.votes).length;

    await roomRepository.saveRoom(roomCode, room);

    if (votesCount >= livingCount) {
      return await this.tallyVotesAndProcessElimination(roomCode);
    }

    return { room, finishedVoting: false };
  }

  /**
   * Centralized Winner Resolution
   * Evaluates victory conditions strictly on currently LIVING, non-departed players.
   */
  evaluateWinner(room) {
    const livingCivilians = room.players.filter(p => p.isAlive && !p.permanentlyDeparted && p.role === 'CIVILIAN');
    const livingImposters = room.players.filter(p => p.isAlive && !p.permanentlyDeparted && p.role === 'IMPOSTER');

    // Rule 1: No living Imposters -> Civilians win immediately!
    if (livingImposters.length === 0) {
      return {
        gameOver: true,
        winnerRole: 'CIVILIAN',
        winCondition: 'ALL_IMPOSTERS_ELIMINATED'
      };
    }

    // Rule 2: No living Civilians -> Imposters win immediately!
    if (livingCivilians.length === 0) {
      return {
        gameOver: true,
        winnerRole: 'IMPOSTER',
        winCondition: 'ALL_CIVILIANS_ELIMINATED'
      };
    }

    // Rule 3: Imposters reach numerical parity or majority over Civilians
    // Examples: 1 Imposter vs 1 Civilian -> Imposters win!
    //           2 Imposters vs 2 Civilians -> Imposters win!
    //           2 Imposters vs 1 Civilian -> Imposters win!
    if (livingImposters.length >= livingCivilians.length) {
      return {
        gameOver: true,
        winnerRole: 'IMPOSTER',
        winCondition: 'IMPOSTERS_PARITY'
      };
    }

    // Rule 4: Final Showdown threshold (1 Imposter vs 2 Civilians = 3 living players)
    // The game MUST CONTINUE for another clue round and then decisive vote!
    if (livingImposters.length === 1 && livingCivilians.length === 2) {
      return {
        gameOver: false,
        isFinalShowdown: true
      };
    }

    // Rule 5: Any other case -> Continue normally
    return {
      gameOver: false,
      isFinalShowdown: false
    };
  }

  /**
   * Tally votes and process elimination with centralized victory evaluation
   */
  async tallyVotesAndProcessElimination(roomCode) {
    const room = await roomRepository.getRoom(roomCode);
    if (!room) return null;
    if (room.status === 'FINISHED') return { room, finishedVoting: true, gameOver: true, winnerResult: room.winnerResult };

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
      if (eliminatedPlayer && eliminatedPlayer.isAlive) {
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

    // Run Centralized Winner Resolution
    const winEvaluation = this.evaluateWinner(room);
    if (winEvaluation.gameOver) {
      return await this.endGameWithWinner(room, winEvaluation.winnerRole, winEvaluation.winCondition);
    }

    room.currentRound += 1;
    await roomRepository.saveRoom(roomCode, room);

    return { room, finishedVoting: true, gameOver: false, isFinalShowdown: winEvaluation.isFinalShowdown };
  }

  /**
   * Centralized Player Departure (Intentional leave or Grace Period Expiration)
   */
  async leaveRoom(roomCode, playerId, isKick = false) {
    if (!roomCode || !playerId) return null;
    const normalizedCode = roomCode.toUpperCase();
    const room = await roomRepository.getRoom(normalizedCode);
    if (!room) {
      await roomRepository.removePlayerRoomMapping(playerId);
      return { roomDeleted: true };
    }

    const playerIndex = room.players.findIndex(p => p.id === playerId);
    if (playerIndex === -1) {
      await roomRepository.removePlayerRoomMapping(playerId);
      return { room, departedPlayer: null };
    }

    const departedPlayer = room.players[playerIndex];
    await roomRepository.removePlayerRoomMapping(playerId);
    await roomRepository.clearLobbyDisconnectTimer(normalizedCode, playerId);
    await roomRepository.clearGameDisconnectTimer(normalizedCode, playerId);

    // 1. In WAITING (Lobby) phase
    if (room.status === 'WAITING') {
      room.players.splice(playerIndex, 1);
      if (room.playerCategoryPreferences && room.playerCategoryPreferences[playerId]) {
        delete room.playerCategoryPreferences[playerId];
      }

      if (room.players.length === 0) {
        await roomRepository.deleteRoom(normalizedCode);
        return { roomDeleted: true, departedPlayer };
      }

      // Transfer host if departed player was host
      if (departedPlayer.isHost && room.players.length > 0) {
        room.players[0].isHost = true;
        room.hostId = room.players[0].id;
      }

      await roomRepository.saveRoom(normalizedCode, room);
      return { room, departedPlayer, roomDeleted: false };
    }

    // 2. In Active Game phase
    if (room.status !== 'FINISHED') {
      const wasLiving = departedPlayer.isAlive && !departedPlayer.permanentlyDeparted;
      departedPlayer.permanentlyDeparted = true;
      departedPlayer.isAlive = false;
      departedPlayer.isConnected = false;

      // Eliminated spectators leaving do NOT affect living player counts or victory
      if (!wasLiving) {
        const remainingActive = room.players.filter(p => !p.permanentlyDeparted);
        if (remainingActive.length === 0) {
          await roomRepository.deleteRoom(normalizedCode);
          return { roomDeleted: true, departedPlayer };
        }
        await roomRepository.saveRoom(normalizedCode, room);
        return { room, departedPlayer, roomDeleted: false };
      }

      // Living player departed:
      // If currently their turn in CLUE_ROUND, advance turn
      if (room.status === 'CLUE_ROUND' && room.activeTurnPlayerId === playerId) {
        await this.advanceTurnOrder(room, { wasSkipped: true, skippedPlayer: departedPlayer });
      }

      // Re-evaluate victory conditions with centralized rules
      const winEval = this.evaluateWinner(room);
      if (winEval.gameOver) {
        const endResult = await this.endGameWithWinner(room, winEval.winnerRole, winEval.winCondition);
        return { ...endResult, departedPlayer, roomDeleted: false };
      }

      const remainingActive = room.players.filter(p => !p.permanentlyDeparted);
      if (remainingActive.length === 0) {
        await roomRepository.deleteRoom(normalizedCode);
        return { roomDeleted: true, departedPlayer };
      }

      await roomRepository.saveRoom(normalizedCode, room);
      return { room, departedPlayer, roomDeleted: false };
    }

    // 3. In FINISHED phase
    departedPlayer.permanentlyDeparted = true;
    departedPlayer.isConnected = false;
    const remainingActive = room.players.filter(p => !p.permanentlyDeparted);
    if (remainingActive.length === 0) {
      await roomRepository.deleteRoom(normalizedCode);
      return { roomDeleted: true, departedPlayer };
    }

    await roomRepository.saveRoom(normalizedCode, room);
    return { room, departedPlayer, roomDeleted: false };
  }

  /**
   * Return to Lobby (Preserves room code, host, settings, and active members)
   */
  async returnToLobby(roomCode, playerId) {
    if (!roomCode) throw new Error('Room code is required');
    const normalizedCode = roomCode.toUpperCase();
    const room = await roomRepository.getRoom(normalizedCode);
    if (!room) throw new Error('Room not found or expired');

    if (room.status !== 'FINISHED' && room.status !== 'WAITING') {
      throw new Error('Game is still in progress');
    }

    // Only keep players who have not permanently departed
    room.players = room.players.filter(p => !p.permanentlyDeparted);
    if (room.players.length === 0) {
      await roomRepository.deleteRoom(normalizedCode);
      throw new Error('Room has no remaining members');
    }

    // Reset player active in-game fields
    room.players.forEach(p => {
      p.isAlive = true;
      p.role = null;
      p.secretWord = null;
      p.hint = null;
      p.clues = [];
      p.eliminatedAtRound = null;
      p.permanentlyDeparted = false;
    });

    // Ensure valid host
    const hostExists = room.players.some(p => p.id === room.hostId);
    if (!hostExists && room.players.length > 0) {
      room.players[0].isHost = true;
      room.hostId = room.players[0].id;
    }

    // Reset match fields to WAITING
    room.status = 'WAITING';
    room.currentRound = 1;
    room.turnOrder = [];
    room.activeTurnIndex = 0;
    room.activeTurnPlayerId = null;
    room.turnDeadline = null;
    room.secretWord = null;
    room.hint = null;
    room.clueHistory = [];
    room.votes = {};
    room.votingDeadline = null;
    room.eliminationResult = null;
    room.winnerResult = null;

    await roomRepository.clearTurnTimer(normalizedCode);
    await roomRepository.saveRoom(normalizedCode, room);

    return room;
  }

  /**
   * Finalize Game and persist to MongoDB
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

    await roomRepository.clearTurnTimer(room.code);
    await roomRepository.saveRoom(room.code, room);

    if (mongoose.connection && mongoose.connection.readyState === 1) {
      try {
        const historyRecord = new GameHistory({
          roomCode: room.code,
          hostId: room.hostId || (room.players && room.players[0] && room.players[0].id) || 'system',
          categoryName: (room.settings && room.settings.categoryName) || 'General',
          secretWord: room.secretWord || 'Word',
          hint: room.hint || 'Hint',
          winnerRole,
          winCondition,
          impostersCount: impostersList.length,
          roundsCount: room.currentRound || 1,
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
        console.error('Error saving game history to MongoDB:', err.message);
      }
    }

    return { room, gameOver: true, winnerResult: room.winnerResult };
  }

  /**
   * Sanitize room state for private client view
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
        permanentlyDeparted: p.permanentlyDeparted,
        role: (isSelf || isFinished) ? p.role : null,
        clues: p.clues
      };
    });

    const player = room.players.find(p => p.id === playerId);
    if (player) {
      if (!isFinished) {
        if (player.role === 'IMPOSTER') {
          cloned.secretWord = null;
          cloned.myRole = 'IMPOSTER';
          cloned.myHint = player.hint || room.hint;
          cloned.myWord = null;
        } else if (player.role === 'CIVILIAN') {
          cloned.secretWord = player.secretWord || room.secretWord;
          cloned.myRole = 'CIVILIAN';
          cloned.myWord = player.secretWord || room.secretWord;
          cloned.myHint = player.hint || room.hint;
        }
      } else {
        cloned.secretWord = room.secretWord;
      }
    } else if (isFinished) {
      cloned.secretWord = room.secretWord;
    }

    // Authoritative shared room categories
    if (cloned.settings) {
      const slugs = cloned.settings.categorySlugs || cloned.settings.selectedCategories || ['fruits'];
      cloned.settings.categorySlugs = slugs;
      cloned.settings.selectedCategories = slugs;
      cloned.settings.categoryNames = cloned.settings.categoryNames || ['Fruits'];
    }

    // Backward compatibility aliases
    cloned.myCategorySlugs = (cloned.settings && cloned.settings.categorySlugs) || ['fruits'];
    cloned.myCategoryNames = (cloned.settings && cloned.settings.categoryNames) || ['Fruits'];
    delete cloned.playerCategoryPreferences;

    return cloned;
  }
}

const gameEngine = new GameEngine();
export default gameEngine;
