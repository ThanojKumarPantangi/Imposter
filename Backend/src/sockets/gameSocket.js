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
        await roomRepository.clearGameDisconnectTimer(normalizedCode, player.id);

        console.log(`🔌 [Socket] Player "${player.username}" (${player.id}) joined/reconnected to room ${normalizedCode}`);

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
        if (playerId) {
          await roomRepository.mapSocketToPlayer(socket.id, playerId);
        }
        const sanitized = gameEngine.sanitizeRoomForPlayer(room, playerId);
        socket.emit('room_state', sanitized);
      }
    });

    // 3. Session / Room Recovery on Launch or Refresh
    socket.on('recover_session', async ({ playerId }) => {
      try {
        if (!playerId) return socket.emit('session_recovered', { roomCode: null, room: null });

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

        // Restore player connection state
        existingPlayer.isConnected = true;
        await roomRepository.saveRoom(normalizedCode, room);
        await roomRepository.clearLobbyDisconnectTimer(normalizedCode, playerId);
        await roomRepository.clearGameDisconnectTimer(normalizedCode, playerId);

        socket.join(`room:${normalizedCode}`);
        await roomRepository.mapSocketToPlayer(socket.id, playerId);

        const sanitized = gameEngine.sanitizeRoomForPlayer(room, playerId);
        socket.emit('session_recovered', {
          roomCode: normalizedCode,
          room: sanitized
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

        const result = await gameEngine.leaveRoom(normalizedCode, playerId);
        if (result && result.roomDeleted) {
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
        if (targetSocketId) {
          nsp.to(targetSocketId).emit('kicked_from_room', {
            roomCode: normalizedCode,
            reason: 'You have been removed from this room by the host.'
          });
          const targetSocket = nsp.sockets.get(targetSocketId);
          if (targetSocket) targetSocket.leave(`room:${normalizedCode}`);

          // Voice cleanup for kicked player
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
        const requestData = await gameEngine.createRejoinRequest(normalizedCode, player);

        const room = await roomRepository.getRoom(normalizedCode);
        if (room) {
          const hostSocketId = await roomRepository.getSocketByPlayer(room.hostId);
          if (hostSocketId) {
            nsp.to(hostSocketId).emit('rejoin_request_received', {
              requestId: requestData.requestId,
              roomCode: normalizedCode,
              player: requestData.player
            });
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

        const targetSocketId = await roomRepository.getSocketByPlayer(targetPlayerId);
        if (targetSocketId) {
          const targetSocket = nsp.sockets.get(targetSocketId);
          if (targetSocket) targetSocket.join(`room:${normalizedCode}`);
          nsp.to(targetSocketId).emit('rejoin_approved', {
            roomCode: normalizedCode,
            room: result.room
          });
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

        const targetSocketId = await roomRepository.getSocketByPlayer(targetPlayerId);
        if (targetSocketId) {
          nsp.to(targetSocketId).emit('rejoin_denied', {
            message: 'The host declined your request to join this room.'
          });
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
            scheduleTurnTimeout(nsp, normalizedCode);
          }
        }, 6000);
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
          scheduleVotingTimeout(nsp, normalizedCode, result.room.settings.votingDurationSeconds);
        } else {
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
        const room = await gameEngine.returnToLobby(normalizedCode, playerId);

        nsp.to(`room:${normalizedCode}`).emit('room_returned_to_lobby', { roomCode: normalizedCode });
        await broadcastPersonalizedRoomState(nsp, normalizedCode);
      } catch (err) {
        socket.emit('error', { message: err.message });
      }
    });

    // 12. WebRTC Voice Chat Signaling
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
          const gracePeriodSeconds = room.settings.gameDisconnectGracePeriod || 30;
          await roomRepository.setGameDisconnectTimer(normalizedCode, playerId, gracePeriodSeconds);
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
  (async () => {
    try {
      const room = await roomRepository.getRoom(roomCode);
      if (!room || room.status !== 'CLUE_ROUND' || !room.turnDeadline) return;

      const activePlayerId = room.activeTurnPlayerId;
      const turnIndex = room.activeTurnIndex;
      const remainingMs = Math.max(100, (room.turnDeadline - Date.now()) + 50);

      setTimeout(async () => {
        try {
          const freshRoom = await roomRepository.getRoom(roomCode);
          if (!freshRoom || freshRoom.status !== 'CLUE_ROUND') return;

          // Guard against race condition: check if turn already rotated or completed
          if (freshRoom.activeTurnPlayerId !== activePlayerId || freshRoom.activeTurnIndex !== turnIndex) {
            return;
          }

          // If clock jitter caused early wakeup, wait remaining time
          if (freshRoom.turnDeadline && Date.now() < freshRoom.turnDeadline - 200) {
            scheduleTurnTimeout(nsp, roomCode);
            return;
          }

          const result = await gameEngine.handleTurnTimeout(roomCode, activePlayerId, turnIndex);
          if (result) {
            const skippedPlayer = result.skippedPlayer || freshRoom.players.find(p => p.id === activePlayerId);
            const name = skippedPlayer ? skippedPlayer.username : 'Player';

            nsp.to(`room:${roomCode}`).emit('turn_skipped', {
              playerId: activePlayerId,
              username: name,
              message: `${name} skipped the turn — no clue submitted.`
            });

            await broadcastPersonalizedRoomState(nsp, roomCode);

            if (result.phaseChanged && result.room.status === 'VOTING') {
              nsp.to(`room:${roomCode}`).emit('voting_phase_started', {
                votingDeadline: result.room.votingDeadline,
                duration: result.room.settings.votingDurationSeconds
              });
              scheduleVotingTimeout(nsp, roomCode, result.room.settings.votingDurationSeconds);
            } else if (!result.phaseChanged) {
              scheduleTurnTimeout(nsp, roomCode);
            }
          }
        } catch (err) {
          console.error(`Error in turn timeout for ${roomCode}:`, err);
        }
      }, remainingMs);
    } catch (e) {
      console.error('Error scheduling turn timeout:', e);
    }
  })();
}

/**
 * Schedule Authoritative Voting Timeout
 */
function scheduleVotingTimeout(nsp, roomCode, durationSeconds = 45) {
  setTimeout(async () => {
    const room = await roomRepository.getRoom(roomCode);
    if (room && room.status === 'VOTING') {
      const tallyResult = await gameEngine.tallyVotesAndProcessElimination(roomCode);
      await broadcastPersonalizedRoomState(nsp, roomCode);
      if (tallyResult.gameOver) {
        nsp.to(`room:${roomCode}`).emit('game_finished', tallyResult.winnerResult);
      } else {
        nsp.to(`room:${roomCode}`).emit('round_results', tallyResult.room.eliminationResult);
        scheduleNextRound(nsp, roomCode);
      }
    }
  }, (durationSeconds + 1) * 1000);
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
      scheduleTurnTimeout(nsp, roomCode);
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
