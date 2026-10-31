import React, { createContext, useContext, useEffect, useState, useRef } from 'react';
import { io } from 'socket.io-client';
import { useAuth } from './AuthContext';
import { roomApi } from '../api/roomApi';
import { sounds } from '../utils/sound';

const SocketContext = createContext(null);

const SOCKET_SERVER_URL = import.meta.env.VITE_SOCKET_URL || 'http://localhost:5000';

export function SocketProvider({ children }) {
  const { player } = useAuth();
  const playerRef = useRef(player);
  const socketRef = useRef(null);

  const [isConnected, setIsConnected] = useState(false);
  const [roomState, setRoomState] = useState(null);
  const [disconnectAlert, setDisconnectAlert] = useState(null); // { playerId, username, deadline, timeoutSeconds }
  const [kickedNotice, setKickedNotice] = useState(null);
  const [gameToast, setGameToast] = useState(null);

  // Keep playerRef updated without triggering reconnect
  useEffect(() => {
    playerRef.current = player;
  }, [player]);

  useEffect(() => {
    // Initialize single persistent Socket.IO connection to /game namespace
    const socket = io(`${SOCKET_SERVER_URL}/game`, {
      transports: ['websocket', 'polling'],
      autoConnect: true,
      reconnection: true,
      reconnectionAttempts: Infinity,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 5000
    });

    socketRef.current = socket;

    socket.on('connect', () => {
      console.log('⚡ [Socket] Connected to server, ID:', socket.id);
      setIsConnected(true);

      const currentPlayer = playerRef.current;
      const savedRoomCode = sessionStorage.getItem('active_room_code');

      if (currentPlayer?.id) {
        // Attempt authoritative session recovery
        socket.emit('recover_session', { playerId: currentPlayer.id });
      } else if (savedRoomCode && currentPlayer) {
        socket.emit('request_sync', { roomCode: savedRoomCode, playerId: currentPlayer.id });
      }
    });

    socket.on('disconnect', (reason) => {
      console.log('🔌 [Socket] Disconnected from server:', reason);
      setIsConnected(false);
    });

    // Session recovery response from backend
    socket.on('session_recovered', (data) => {
      if (data && data.room) {
        setRoomState(data.room);
        sessionStorage.setItem('active_room_code', data.room.code);
        console.log('🔄 [Socket] Restored active room session:', data.room.code);
      } else {
        sessionStorage.removeItem('active_room_code');
      }
    });

    // Authoritative room state update
    socket.on('room_state', (updatedRoom) => {
      if (updatedRoom) {
        setRoomState(updatedRoom);
        sessionStorage.setItem('active_room_code', updatedRoom.code);

        // Clear disconnect alert if all players are connected
        const hasDisconnected = updatedRoom.players.some(p => !p.isConnected);
        if (!hasDisconnected) {
          setDisconnectAlert(null);
        }
      }
    });

    // Player temporarily disconnected from lobby
    socket.on('lobby_disconnect_countdown', (data) => {
      setDisconnectAlert(data);
      sounds.playTurnAlert();
    });

    socket.on('player_connected', (data) => {
      setDisconnectAlert(prev => (prev && prev.playerId === data.playerId ? null : prev));
      showToast(`🟢 ${data.username} connected!`);
    });

    socket.on('player_disconnected', (data) => {
      showToast(`⚠️ ${data.username} lost connection`);
    });

    socket.on('player_removed_disconnect', (data) => {
      setDisconnectAlert(null);
      showToast(`⏱️ ${data.username} was removed due to disconnect timeout`);
    });

    socket.on('player_permanently_departed', (data) => {
      showToast(`👋 ${data.username} left the match permanently`);
    });

    socket.on('player_left', (data) => {
      showToast(`🚪 ${data.username} left the room`);
    });

    // Host Player Removal notification
    socket.on('kicked_from_room', (data) => {
      sessionStorage.removeItem('active_room_code');
      setRoomState(null);
      setKickedNotice(data.reason || 'You were removed from the room by the host.');
    });

    socket.on('player_kicked', (data) => {
      showToast(`👢 ${data.username} was kicked from the room`);
    });

    socket.on('room_closed', (data) => {
      sessionStorage.removeItem('active_room_code');
      setRoomState(null);
      showToast(`🔒 ${data.reason || 'The room has been closed'}`);
    });

    // Skipped turn broadcast
    socket.on('turn_skipped', (data) => {
      sounds.playTurnAlert();
      showToast(`⏱️ ${data.message || `${data.username} skipped the turn`}`);
    });

    // Game lifecycle alerts
    socket.on('game_started', () => {
      sounds.playReveal();
      showToast('🎭 Game Started! Reveal your secret roles!');
    });

    socket.on('clue_round_started', (data) => {
      sounds.playTurnAlert();
      showToast(`📝 Round ${data.round}: Clue submission has begun!`);
    });

    socket.on('voting_phase_started', () => {
      sounds.playTurnAlert();
      showToast('🗳️ Voting Phase started! Cast your vote for the Imposter!');
    });

    socket.on('game_finished', (result) => {
      sounds.playWin();
      showToast(result.winnerRole === 'IMPOSTER' ? '💥 Imposters Win!' : '🎉 Civilians Win!');
    });

    socket.on('room_returned_to_lobby', () => {
      showToast('🔄 Host returned room to lobby');
    });

    socket.on('player_username_updated', (data) => {
      showToast(`✏️ Player renamed to "${data.newUsername}"`);
    });

    socket.on('settings_updated', (newSettings) => {
      setRoomState(prev => prev ? { ...prev, settings: newSettings } : prev);
      showToast('⚙️ Game settings updated by host');
    });

    socket.on('room_categories_updated', (data) => {
      setRoomState(prev => {
        if (!prev) return prev;
        return {
          ...prev,
          settings: {
            ...prev.settings,
            categorySlugs: data.categorySlugs,
            categoryNames: data.categoryNames,
            selectedCategories: data.categorySlugs,
            categoryName: data.categoryNames?.join(', ')
          }
        };
      });
      showToast(`🏷️ Shared categories updated (${data.categorySlugs?.length || 0} selected)`);
    });

    socket.on('player_categories_updated', (data) => {
      showToast(`🏷️ ${data.username} updated categories (${data.categoriesCount} selected)`);
    });

    socket.on('error', (err) => {
      console.error('Socket Error:', err.message);
      showToast(`⚠️ ${err.message}`);
    });

    return () => {
      if (socket) socket.disconnect();
    };
  }, []); // Run ONCE on mount, NEVER disconnect when player updates profile!

  // Re-sync or recover when player profile becomes available if not yet connected
  useEffect(() => {
    if (player?.id && socketRef.current && socketRef.current.connected) {
      const savedRoomCode = sessionStorage.getItem('active_room_code');
      if (savedRoomCode) {
        socketRef.current.emit('recover_session', { playerId: player.id });
      }
    }
  }, [player?.id]);

  const showToast = (message) => {
    setGameToast(message);
    setTimeout(() => setGameToast(null), 4000);
  };

  // Emitter Actions
  const joinRoom = (roomCode, playerData) => {
    if (socketRef.current) {
      sessionStorage.setItem('active_room_code', roomCode.toUpperCase());
      socketRef.current.emit('join_room', { roomCode: roomCode.toUpperCase(), player: playerData });
    }
  };

  const leaveRoom = async (roomCode, playerId) => {
    const code = (roomCode || sessionStorage.getItem('active_room_code') || '').toUpperCase();
    sessionStorage.removeItem('active_room_code');
    setRoomState(null);
    setDisconnectAlert(null);

    if (socketRef.current && code) {
      socketRef.current.emit('leave_room', { roomCode: code, playerId });
    }
    if (code && playerId) {
      try {
        await roomApi.leaveRoom(code, playerId);
      } catch (e) {
        // Safe to ignore REST error if socket already handled it
      }
    }
  };

  const returnToLobby = (roomCode, playerId) => {
    if (socketRef.current && roomCode) {
      socketRef.current.emit('return_to_lobby', { roomCode: roomCode.toUpperCase(), playerId });
    }
  };

  const updateSettings = (roomCode, hostId, settings) => {
    if (socketRef.current) {
      socketRef.current.emit('update_settings', { roomCode, hostId, settings });
    }
  };

  const updateRoomCategories = (roomCode, playerId, categorySlugs, categoryNames) => {
    if (socketRef.current) {
      sounds.playClick();
      socketRef.current.emit('update_room_categories', {
        roomCode: (roomCode || '').toUpperCase(),
        playerId,
        categorySlugs,
        categoryNames
      });
    }
  };

  const updatePlayerCategories = updateRoomCategories;

  const updateLobbyUsername = (roomCode, playerId, newUsername) => {
    if (socketRef.current) {
      socketRef.current.emit('update_username', { playerId, newUsername });
    }
  };

  const kickPlayer = (roomCode, hostId, targetPlayerId) => {
    if (socketRef.current) {
      socketRef.current.emit('kick_player', { roomCode, hostId, targetPlayerId });
    }
  };

  const startGame = (roomCode, hostId) => {
    if (socketRef.current) {
      socketRef.current.emit('start_game', { roomCode, hostId });
    }
  };

  const submitClue = (roomCode, playerId, clue) => {
    if (socketRef.current) {
      sounds.playClick();
      socketRef.current.emit('submit_clue', { roomCode, playerId, clue });
    }
  };

  const submitVote = (roomCode, voterId, targetPlayerId) => {
    if (socketRef.current) {
      sounds.playClick();
      socketRef.current.emit('submit_vote', { roomCode, voterId, targetPlayerId });
    }
  };

  const requestSync = (roomCode, playerId) => {
    if (socketRef.current) {
      socketRef.current.emit('request_sync', { roomCode, playerId });
    }
  };

  const clearKickedNotice = () => setKickedNotice(null);

  return (
    <SocketContext.Provider
      value={{
        socket: socketRef.current,
        isConnected,
        roomState,
        setRoomState,
        disconnectAlert,
        kickedNotice,
        clearKickedNotice,
        gameToast,
        showToast,
        joinRoom,
        leaveRoom,
        returnToLobby,
        updateSettings,
        updateRoomCategories,
        updatePlayerCategories,
        updateLobbyUsername,
        kickPlayer,
        startGame,
        submitClue,
        submitVote,
        requestSync
      }}
    >
      {children}
    </SocketContext.Provider>
  );
}

export function useSocket() {
  const context = useContext(SocketContext);
  if (!context) {
    throw new Error('useSocket must be used within a SocketProvider');
  }
  return context;
}

export default SocketContext;
