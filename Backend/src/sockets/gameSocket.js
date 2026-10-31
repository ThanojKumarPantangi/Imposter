import gameEngine from '../services/gameEngine.js';
import roomRepository from '../redis/roomRepository.js';

// Server-authoritative phase timer registries (one authoritative timer per room)
const activeTurnTimers = new Map();
const activeVotingTimers = new Map();
const activeNextRoundTimers = new Map();
const activeRoleRevealTimers = new Map();

export function clearRoomPhaseTimers(roomCode) {
  if (!roomCode) return;
  const normalized = roomCode.toUpperCase();
  if (activeTurnTimers.has(normalized)) {
    clearTimeout(activeTurnTimers.get(normalized));
    activeTurnTimers.delete(normalized);
  }
  if (activeVotingTimers.has(normalized)) {
    clearTimeout(activeVotingTimers.get(normalized));
    activeVotingTimers.delete(normalized);
  }
  if (activeNextRoundTimers.has(normalized)) {
    clearTimeout(activeNextRoundTimers.get(normalized));
    activeNextRoundTimers.delete(normalized);
  }
  if (activeRoleRevealTimers.has(normalized)) {
    clearTimeout(activeRoleRevealTimers.get(normalized));
    activeRoleRevealTimers.delete(normalized);
  }
}

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
    // User Registration channel
    socket.on('register_user', async ({ playerId }) => {
      if (playerId) {
        socket.playerId = playerId;
        socket.join(`user:${playerId}`);
        await roomRepository.mapSocketToPlayer(socket.id, playerId);
      }
    });

    // 1. Join Room
    socket.on('join_room', async (data) => {
      try {
        const { roomCode, player } = data || {};
        if (!roomCode || !player || !player.id) {
          return socket.emit('error', { message: 'Invalid room join payload' });
        }

        const normalizedCode = roomCode.toUpperCase();
        const room = await gameEngine.joinRoom(normalizedCode, player);

        socket.playerId = player.id;
        socket.join(`room:${normalizedCode}`);
        socket.join(`user:${player.id}`);
        await roomRepository.mapSocketToPlayer(socket.id, player.id);

        await roomRepository.clearLobbyDisconnectTimer(normalizedCode, player.id);
        await roomRepository.clearGameDisconnectTimer(normalizedCode, player.id);

        const joinedPlayer = room.players.find(p => p.id === player.id);
        if (joinedPlayer) {
          joinedPlayer.isConnected = true;
          joinedPlayer.connectionStatus = 'CONNECTED';
          joinedPlayer.disconnectedAt = null;
          joinedPlayer.disconnectDeadline = null;
          joinedPlayer.gameDisconnectTimeout = null;
          await roomRepository.saveRoom(normalizedCode, room);
        }

        console.log(`🔌 [Socket] Player "${player.username}" (${player.id}) joined/reconnected to room ${normalizedCode}`);

        nsp.to(`room:${normalizedCode}`).emit('game_disconnect_cancelled', {
          playerId: player.id,
          username: player.username
        });

        // Direct state push to ensure the joining player has immediate authoritative state
        const sanitizedSelf = gameEngine.sanitizeRoomForPlayer(room, player.id);
        socket.emit('room_state', sanitizedSelf);

        if (room.status === 'CLUE_ROUND' && room.turnDeadline) {
          socket.emit('turn_started', {
            round: room.currentRound,
            activeTurnPlayerId: room.activeTurnPlayerId,
            activeTurnIndex: room.activeTurnIndex,
            turnDeadline: room.turnDeadline,
            duration: room.settings?.turnDurationSeconds || 30,
            turnDurationSeconds: room.settings?.turnDurationSeconds || 30,
            votingDurationSeconds: room.settings?.votingDurationSeconds || 45,
            settings: room.settings
          });
        } else if (room.status === 'VOTING' && room.votingDeadline) {
          const votingPayload = {
            votingDeadline: room.votingDeadline,
            duration: room.settings?.votingDurationSeconds || 45,
            votingDurationSeconds: room.settings?.votingDurationSeconds || 45,
            turnDurationSeconds: room.settings?.turnDurationSeconds || 30,
            settings: room.settings,
            round: room.currentRound
          };
          socket.emit('voting_phase_started', votingPayload);
          socket.emit('voting_started', votingPayload);
        }

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
        socket.join(`room:${normalizedCode}`);
        const effectivePlayerId = playerId || socket.playerId || await roomRepository.getPlayerBySocket(socket.id);
        if (effectivePlayerId) {
          socket.playerId = effectivePlayerId;
          socket.join(`user:${effectivePlayerId}`);
          await roomRepository.mapSocketToPlayer(socket.id, effectivePlayerId);
        }
        const sanitized = gameEngine.sanitizeRoomForPlayer(room, effectivePlayerId);
        socket.emit('room_state', sanitized);

        if (room.status === 'CLUE_ROUND' && room.turnDeadline) {
          socket.emit('turn_started', {
            round: room.currentRound,
            activeTurnPlayerId: room.activeTurnPlayerId,
            activeTurnIndex: room.activeTurnIndex,
            turnDeadline: room.turnDeadline,
            duration: room.settings?.turnDurationSeconds || 30,
            turnDurationSeconds: room.settings?.turnDurationSeconds || 30,
            votingDurationSeconds: room.settings?.votingDurationSeconds || 45,
            settings: room.settings
          });
        } else if (room.status === 'VOTING' && room.votingDeadline) {
          const votingPayload = {
            votingDeadline: room.votingDeadline,
            duration: room.settings?.votingDurationSeconds || 45,
            votingDurationSeconds: room.settings?.votingDurationSeconds || 45,
            turnDurationSeconds: room.settings?.turnDurationSeconds || 30,
            settings: room.settings,
            round: room.currentRound
          };
          socket.emit('voting_phase_started', votingPayload);
          socket.emit('voting_started', votingPayload);
        }
      }
    });

    // 3. Session / Room Recovery on Launch or Refresh
    socket.on('recover_session', async ({ playerId }) => {
      try {
        if (!playerId) return socket.emit('session_recovered', { roomCode: null, room: null });

        socket.playerId = playerId;
        socket.join(`user:${playerId}`);
        await roomRepository.mapSocketToPlayer(socket.id, playerId);

        const roomCode = await roomRepository.getPlayerRoomMapping(playerId);
        if (!roomCode) {
          return socket.emit('session_recovered', { roomCode: null, room: null });
        }

        const normalizedCode = roomCode.toUpperCase();
        const room = await roomRepository.getRoom(normalizedCode);
        if (!room) {
          await roomRepository.removePlayerRoomMapping(playerId);
          return socket.emit('session_recovered', { roomCode: null, room: null });
        }

        const existingPlayer = room.players.find(p => p.id === playerId);
        if (!existingPlayer || existingPlayer.permanentlyDeparted) {
          await roomRepository.removePlayerRoomMapping(playerId);
          return socket.emit('session_recovered', { roomCode: null, room: null });
        }

        // Restore player connection state and clear any disconnect countdown
        existingPlayer.isConnected = true;
        existingPlayer.connectionStatus = 'CONNECTED';
        existingPlayer.disconnectedAt = null;
        existingPlayer.disconnectDeadline = null;
        existingPlayer.gameDisconnectTimeout = null;

        await roomRepository.saveRoom(normalizedCode, room);
        await roomRepository.clearLobbyDisconnectTimer(normalizedCode, playerId);
        await roomRepository.clearGameDisconnectTimer(normalizedCode, playerId);

        socket.join(`room:${normalizedCode}`);

        const sanitized = gameEngine.sanitizeRoomForPlayer(room, playerId);
        socket.emit('session_recovered', {
          roomCode: normalizedCode,
          room: sanitized
        });
        socket.emit('room_state', sanitized);

        if (room.status === 'CLUE_ROUND' && room.turnDeadline) {
          socket.emit('turn_started', {
            round: room.currentRound,
            activeTurnPlayerId: room.activeTurnPlayerId,
            activeTurnIndex: room.activeTurnIndex,
            turnDeadline: room.turnDeadline,
            duration: room.settings?.turnDurationSeconds || 30,
            turnDurationSeconds: room.settings?.turnDurationSeconds || 30,
            votingDurationSeconds: room.settings?.votingDurationSeconds || 45,
            settings: room.settings
          });
        } else if (room.status === 'VOTING' && room.votingDeadline) {
          const votingPayload = {
            votingDeadline: room.votingDeadline,
            duration: room.settings?.votingDurationSeconds || 45,
            votingDurationSeconds: room.settings?.votingDurationSeconds || 45,
            turnDurationSeconds: room.settings?.turnDurationSeconds || 30,
            settings: room.settings,
            round: room.currentRound
          };
          socket.emit('voting_phase_started', votingPayload);
          socket.emit('voting_started', votingPayload);
        }

        nsp.to(`room:${normalizedCode}`).emit('game_disconnect_cancelled', {
          playerId,
          username: existingPlayer.username
        });

        nsp.to(`room:${normalizedCode}`).emit('player_connected', {
          playerId,
          username: existingPlayer.username
        });

        await broadcastPersonalizedRoomState(nsp, normalizedCode);
      } catch (err) {
        socket.emit('session_recovered', { roomCode: null, room: null });
      }
    });

    // 4. Leave Room (Idempotent cleanup)
    socket.on('leave_room', async ({ roomCode, playerId }) => {
      try {
        const normalizedCode = (roomCode || '').toUpperCase();
        socket.leave(`room:${normalizedCode}`);
        await roomRepository.removeSocketMapping(socket.id);

        if (!normalizedCode || !playerId) return;

        // Immediately notify voice peers that this participant departed
        await roomRepository.removeVoiceParticipant(normalizedCode, playerId);
        nsp.to(`room:${normalizedCode}`).emit('voice_peer_left', {
          peerSocketId: socket.id,
          playerId
        });

        const result = await gameEngine.leaveRoom(normalizedCode, playerId);
        if (result && result.roomDeleted) {
          clearRoomPhaseTimers(normalizedCode);
          nsp.to(`room:${normalizedCode}`).emit('room_closed', {
            roomCode: normalizedCode,
            reason: 'All players departed. Room closed.'
          });
        } else if (result && result.room) {
          nsp.to(`room:${normalizedCode}`).emit('player_left', {
            playerId,
            username: result.departedPlayer ? result.departedPlayer.username : 'Player'
          });

          if (result.gameOver) {
            clearRoomPhaseTimers(normalizedCode);
            nsp.to(`room:${normalizedCode}`).emit('game_finished', result.winnerResult);
          }

          await broadcastPersonalizedRoomState(nsp, normalizedCode);
        }
      } catch (err) {
        socket.emit('error', { message: err.message });
      }
    });

    // 5. Update Settings (Host Only - Authoritative Server Enforcement)
    socket.on('update_settings', async ({ roomCode, hostId, settings }) => {
      try {
        if (!roomCode || !hostId) return socket.emit('error', { message: 'Room code and host ID are required' });
        const normalizedCode = roomCode.toUpperCase();
        const room = await roomRepository.getRoom(normalizedCode);
        if (!room) return socket.emit('error', { message: 'Room not found' });

        const socketPlayerId = await roomRepository.getPlayerBySocket(socket.id);
        if (room.hostId !== hostId || (socketPlayerId && socketPlayerId !== hostId)) {
          return socket.emit('error', { message: 'Unauthorized: Only the room host can modify game settings' });
        }

        const updatedRoom = await gameEngine.updateSettings(normalizedCode, hostId, settings || {});
        await broadcastPersonalizedRoomState(nsp, normalizedCode);
        nsp.to(`room:${normalizedCode}`).emit('settings_updated', updatedRoom.settings);
      } catch (err) {
        socket.emit('error', { message: err.message });
      }
    });

    // 5b. Update Shared Room Categories (Any player in lobby)
    const handleCategoryUpdate = async ({ roomCode, playerId, categorySlugs, categoryNames }) => {
      try {
        if (!roomCode || !playerId) return socket.emit('error', { message: 'Room code and player ID are required' });
        const normalizedCode = roomCode.toUpperCase();

        const socketPlayerId = await roomRepository.getPlayerBySocket(socket.id);
        if (socketPlayerId && socketPlayerId !== playerId) {
          return socket.emit('error', { message: 'Unauthorized: Socket identity mismatch' });
        }

        const result = await gameEngine.updateRoomCategories(
          normalizedCode,
          playerId,
          categorySlugs,
          categoryNames
        );

        // Broadcast authoritative shared room categories to all room members
        nsp.to(`room:${normalizedCode}`).emit('room_categories_updated', {
          categorySlugs: result.categorySlugs,
          categoryNames: result.categoryNames,
          selectedCategories: result.categorySlugs,
          categoriesCount: result.categorySlugs.length,
          updatedBy: playerId,
          updatedByUsername: result.player.username
        });

        // Also broadcast settings_updated for real-time room synchronization
        nsp.to(`room:${normalizedCode}`).emit('settings_updated', result.room.settings);

        // Backward compatibility event for older clients
        nsp.to(`room:${normalizedCode}`).emit('player_categories_updated', {
          playerId,
          username: result.player.username,
          categoriesCount: result.categorySlugs.length
        });

        await broadcastPersonalizedRoomState(nsp, normalizedCode);
      } catch (err) {
        socket.emit('error', { message: err.message });
      }
    };

    socket.on('update_room_categories', handleCategoryUpdate);
    socket.on('update_player_categories', handleCategoryUpdate);
    socket.on('update_categories', handleCategoryUpdate);

    // 6. Update Username (Without disconnecting socket or resetting game)
    socket.on('update_username', async ({ playerId, newUsername }) => {
      try {
        if (!playerId || !newUsername) return;
        const cleanName = newUsername.trim().slice(0, 25);
        if (cleanName.length < 2) return;

        const roomCode = await roomRepository.getPlayerRoomMapping(playerId);
        if (roomCode) {
          const normalizedCode = roomCode.toUpperCase();
          const room = await roomRepository.getRoom(normalizedCode);
          if (room) {
            const p = room.players.find(x => x.id === playerId);
            if (p) {
              p.username = cleanName;
              // Also update clues history
              if (room.clueHistory) {
                room.clueHistory.forEach(c => {
                  if (c.playerId === playerId) c.username = cleanName;
                });
              }
              await roomRepository.saveRoom(normalizedCode, room);
              nsp.to(`room:${normalizedCode}`).emit('player_username_updated', {
                playerId,
                newUsername: cleanName
              });
              await broadcastPersonalizedRoomState(nsp, normalizedCode);
            }
          }
        }
      } catch (err) {
        socket.emit('error', { message: err.message });
      }
    });

    // Legacy event alias
    socket.on('update_lobby_username', async ({ roomCode, playerId, newUsername }) => {
      socket.emit('update_username', { playerId, newUsername });
    });

    // 7. Kick / Remove Player (Host Only)
    socket.on('kick_player', async ({ roomCode, hostId, targetPlayerId }) => {
      try {
        const normalizedCode = roomCode.toUpperCase();
        const result = await gameEngine.removePlayerByHost(normalizedCode, hostId, targetPlayerId);

        const targetSocketId = await roomRepository.getSocketByPlayer(targetPlayerId);
        const kickNotice = {
          roomCode: normalizedCode,
          reason: 'You have been removed from this room by the host.'
        };

        // Emit to user channel and target socket
        nsp.to(`user:${targetPlayerId}`).emit('kicked_from_room', kickNotice);
        if (targetSocketId) {
          nsp.to(targetSocketId).emit('kicked_from_room', kickNotice);
          const targetSocket = nsp.sockets.get(targetSocketId);
          if (targetSocket) targetSocket.leave(`room:${normalizedCode}`);

          // Voice cleanup for kicked player
          await roomRepository.removeVoiceParticipant(normalizedCode, targetPlayerId);
          nsp.to(`room:${normalizedCode}`).emit('voice_peer_left', {
            peerSocketId: targetSocketId,
            playerId: targetPlayerId
          });
        }

        nsp.to(`room:${normalizedCode}`).emit('player_kicked', {
          removedPlayerId: targetPlayerId,
          username: result.departedPlayer ? result.departedPlayer.username : 'Player'
        });

        if (result.gameOver) {
          nsp.to(`room:${normalizedCode}`).emit('game_finished', result.winnerResult);
        }

        await broadcastPersonalizedRoomState(nsp, normalizedCode);
      } catch (err) {
        socket.emit('error', { message: err.message });
      }
    });

    // 7b. Rejoin Request & Approval Workflow
    socket.on('request_rejoin', async ({ roomCode, player }) => {
      try {
        if (!roomCode || !player || !player.id) return;
        const normalizedCode = roomCode.toUpperCase();

        socket.playerId = player.id;
        socket.join(`user:${player.id}`);
        await roomRepository.mapSocketToPlayer(socket.id, player.id);

        const requestData = await gameEngine.createRejoinRequest(normalizedCode, {
          ...player,
          socketId: socket.id
        });

        socket.join(`rejoin:${requestData.requestId}`);

        const room = await roomRepository.getRoom(normalizedCode);
        if (room) {
          const hostSocketId = await roomRepository.getSocketByPlayer(room.hostId);
          const payload = {
            requestId: requestData.requestId,
            roomCode: normalizedCode,
            player: requestData.player
          };
          nsp.to(`user:${room.hostId}`).emit('rejoin_request_received', payload);
          if (hostSocketId) {
            nsp.to(hostSocketId).emit('rejoin_request_received', payload);
          }
        }

        socket.emit('rejoin_request_pending', {
          requestId: requestData.requestId,
          roomCode: normalizedCode,
          expiresInSeconds: 45
        });
      } catch (err) {
        socket.emit('rejoin_error', { message: err.message });
      }
    });

    socket.on('approve_rejoin', async ({ roomCode, hostId, targetPlayerId, requestId }) => {
      try {
        const normalizedCode = (roomCode || '').toUpperCase();
        const result = await gameEngine.approveRejoin(normalizedCode, hostId, targetPlayerId, requestId);

        const approvalPayload = {
          roomCode: normalizedCode,
          room: result.room,
          player: result.player
        };

        // Multi-channel delivery to guarantee requesting player receives approval
        nsp.to(`user:${targetPlayerId}`).emit('rejoin_approved', approvalPayload);
        if (requestId) {
          nsp.to(`rejoin:${requestId}`).emit('rejoin_approved', approvalPayload);
        }

        const targetSocketId = await roomRepository.getSocketByPlayer(targetPlayerId);
        if (targetSocketId) {
          const targetSocket = nsp.sockets.get(targetSocketId);
          if (targetSocket) targetSocket.join(`room:${normalizedCode}`);
          nsp.to(targetSocketId).emit('rejoin_approved', approvalPayload);
        }

        await broadcastPersonalizedRoomState(nsp, normalizedCode);
        nsp.to(`room:${normalizedCode}`).emit('player_joined', {
          player: result.player,
          totalPlayers: result.room.players.length
        });
      } catch (err) {
        socket.emit('error', { message: err.message });
      }
    });

    socket.on('deny_rejoin', async ({ roomCode, hostId, targetPlayerId, requestId }) => {
      try {
        const normalizedCode = (roomCode || '').toUpperCase();
        await gameEngine.denyRejoin(normalizedCode, hostId, targetPlayerId, requestId);

        const denialPayload = {
          message: 'The host declined your request to join this room.',
          roomCode: normalizedCode
        };

        nsp.to(`user:${targetPlayerId}`).emit('rejoin_denied', denialPayload);
        if (requestId) {
          nsp.to(`rejoin:${requestId}`).emit('rejoin_denied', denialPayload);
        }

        const targetSocketId = await roomRepository.getSocketByPlayer(targetPlayerId);
        if (targetSocketId) {
          nsp.to(targetSocketId).emit('rejoin_denied', denialPayload);
        }
      } catch (err) {
        socket.emit('error', { message: err.message });
      }
    });

    // 8. Start Game
    socket.on('start_game', async ({ roomCode, hostId }) => {
      try {
        const normalizedCode = roomCode.toUpperCase();
        const room = await gameEngine.startGame(normalizedCode, hostId);

        console.log(`🎮 [Game] Room ${normalizedCode} started! Word: "${room.secretWord}", Hint: "${room.hint}"`);

        clearRoomPhaseTimers(normalizedCode);

        await broadcastPersonalizedRoomState(nsp, normalizedCode);
        const gameStartedPayload = {
          status: 'ROLE_REVEAL',
          duration: 6,
          turnDurationSeconds: room.settings.turnDurationSeconds,
          votingDurationSeconds: room.settings.votingDurationSeconds,
          settings: room.settings
        };
        nsp.to(`room:${normalizedCode}`).emit('game_started', gameStartedPayload);

        const revealTimer = setTimeout(async () => {
          activeRoleRevealTimers.delete(normalizedCode);
          const currentRoom = await roomRepository.getRoom(normalizedCode);
          if (currentRoom && currentRoom.status === 'ROLE_REVEAL') {
            const updatedRoom = await gameEngine.startClueRound(normalizedCode);
            if (updatedRoom) {
              await broadcastPersonalizedRoomState(nsp, normalizedCode);
              const roundPayload = {
                round: updatedRoom.currentRound,
                turnDeadline: updatedRoom.turnDeadline,
                duration: updatedRoom.settings.turnDurationSeconds,
                turnDurationSeconds: updatedRoom.settings.turnDurationSeconds,
                votingDurationSeconds: updatedRoom.settings.votingDurationSeconds,
                settings: updatedRoom.settings,
                activeTurnPlayerId: updatedRoom.activeTurnPlayerId,
                activeTurnIndex: updatedRoom.activeTurnIndex
              };
              nsp.to(`room:${normalizedCode}`).emit('round_started', roundPayload);
              nsp.to(`room:${normalizedCode}`).emit('clue_round_started', roundPayload);
              nsp.to(`room:${normalizedCode}`).emit('turn_started', roundPayload);
              scheduleTurnTimeout(nsp, normalizedCode);
            }
          }
        }, 6000);
        activeRoleRevealTimers.set(normalizedCode, revealTimer);
      } catch (err) {
        socket.emit('error', { message: err.message });
      }
    });

    // 9. Submit Clue or Imposter Secret-Word Guess
    socket.on('submit_clue', async ({ roomCode, playerId, clue }) => {
      try {
        const normalizedCode = roomCode.toUpperCase();
        const result = await gameEngine.submitClueOrGuess(normalizedCode, playerId, clue);

        if (result.gameOver) {
          clearRoomPhaseTimers(normalizedCode);
          await broadcastPersonalizedRoomState(nsp, normalizedCode);
          nsp.to(`room:${normalizedCode}`).emit('game_finished', result.winnerResult);
          return;
        }

        await broadcastPersonalizedRoomState(nsp, normalizedCode);

        if (result.phaseChanged && result.room.status === 'VOTING') {
          clearRoomPhaseTimers(normalizedCode);
          const votingPayload = {
            votingDeadline: result.room.votingDeadline,
            duration: result.room.settings.votingDurationSeconds,
            votingDurationSeconds: result.room.settings.votingDurationSeconds,
            turnDurationSeconds: result.room.settings.turnDurationSeconds,
            settings: result.room.settings,
            round: result.room.currentRound
          };
          nsp.to(`room:${normalizedCode}`).emit('voting_phase_started', votingPayload);
          nsp.to(`room:${normalizedCode}`).emit('voting_started', votingPayload);
          scheduleVotingTimeout(nsp, normalizedCode, result.room.settings.votingDurationSeconds);
        } else {
          const turnPayload = {
            round: result.room.currentRound,
            activeTurnPlayerId: result.room.activeTurnPlayerId,
            activeTurnIndex: result.room.activeTurnIndex,
            turnDeadline: result.room.turnDeadline,
            duration: result.room.settings.turnDurationSeconds,
            turnDurationSeconds: result.room.settings.turnDurationSeconds,
            votingDurationSeconds: result.room.settings.votingDurationSeconds,
            settings: result.room.settings
          };
          nsp.to(`room:${normalizedCode}`).emit('turn_started', turnPayload);
          scheduleTurnTimeout(nsp, normalizedCode);
        }
      } catch (err) {
        socket.emit('error', { message: err.message });
      }
    });

    // 10. Submit Vote
    socket.on('submit_vote', async ({ roomCode, voterId, targetPlayerId }) => {
      try {
        const normalizedCode = roomCode.toUpperCase();
        const result = await gameEngine.submitVote(normalizedCode, voterId, targetPlayerId);

        if (result.finishedVoting) {
          clearRoomPhaseTimers(normalizedCode);
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

    // 11. Return to Lobby
    socket.on('return_to_lobby', async ({ roomCode, playerId }) => {
      try {
        const normalizedCode = (roomCode || '').toUpperCase();
        clearRoomPhaseTimers(normalizedCode);
        const room = await gameEngine.returnToLobby(normalizedCode, playerId);

        nsp.to(`room:${normalizedCode}`).emit('room_returned_to_lobby', { roomCode: normalizedCode });
        await broadcastPersonalizedRoomState(nsp, normalizedCode);
      } catch (err) {
        socket.emit('error', { message: err.message });
      }
    });

    // 12. WebRTC Voice Chat Signaling
    socket.on('voice_signal_join', async ({ roomCode, playerId }) => {
      try {
        const normalizedCode = (roomCode || '').toUpperCase();
        if (!normalizedCode || !playerId) return;

        const room = await roomRepository.getRoom(normalizedCode);
        if (!room) return;

        const player = room.players?.find(p => p.id === playerId);
        if (!player || player.permanentlyDeparted) return;

        socket.join(`room:${normalizedCode}`);
        socket.playerId = playerId;

        // Record voice participant mapping in Redis
        await roomRepository.addVoiceParticipant(normalizedCode, playerId, socket.id);

        // Fetch current active voice participants in this room
        const allParticipants = await roomRepository.getVoiceParticipants(normalizedCode);
        const remoteParticipants = allParticipants.filter(
          p => p.playerId !== playerId && p.socketId !== socket.id
        );

        // Send existing voice participants to newly joined/reconnected socket
        socket.emit('voice_participants_list', {
          roomCode: normalizedCode,
          participants: remoteParticipants
        });

        // Notify other room participants that this player joined/reconnected voice
        socket.to(`room:${normalizedCode}`).emit('voice_peer_joined', {
          peerSocketId: socket.id,
          playerId,
          username: player.username
        });

        console.log(`🎙️ [Voice] Player "${player.username}" (${playerId}) joined voice room ${normalizedCode} (socket: ${socket.id})`);
      } catch (err) {
        console.error('Error in voice_signal_join:', err);
      }
    });

    socket.on('voice_signal_offer', ({ targetSocketId, offer, callerId }) => {
      if (!targetSocketId || !offer) return;
      nsp.to(targetSocketId).emit('voice_signal_offer', {
        callerSocketId: socket.id,
        callerId,
        offer
      });
    });

    socket.on('voice_signal_answer', ({ targetSocketId, answer, responderId }) => {
      if (!targetSocketId || !answer) return;
      nsp.to(targetSocketId).emit('voice_signal_answer', {
        responderSocketId: socket.id,
        responderId,
        answer
      });
    });

    socket.on('voice_signal_ice_candidate', ({ targetSocketId, candidate, senderId }) => {
      if (!targetSocketId || !candidate) return;
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

    // 13. Disconnect Handler (Respects configurable grace periods)
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

        await roomRepository.removeVoiceParticipant(normalizedCode, playerId);
        nsp.to(`room:${normalizedCode}`).emit('voice_peer_left', {
          peerSocketId: socket.id,
          playerId
        });

        // Lobby Disconnect Grace Period
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
              const result = await gameEngine.leaveRoom(normalizedCode, playerId);
              if (result && result.roomDeleted) {
                nsp.to(`room:${normalizedCode}`).emit('room_closed', {
                  roomCode: normalizedCode,
                  reason: 'All players departed. Room closed.'
                });
              } else {
                console.log(`⏱️ [LobbyTimer] Removed inactive player "${p.username}" from ${normalizedCode}`);
                nsp.to(`room:${normalizedCode}`).emit('player_removed_disconnect', {
                  playerId,
                  username: p.username
                });
                await broadcastPersonalizedRoomState(nsp, normalizedCode);
              }
            }
          }, (timeoutSeconds + 0.5) * 1000);
        } else if (room.status !== 'FINISHED') {
          // Active Game Disconnect Grace Period (Preserves game state, roles, clues)
          const gracePeriodSeconds = room.settings.gameDisconnectTimeout || room.settings.gameDisconnectGracePeriod || 15;
          const deadline = Date.now() + (gracePeriodSeconds * 1000);

          player.connectionStatus = 'DISCONNECTED';
          player.disconnectedAt = Date.now();
          player.disconnectDeadline = deadline;
          player.gameDisconnectTimeout = gracePeriodSeconds;
          await roomRepository.saveRoom(normalizedCode, room);

          await roomRepository.setGameDisconnectTimer(normalizedCode, playerId, gracePeriodSeconds);

          nsp.to(`room:${normalizedCode}`).emit('game_disconnect_countdown', {
            playerId,
            username: player.username,
            disconnectedAt: player.disconnectedAt,
            disconnectDeadline: deadline,
            timeoutSeconds: gracePeriodSeconds,
            roomCode: normalizedCode
          });

          await broadcastPersonalizedRoomState(nsp, normalizedCode);

          setTimeout(async () => {
            const currentRoom = await roomRepository.getRoom(normalizedCode);
            if (!currentRoom || currentRoom.status === 'FINISHED' || currentRoom.status === 'WAITING') return;

            const p = currentRoom.players.find(x => x.id === playerId);
            if (p && !p.isConnected && !p.permanentlyDeparted) {
              console.log(`⏱️ [GracePeriod] Player "${p.username}" exceeded reconnect grace period. Marking permanent departure.`);
              const result = await gameEngine.leaveRoom(normalizedCode, playerId);

              if (result && result.roomDeleted) {
                nsp.to(`room:${normalizedCode}`).emit('room_closed', {
                  roomCode: normalizedCode,
                  reason: 'All players departed. Room closed.'
                });
              } else if (result) {
                nsp.to(`room:${normalizedCode}`).emit('player_permanently_departed', {
                  playerId,
                  username: p.username
                });

                if (result.gameOver) {
                  nsp.to(`room:${normalizedCode}`).emit('game_finished', result.winnerResult);
                }
                await broadcastPersonalizedRoomState(nsp, normalizedCode);
              }
            }
          }, (gracePeriodSeconds + 0.5) * 1000);
        }
      } catch (e) {
        console.error('Error handling disconnect:', e);
      }
    });
  });
}

/**
 * Schedule Authoritative Turn Timeout
 */
function scheduleTurnTimeout(nsp, roomCode) {
  if (!roomCode) return;
  const normalizedCode = roomCode.toUpperCase();

  // Cancel any existing turn timeout for this room to avoid duplicate executions
  if (activeTurnTimers.has(normalizedCode)) {
    clearTimeout(activeTurnTimers.get(normalizedCode));
    activeTurnTimers.delete(normalizedCode);
  }

  (async () => {
    try {
      const room = await roomRepository.getRoom(normalizedCode);
      if (!room || room.status !== 'CLUE_ROUND' || !room.turnDeadline) return;

      const activePlayerId = room.activeTurnPlayerId;
      const turnIndex = room.activeTurnIndex;
      const currentRound = room.currentRound;
      const remainingMs = Math.max(100, (room.turnDeadline - Date.now()) + 50);

      const timerId = setTimeout(async () => {
        activeTurnTimers.delete(normalizedCode);
        try {
          const freshRoom = await roomRepository.getRoom(normalizedCode);
          if (!freshRoom || freshRoom.status !== 'CLUE_ROUND') return;

          // Guard against race condition: check if round or turn already rotated or completed
          if (
            freshRoom.currentRound !== currentRound ||
            freshRoom.activeTurnPlayerId !== activePlayerId ||
            freshRoom.activeTurnIndex !== turnIndex
          ) {
            return;
          }

          // If clock jitter caused early wakeup, wait remaining time
          if (freshRoom.turnDeadline && Date.now() < freshRoom.turnDeadline - 200) {
            scheduleTurnTimeout(nsp, normalizedCode);
            return;
          }

          const result = await gameEngine.handleTurnTimeout(normalizedCode, activePlayerId, turnIndex);
          if (result) {
            const skippedPlayer = result.skippedPlayer || freshRoom.players.find(p => p.id === activePlayerId);
            const name = skippedPlayer ? skippedPlayer.username : 'Player';

            nsp.to(`room:${normalizedCode}`).emit('turn_skipped', {
              playerId: activePlayerId,
              username: name,
              message: `${name} skipped the turn — no clue submitted.`
            });

            await broadcastPersonalizedRoomState(nsp, normalizedCode);

            if (result.phaseChanged && result.room.status === 'VOTING') {
              clearRoomPhaseTimers(normalizedCode);
              const votingPayload = {
                votingDeadline: result.room.votingDeadline,
                duration: result.room.settings.votingDurationSeconds,
                votingDurationSeconds: result.room.settings.votingDurationSeconds,
                turnDurationSeconds: result.room.settings.turnDurationSeconds,
                settings: result.room.settings,
                round: result.room.currentRound
              };
              nsp.to(`room:${normalizedCode}`).emit('voting_phase_started', votingPayload);
              nsp.to(`room:${normalizedCode}`).emit('voting_started', votingPayload);
              scheduleVotingTimeout(nsp, normalizedCode, result.room.settings.votingDurationSeconds);
            } else if (!result.phaseChanged) {
              const turnPayload = {
                round: result.room.currentRound,
                activeTurnPlayerId: result.room.activeTurnPlayerId,
                activeTurnIndex: result.room.activeTurnIndex,
                turnDeadline: result.room.turnDeadline,
                duration: result.room.settings.turnDurationSeconds,
                turnDurationSeconds: result.room.settings.turnDurationSeconds,
                votingDurationSeconds: result.room.settings.votingDurationSeconds,
                settings: result.room.settings
              };
              nsp.to(`room:${normalizedCode}`).emit('turn_started', turnPayload);
              scheduleTurnTimeout(nsp, normalizedCode);
            }
          }
        } catch (err) {
          console.error(`Error in turn timeout for ${normalizedCode}:`, err);
        }
      }, remainingMs);

      activeTurnTimers.set(normalizedCode, timerId);
    } catch (e) {
      console.error('Error scheduling turn timeout:', e);
    }
  })();
}

/**
 * Schedule Authoritative Voting Timeout
 */
function scheduleVotingTimeout(nsp, roomCode, durationSeconds = 45) {
  if (!roomCode) return;
  const normalizedCode = roomCode.toUpperCase();

  // Cancel any existing voting timeout for this room to prevent duplicate tallying
  if (activeVotingTimers.has(normalizedCode)) {
    clearTimeout(activeVotingTimers.get(normalizedCode));
    activeVotingTimers.delete(normalizedCode);
  }

  (async () => {
    try {
      const room = await roomRepository.getRoom(normalizedCode);
      if (!room || room.status !== 'VOTING') return;

      const votingRound = room.currentRound;
      const configuredDuration = room.settings?.votingDurationSeconds || durationSeconds || 45;
      const remainingMs = room.votingDeadline
        ? Math.max(100, (room.votingDeadline - Date.now()) + 50)
        : (configuredDuration + 0.5) * 1000;

      const timerId = setTimeout(async () => {
        activeVotingTimers.delete(normalizedCode);
        const freshRoom = await roomRepository.getRoom(normalizedCode);
        if (freshRoom && freshRoom.status === 'VOTING' && freshRoom.currentRound === votingRound) {
          const tallyResult = await gameEngine.tallyVotesAndProcessElimination(normalizedCode);
          await broadcastPersonalizedRoomState(nsp, normalizedCode);
          if (tallyResult.gameOver) {
            clearRoomPhaseTimers(normalizedCode);
            nsp.to(`room:${normalizedCode}`).emit('game_finished', tallyResult.winnerResult);
          } else {
            nsp.to(`room:${normalizedCode}`).emit('round_results', tallyResult.room.eliminationResult);
            scheduleNextRound(nsp, normalizedCode);
          }
        }
      }, remainingMs);

      activeVotingTimers.set(normalizedCode, timerId);
    } catch (e) {
      console.error('Error scheduling voting timeout:', e);
    }
  })();
}

function scheduleNextRound(nsp, roomCode) {
  if (!roomCode) return;
  const normalizedCode = roomCode.toUpperCase();

  if (activeNextRoundTimers.has(normalizedCode)) {
    clearTimeout(activeNextRoundTimers.get(normalizedCode));
    activeNextRoundTimers.delete(normalizedCode);
  }

  const timerId = setTimeout(async () => {
    activeNextRoundTimers.delete(normalizedCode);
    const room = await roomRepository.getRoom(normalizedCode);
    if (room && room.status === 'RESULTS') {
      const updatedRoom = await gameEngine.startClueRound(normalizedCode);
      if (updatedRoom) {
        await broadcastPersonalizedRoomState(nsp, normalizedCode);
        const roundPayload = {
          round: updatedRoom.currentRound,
          turnDeadline: updatedRoom.turnDeadline,
          duration: updatedRoom.settings.turnDurationSeconds,
          turnDurationSeconds: updatedRoom.settings.turnDurationSeconds,
          votingDurationSeconds: updatedRoom.settings.votingDurationSeconds,
          settings: updatedRoom.settings,
          activeTurnPlayerId: updatedRoom.activeTurnPlayerId,
          activeTurnIndex: updatedRoom.activeTurnIndex
        };
        nsp.to(`room:${normalizedCode}`).emit('round_started', roundPayload);
        nsp.to(`room:${normalizedCode}`).emit('clue_round_started', roundPayload);
        nsp.to(`room:${normalizedCode}`).emit('turn_started', roundPayload);
        scheduleTurnTimeout(nsp, normalizedCode);
      }
    }
  }, 7000);

  activeNextRoundTimers.set(normalizedCode, timerId);
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
