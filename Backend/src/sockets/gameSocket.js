import gameEngine from '../services/gameEngine.js';
import roomRepository from '../redis/roomRepository.js';

/**
 * Socket.IO Game & Voice Signaling Controller
 */
export function registerGameSocket(io) {
  // Support both /game namespace and root / namespace
  const gameNamespace = io.of('/game');
  setupNamespace(gameNamespace);
  setupNamespace(io.of('/'));
}

function setupNamespace(nsp) {
  nsp.on('connection', (socket) => {
    // 1. Join Room
    socket.on('join_room', async (data) => {
      try {
        const { roomCode, player } = data || {};
        if (!roomCode || !player || !player.id) {
          return socket.emit('error', { message: 'Invalid room join payload' });
        }

        const normalizedCode = roomCode.toUpperCase();
        const room = await gameEngine.joinRoom(normalizedCode, player);

        socket.join(`room:${normalizedCode}`);
        await roomRepository.mapSocketToPlayer(socket.id, player.id);

        await roomRepository.clearLobbyDisconnectTimer(normalizedCode, player.id);

        console.log(`🔌 [Socket] Player "${player.username}" (${player.id}) joined room ${normalizedCode}`);

        await broadcastPersonalizedRoomState(nsp, normalizedCode);

        nsp.to(`room:${normalizedCode}`).emit('player_connected', {
          playerId: player.id,
          username: player.username
        });
      } catch (err) {
        socket.emit('error', { message: err.message });
      }
    });

    // 2. Request Sync
    socket.on('request_sync', async ({ roomCode, playerId }) => {
      if (!roomCode) return;
      const normalizedCode = roomCode.toUpperCase();
      const room = await roomRepository.getRoom(normalizedCode);
      if (room) {
        const sanitized = gameEngine.sanitizeRoomForPlayer(room, playerId);
        socket.emit('room_state', sanitized);
      }
    });

    // 3. Update Settings (Host Only)
    socket.on('update_settings', async ({ roomCode, hostId, settings }) => {
      try {
        const normalizedCode = roomCode.toUpperCase();
        const room = await gameEngine.updateSettings(normalizedCode, hostId, settings);
        await broadcastPersonalizedRoomState(nsp, normalizedCode);
        nsp.to(`room:${normalizedCode}`).emit('settings_updated', room.settings);
      } catch (err) {
        socket.emit('error', { message: err.message });
      }
    });

    // 4. Update Username in Lobby
    socket.on('update_lobby_username', async ({ roomCode, playerId, newUsername }) => {
      try {
        const normalizedCode = roomCode.toUpperCase();
        const room = await roomRepository.getRoom(normalizedCode);
        if (room) {
          const p = room.players.find(x => x.id === playerId);
          if (p) {
            p.username = newUsername.trim().slice(0, 25);
            await roomRepository.saveRoom(normalizedCode, room);
            await broadcastPersonalizedRoomState(nsp, normalizedCode);
          }
        }
      } catch (err) {
        socket.emit('error', { message: err.message });
      }
    });

    // 5. Kick / Remove Player (Host Only)
    socket.on('kick_player', async ({ roomCode, hostId, targetPlayerId }) => {
      try {
        const normalizedCode = roomCode.toUpperCase();
        const { room, removedPlayer } = await gameEngine.removePlayerByHost(normalizedCode, hostId, targetPlayerId);

        const targetSocketId = await roomRepository.getSocketByPlayer(targetPlayerId);
        if (targetSocketId) {
          nsp.to(targetSocketId).emit('kicked_from_room', {
            roomCode: normalizedCode,
            reason: 'You were removed by the room host'
          });
          const targetSocket = nsp.sockets.get(targetSocketId);
          if (targetSocket) targetSocket.leave(`room:${normalizedCode}`);
        }

        nsp.to(`room:${normalizedCode}`).emit('player_kicked', {
          removedPlayerId: targetPlayerId,
          username: removedPlayer.username
        });
        await broadcastPersonalizedRoomState(nsp, normalizedCode);
      } catch (err) {
        socket.emit('error', { message: err.message });
      }
    });

    // 6. Start Game
    socket.on('start_game', async ({ roomCode, hostId }) => {
      try {
        const normalizedCode = roomCode.toUpperCase();
        const room = await gameEngine.startGame(normalizedCode, hostId);

        console.log(`🎮 [Game] Room ${normalizedCode} started! Word: "${room.secretWord}", Hint: "${room.hint}"`);

        await broadcastPersonalizedRoomState(nsp, normalizedCode);
        nsp.to(`room:${normalizedCode}`).emit('game_started', {
          status: 'ROLE_REVEAL',
          duration: 6
        });

        setTimeout(async () => {
          const currentRoom = await roomRepository.getRoom(normalizedCode);
          if (currentRoom && currentRoom.status === 'ROLE_REVEAL') {
            await gameEngine.startClueRound(normalizedCode);
            await broadcastPersonalizedRoomState(nsp, normalizedCode);
            nsp.to(`room:${normalizedCode}`).emit('clue_round_started', {
              round: currentRoom.currentRound
            });
          }
        }, 6000);
      } catch (err) {
        socket.emit('error', { message: err.message });
      }
    });

    // 7. Submit Clue or Imposter Secret-Word Guess
    socket.on('submit_clue', async ({ roomCode, playerId, clue }) => {
      try {
        const normalizedCode = roomCode.toUpperCase();
        const result = await gameEngine.submitClueOrGuess(normalizedCode, playerId, clue);

        if (result.gameOver) {
          await broadcastPersonalizedRoomState(nsp, normalizedCode);
          nsp.to(`room:${normalizedCode}`).emit('game_finished', result.winnerResult);
          return;
        }

        await broadcastPersonalizedRoomState(nsp, normalizedCode);

        if (result.phaseChanged && result.room.status === 'VOTING') {
          nsp.to(`room:${normalizedCode}`).emit('voting_phase_started', {
            votingDeadline: result.room.votingDeadline,
            duration: result.room.settings.votingDurationSeconds
          });

          const delay = (result.room.settings.votingDurationSeconds + 1) * 1000;
          setTimeout(async () => {
            const r = await roomRepository.getRoom(normalizedCode);
            if (r && r.status === 'VOTING') {
              const tallyResult = await gameEngine.tallyVotesAndProcessElimination(normalizedCode);
              await broadcastPersonalizedRoomState(nsp, normalizedCode);
              if (tallyResult.gameOver) {
                nsp.to(`room:${normalizedCode}`).emit('game_finished', tallyResult.winnerResult);
              } else {
                nsp.to(`room:${normalizedCode}`).emit('round_results', r.eliminationResult);
                scheduleNextRound(nsp, normalizedCode);
              }
            }
          }, delay);
        }
      } catch (err) {
        socket.emit('error', { message: err.message });
      }
    });

    // 8. Submit Vote
    socket.on('submit_vote', async ({ roomCode, voterId, targetPlayerId }) => {
      try {
        const normalizedCode = roomCode.toUpperCase();
        const result = await gameEngine.submitVote(normalizedCode, voterId, targetPlayerId);

        if (result.finishedVoting) {
          await broadcastPersonalizedRoomState(nsp, normalizedCode);
          if (result.gameOver) {
            nsp.to(`room:${normalizedCode}`).emit('game_finished', result.winnerResult);
          } else {
            nsp.to(`room:${normalizedCode}`).emit('round_results', result.room.eliminationResult);
            scheduleNextRound(nsp, normalizedCode);
          }
        } else {
          await broadcastPersonalizedRoomState(nsp, normalizedCode);
        }
      } catch (err) {
        socket.emit('error', { message: err.message });
      }
    });

    // 9. WebRTC Voice Chat Signaling
    socket.on('voice_signal_join', async ({ roomCode, playerId }) => {
      const normalizedCode = (roomCode || '').toUpperCase();
      socket.to(`room:${normalizedCode}`).emit('voice_peer_joined', {
        peerSocketId: socket.id,
        playerId
      });
    });

    socket.on('voice_signal_offer', ({ targetSocketId, offer, callerId }) => {
      nsp.to(targetSocketId).emit('voice_signal_offer', {
        callerSocketId: socket.id,
        callerId,
        offer
      });
    });

    socket.on('voice_signal_answer', ({ targetSocketId, answer, responderId }) => {
      nsp.to(targetSocketId).emit('voice_signal_answer', {
        responderSocketId: socket.id,
        responderId,
        answer
      });
    });

    socket.on('voice_signal_ice_candidate', ({ targetSocketId, candidate, senderId }) => {
      nsp.to(targetSocketId).emit('voice_signal_ice_candidate', {
        senderSocketId: socket.id,
        senderId,
        candidate
      });
    });

    socket.on('voice_mute_state', ({ roomCode, playerId, isMuted, isDeafened }) => {
      const normalizedCode = (roomCode || '').toUpperCase();
      nsp.to(`room:${normalizedCode}`).emit('voice_user_state_changed', {
        playerId,
        isMuted,
        isDeafened
      });
    });

    // 10. Disconnect Handler
    socket.on('disconnect', async () => {
      try {
        const playerId = await roomRepository.getPlayerBySocket(socket.id);
        if (!playerId) return;

        const roomCode = await roomRepository.getPlayerRoomMapping(playerId);
        if (!roomCode) return;

        const normalizedCode = roomCode.toUpperCase();
        const room = await roomRepository.getRoom(normalizedCode);
        if (!room) return;

        const player = room.players.find(p => p.id === playerId);
        if (!player) return;

        player.isConnected = false;
        await roomRepository.saveRoom(normalizedCode, room);
        await roomRepository.removeSocketMapping(socket.id);

        console.log(`⚠️ [Socket] Player "${player.username}" temporarily disconnected from ${normalizedCode}`);

        nsp.to(`room:${normalizedCode}`).emit('player_disconnected', {
          playerId,
          username: player.username,
          roomCode: normalizedCode
        });

        nsp.to(`room:${normalizedCode}`).emit('voice_peer_left', {
          peerSocketId: socket.id,
          playerId
        });

        if (room.status === 'WAITING') {
          const timeoutSeconds = room.settings.lobbyDisconnectTimeout || 5;
          const deadline = await roomRepository.setLobbyDisconnectTimer(normalizedCode, playerId, timeoutSeconds);

          nsp.to(`room:${normalizedCode}`).emit('lobby_disconnect_countdown', {
            playerId,
            username: player.username,
            timeoutSeconds,
            deadline
          });

          await broadcastPersonalizedRoomState(nsp, normalizedCode);

          setTimeout(async () => {
            const currentRoom = await roomRepository.getRoom(normalizedCode);
            if (!currentRoom || currentRoom.status !== 'WAITING') return;

            const p = currentRoom.players.find(x => x.id === playerId);
            if (p && !p.isConnected) {
              const removedIndex = currentRoom.players.findIndex(x => x.id === playerId);
              if (removedIndex !== -1) {
                const removed = currentRoom.players.splice(removedIndex, 1)[0];
                await roomRepository.removePlayerRoomMapping(playerId);
                await roomRepository.clearLobbyDisconnectTimer(normalizedCode, playerId);
                await roomRepository.saveRoom(normalizedCode, currentRoom);

                console.log(`⏱️ [LobbyTimer] Removed inactive player "${removed.username}" from ${normalizedCode}`);

                nsp.to(`room:${normalizedCode}`).emit('player_removed_disconnect', {
                  playerId,
                  username: removed.username
                });

                await broadcastPersonalizedRoomState(nsp, normalizedCode);
              }
            }
          }, (timeoutSeconds + 0.5) * 1000);
        } else if (room.status !== 'FINISHED') {
          await broadcastPersonalizedRoomState(nsp, normalizedCode);
        }
      } catch (e) {
        console.error('Error handling disconnect:', e);
      }
    });
  });
}

function scheduleNextRound(nsp, roomCode) {
  setTimeout(async () => {
    const room = await roomRepository.getRoom(roomCode);
    if (room && room.status === 'RESULTS') {
      await gameEngine.startClueRound(roomCode);
      await broadcastPersonalizedRoomState(nsp, roomCode);
      nsp.to(`room:${roomCode}`).emit('clue_round_started', {
        round: room.currentRound
      });
    }
  }, 7000);
}

async function broadcastPersonalizedRoomState(nsp, roomCode) {
  const room = await roomRepository.getRoom(roomCode);
  if (!room) return;

  const socketsInRoom = await nsp.in(`room:${roomCode}`).fetchSockets();
  for (const s of socketsInRoom) {
    const playerId = await roomRepository.getPlayerBySocket(s.id);
    const sanitized = gameEngine.sanitizeRoomForPlayer(room, playerId);
    s.emit('room_state', sanitized);
  }
}

export default {
  registerGameSocket
};
