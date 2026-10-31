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
  const [pendingRejoinRequest, setPendingRejoinRequest] = useState(null); // Host approval modal: { requestId, roomCode, player }
  const [rejoinState, setRejoinState] = useState(null); // Requester state: { status: 'PENDING' | 'APPROVED' | 'DENIED' | 'TIMEOUT', requestId, roomCode, message, expiresInSeconds }
  const [gameToast, setGameToast] = useState(null);

  // Client-side room lifecycle: 'ACTIVE_ROOM' | 'TEMPORARILY_DISCONNECTED' | 'INTENTIONAL_EXIT' | 'NO_ROOM'
  const initialRoomCode = typeof sessionStorage !== 'undefined' ? sessionStorage.getItem('active_room_code') : null;
  const [roomLifecycleState, setRoomLifecycleState] = useState(
    initialRoomCode ? 'TEMPORARILY_DISCONNECTED' : 'NO_ROOM'
  );
  const roomLifecycleRef = useRef(initialRoomCode ? 'TEMPORARILY_DISCONNECTED' : 'NO_ROOM');
  const isLeavingRef = useRef(false);

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
      const currentLifecycle = roomLifecycleRef.current;
      const savedRoomCode = sessionStorage.getItem('active_room_code');

      if (currentPlayer?.id) {
        socket.emit('register_user', { playerId: currentPlayer.id });
      }

      // If user intentionally exited or has no active room, do NOT restore or rejoin
      if (currentLifecycle === 'INTENTIONAL_EXIT' || currentLifecycle === 'NO_ROOM' || !savedRoomCode) {
        return;
      }

      // Reconnect/recover only if in active room or temporarily disconnected
      if (currentPlayer?.id) {
        socket.emit('recover_session', { playerId: currentPlayer.id });
      } else if (savedRoomCode) {
        socket.emit('request_sync', { roomCode: savedRoomCode });
      }
    });

    socket.on('disconnect', (reason) => {
      console.log('🔌 [Socket] Disconnected from server:', reason);
      setIsConnected(false);
      if (roomLifecycleRef.current === 'ACTIVE_ROOM') {
        roomLifecycleRef.current = 'TEMPORARILY_DISCONNECTED';
        setRoomLifecycleState('TEMPORARILY_DISCONNECTED');
      }
    });

    // Session recovery response from backend
    socket.on('session_recovered', (data) => {
      if (roomLifecycleRef.current === 'INTENTIONAL_EXIT' || roomLifecycleRef.current === 'NO_ROOM') {
        console.log('🛑 [Socket] Discarded session_recovered because user intentionally exited or has no room');
        sessionStorage.removeItem('active_room_code');
        return;
      }

      if (data && data.room) {
        roomLifecycleRef.current = 'ACTIVE_ROOM';
        setRoomLifecycleState('ACTIVE_ROOM');
        setRoomState(data.room);
        sessionStorage.setItem('active_room_code', data.room.code);
        console.log('🔄 [Socket] Restored active room session:', data.room.code);
      } else {
        sessionStorage.removeItem('active_room_code');
        roomLifecycleRef.current = 'NO_ROOM';
        setRoomLifecycleState('NO_ROOM');
      }
    });

    // Authoritative room state update
    socket.on('room_state', (updatedRoom) => {
      if (roomLifecycleRef.current === 'INTENTIONAL_EXIT' || roomLifecycleRef.current === 'NO_ROOM') {
        console.log('🛑 [Socket] Discarded room_state because user intentionally exited');
        return;
      }

      if (updatedRoom) {
        const currentPlayer = playerRef.current;
        if (currentPlayer?.id && Array.isArray(updatedRoom.players)) {
          const isMember = updatedRoom.players.some(p => p.id === currentPlayer.id);
          if (!isMember) {
            // Player was authoritatively kicked/removed from this room
            sessionStorage.removeItem('active_room_code');
            roomLifecycleRef.current = 'NO_ROOM';
            setRoomLifecycleState('NO_ROOM');
            setRoomState(null);
            setPendingRejoinRequest(null);
            setKickedNotice('You have been removed from this room by the host.');
            return;
          }
        }

        roomLifecycleRef.current = 'ACTIVE_ROOM';
        setRoomLifecycleState('ACTIVE_ROOM');
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

    // Active game disconnect countdown and cancellation
    socket.on('game_disconnect_countdown', (data) => {
      setDisconnectAlert(data);
      sounds.playTurnAlert();
    });

    socket.on('game_disconnect_cancelled', (data) => {
      setDisconnectAlert(prev => (prev && prev.playerId === data.playerId ? null : prev));
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
      sessionStorage.removeItem('imposter_active_room');
      roomLifecycleRef.current = 'NO_ROOM';
      setRoomLifecycleState('NO_ROOM');
      setRoomState(null);
      setPendingRejoinRequest(null);
      setRejoinState(null);
      setKickedNotice(data.reason || 'You have been removed from this room by the host.');
    });

    socket.on('player_kicked', (data) => {
      showToast(`👢 ${data.username} was kicked from the room`);
    });

    // Rejoin events
    socket.on('rejoin_request_received', (data) => {
      // Host received a request from a previously kicked player
      sounds.playTurnAlert();
      setPendingRejoinRequest(data);
    });

    socket.on('rejoin_request_pending', (data) => {
      // Requester waiting for host decision
      setRejoinState({
        status: 'PENDING',
        requestId: data.requestId,
        roomCode: data.roomCode,
        expiresInSeconds: data.expiresInSeconds || 45
      });
    });

    socket.on('rejoin_approved', (data) => {
      // Requester has been approved by host
      sounds.playWin();
      showToast('🎉 Your rejoin request was approved by the host!');
      setRejoinState({
        status: 'APPROVED',
        roomCode: data.roomCode,
        room: data.room,
        player: data.player
      });
      if (data.room) {
        roomLifecycleRef.current = 'ACTIVE_ROOM';
        setRoomLifecycleState('ACTIVE_ROOM');
        setRoomState(data.room);
        sessionStorage.setItem('active_room_code', data.roomCode);
      }
      const currentPlayer = playerRef.current;
      if (socketRef.current && data.roomCode && currentPlayer) {
        socketRef.current.emit('join_room', { roomCode: data.roomCode, player: currentPlayer });
      }
    });

    socket.on('rejoin_denied', (data) => {
      // Requester was denied by host
      setRejoinState({
        status: 'DENIED',
        message: data.message || 'The host declined your request to join this room.'
      });
    });

    socket.on('rejoin_error', (data) => {
      setRejoinState({
        status: 'ERROR',
        message: data.message || 'Could not send rejoin request.'
      });
    });

    socket.on('room_closed', (data) => {
      sessionStorage.removeItem('active_room_code');
      sessionStorage.removeItem('imposter_active_room');
      roomLifecycleRef.current = 'NO_ROOM';
      setRoomLifecycleState('NO_ROOM');
      setRoomState(null);
      setPendingRejoinRequest(null);
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
      if (roomLifecycleRef.current === 'INTENTIONAL_EXIT' || roomLifecycleRef.current === 'NO_ROOM') {
        return;
      }
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
    if (roomLifecycleRef.current === 'INTENTIONAL_EXIT') {
      console.warn('⚠️ [Socket] joinRoom ignored because user is in INTENTIONAL_EXIT state');
      return;
    }
    if (socketRef.current && roomCode) {
      const code = roomCode.toUpperCase();
      roomLifecycleRef.current = 'ACTIVE_ROOM';
      setRoomLifecycleState('ACTIVE_ROOM');
      sessionStorage.setItem('active_room_code', code);
      socketRef.current.emit('join_room', { roomCode: code, player: playerData });
    }
  };

  const leaveRoom = async (roomCode, playerId) => {
    if (isLeavingRef.current) return;
    isLeavingRef.current = true;

    // 1. Immediately & synchronously mark intentional exit
    roomLifecycleRef.current = 'INTENTIONAL_EXIT';
    setRoomLifecycleState('INTENTIONAL_EXIT');

    const code = (roomCode || sessionStorage.getItem('active_room_code') || '').toUpperCase();
    const targetPlayerId = playerId || playerRef.current?.id;

    // 2. Remove persisted room references
    sessionStorage.removeItem('active_room_code');
    sessionStorage.removeItem('imposter_active_room');

    // 3. Reset room and UI states
    setRoomState(null);
    setDisconnectAlert(null);
    setPendingRejoinRequest(null);
    setRejoinState(null);

    // 4. Emit socket leave immediately
    if (socketRef.current && code) {
      socketRef.current.emit('leave_room', { roomCode: code, playerId: targetPlayerId });
    }

    // 5. Authoritative backend REST call
    if (code && targetPlayerId) {
      try {
        await roomApi.leaveRoom(code, targetPlayerId);
      } catch (e) {
        // Safe if socket already handled it or network glitch
      }
    }

    // 6. Transition to NO_ROOM
    roomLifecycleRef.current = 'NO_ROOM';
    setRoomLifecycleState('NO_ROOM');
    isLeavingRef.current = false;
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

  // Rejoin request & approval helpers
  const requestRejoin = (roomCode, player) => {
    if (socketRef.current && roomCode && player) {
      if (player.id) {
        socketRef.current.emit('register_user', { playerId: player.id });
      }
      socketRef.current.emit('request_rejoin', { roomCode: roomCode.toUpperCase(), player });
      setRejoinState({
        status: 'PENDING',
        roomCode: roomCode.toUpperCase(),
        expiresInSeconds: 45
      });
    }
  };

  const approveRejoin = (requestId, roomCode, hostId, targetPlayerId) => {
    if (socketRef.current) {
      socketRef.current.emit('approve_rejoin', {
        requestId,
        roomCode: (roomCode || '').toUpperCase(),
        hostId,
        targetPlayerId
      });
      setPendingRejoinRequest(null);
    }
  };

  const denyRejoin = (requestId, roomCode, hostId, targetPlayerId) => {
    if (socketRef.current) {
      socketRef.current.emit('deny_rejoin', {
        requestId,
        roomCode: (roomCode || '').toUpperCase(),
        hostId,
        targetPlayerId
      });
      setPendingRejoinRequest(null);
    }
  };

  const clearPendingRejoinRequest = () => setPendingRejoinRequest(null);
  const clearRejoinState = () => setRejoinState(null);

  return (
    <SocketContext.Provider
      value={{
        socket: socketRef.current,
        isConnected,
        roomState,
        setRoomState,
        roomLifecycleState,
        setRoomLifecycleState,
        isLeaving: isLeavingRef.current,
        disconnectAlert,
        kickedNotice,
        clearKickedNotice,
        pendingRejoinRequest,
        clearPendingRejoinRequest,
        rejoinState,
        setRejoinState,
        clearRejoinState,
        requestRejoin,
        approveRejoin,
        denyRejoin,
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
