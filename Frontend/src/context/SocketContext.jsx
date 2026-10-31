import React, { createContext, useContext, useEffect, useState, useRef } from 'react';
import { io } from 'socket.io-client';
import { useAuth } from './AuthContext';
import { sounds } from '../utils/sound';

const SocketContext = createContext(null);

const SOCKET_SERVER_URL = import.meta.env.VITE_SOCKET_URL || 'http://localhost:5000';

export function SocketProvider({ children }) {
  const { player } = useAuth();
  const socketRef = useRef(null);
  const [isConnected, setIsConnected] = useState(false);
  const [roomState, setRoomState] = useState(null);
  const [disconnectAlert, setDisconnectAlert] = useState(null); // { playerId, username, deadline, timeoutSeconds }
  const [kickedNotice, setKickedNotice] = useState(null);
  const [gameToast, setGameToast] = useState(null);

  useEffect(() => {
    // Initialize Socket.IO connection to /game namespace
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

      // If we have an active room stored, request authoritative state synchronization
      const savedRoomCode = sessionStorage.getItem('active_room_code');
      if (savedRoomCode && player) {
        socket.emit('request_sync', { roomCode: savedRoomCode, playerId: player.id });
      }
    });

    socket.on('disconnect', (reason) => {
      console.log('🔌 [Socket] Disconnected from server:', reason);
      setIsConnected(false);
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
      showToast(`🟢 ${data.username} reconnected!`);
    });

    socket.on('player_removed_disconnect', (data) => {
      setDisconnectAlert(null);
      showToast(`⏱️ ${data.username} was removed due to disconnect timeout`);
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

    socket.on('error', (err) => {
      console.error('Socket Error:', err.message);
      showToast(`⚠️ ${err.message}`);
    });

    return () => {
      if (socket) socket.disconnect();
    };
  }, [player]);

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

  const updateSettings = (roomCode, hostId, settings) => {
    if (socketRef.current) {
      socketRef.current.emit('update_settings', { roomCode, hostId, settings });
    }
  };

  const updateLobbyUsername = (roomCode, playerId, newUsername) => {
    if (socketRef.current) {
      socketRef.current.emit('update_lobby_username', { roomCode, playerId, newUsername });
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
        updateSettings,
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
