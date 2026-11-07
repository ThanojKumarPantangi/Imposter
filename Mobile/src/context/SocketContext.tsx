import React, { createContext, useContext, useEffect, useState, useRef, useCallback } from 'react';
import { AppState, AppStateStatus } from 'react-native';
import { io, Socket } from 'socket.io-client';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useAuth } from './AuthContext';
import { roomApi } from '../services/api/roomApi';
import { sounds } from '../utils/sound';
import { serverTimeSync } from '../utils/serverTimeSync';
import { CONFIG, STORAGE_KEYS } from '../config/constants';
import { RoomState, DisconnectAlert, RejoinRequest, RejoinState, Player, RoomSettings } from '../types';
import { restoreSessionScreen } from '../navigation/navigationService';

type RoomLifecycle = 'ACTIVE_ROOM' | 'TEMPORARILY_DISCONNECTED' | 'INTENTIONAL_EXIT' | 'NO_ROOM';

interface SocketContextType {
  socket: Socket | null;
  isConnected: boolean;
  roomState: RoomState | null;
  setRoomState: React.Dispatch<React.SetStateAction<RoomState | null>>;
  roomLifecycleState: RoomLifecycle;
  setRoomLifecycleState: (state: RoomLifecycle) => void;
  isLeaving: boolean;
  disconnectAlert: DisconnectAlert | null;
  kickedNotice: string | null;
  clearKickedNotice: () => void;
  pendingRejoinRequest: RejoinRequest | null;
  clearPendingRejoinRequest: () => void;
  rejoinState: RejoinState | null;
  setRejoinState: React.Dispatch<React.SetStateAction<RejoinState | null>>;
  clearRejoinState: () => void;
  requestRejoin: (roomCode: string, player: Player) => void;
  approveRejoin: (requestId: string, roomCode: string, hostId: string, targetPlayerId: string) => void;
  denyRejoin: (requestId: string, roomCode: string, hostId: string, targetPlayerId: string) => void;
  gameToast: string | null;
  showToast: (msg: string) => void;
  joinRoom: (roomCode: string, playerData: Player | null) => void;
  leaveRoom: (roomCode?: string, playerId?: string) => Promise<void>;
  returnToLobby: (roomCode: string, playerId?: string) => void;
  updateSettings: (roomCode: string, hostId: string, settings: Partial<RoomSettings>) => void;
  updateRoomCategories: (roomCode: string, playerId: string, categorySlugs: string[], categoryNames: string[]) => void;
  updatePlayerCategories: (roomCode: string, playerId: string, categorySlugs: string[], categoryNames: string[]) => void;
  updateLobbyUsername: (roomCode: string, playerId: string, newUsername: string) => void;
  kickPlayer: (roomCode: string, hostId: string, targetPlayerId: string) => void;
  startGame: (roomCode: string, hostId: string) => void;
  submitClue: (roomCode: string, playerId: string, clue: string) => void;
  submitVote: (roomCode: string, voterId: string, targetPlayerId: string) => void;
  submitSkipVote: (roomCode: string, voterId: string) => void;
  requestSync: (roomCode: string, playerId?: string) => void;
  serverTimeSync: typeof serverTimeSync;
}

const SocketContext = createContext<SocketContextType | null>(null);

export const SocketProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { player, refreshAuthSession } = useAuth();
  const playerRef = useRef<Player | null>(player);
  const socketRef = useRef<Socket | null>(null);
  const appStateRef = useRef<AppStateStatus>((AppState.currentState as AppStateStatus) || 'active');
  const isReconnectingRef = useRef<boolean>(false);
  const lastToastRef = useRef<{ message: string; timestamp: number }>({ message: '', timestamp: 0 });

  const [isConnected, setIsConnected] = useState<boolean>(false);
  const [roomState, setRoomState] = useState<RoomState | null>(null);
  const [disconnectAlert, setDisconnectAlert] = useState<DisconnectAlert | null>(null);
  const [kickedNotice, setKickedNotice] = useState<string | null>(null);
  const [pendingRejoinRequest, setPendingRejoinRequest] = useState<RejoinRequest | null>(null);
  const [rejoinState, setRejoinState] = useState<RejoinState | null>(null);
  const [gameToast, setGameToast] = useState<string | null>(null);

  const [roomLifecycleState, setRoomLifecycleState] = useState<RoomLifecycle>('NO_ROOM');
  const roomLifecycleRef = useRef<RoomLifecycle>('NO_ROOM');
  const isLeavingRef = useRef<boolean>(false);

  // Keep playerRef synchronized
  useEffect(() => {
    playerRef.current = player;
  }, [player]);

  // Keep roomLifecycleRef synchronized
  useEffect(() => {
    roomLifecycleRef.current = roomLifecycleState;
  }, [roomLifecycleState]);

  // Deduplicated toast notifications
  const showToast = useCallback((message: string) => {
    const now = Date.now();
    if (lastToastRef.current.message === message && now - lastToastRef.current.timestamp < 2500) {
      return; // Deduplicate rapid identical toasts
    }
    lastToastRef.current = { message, timestamp: now };
    setGameToast(message);
    setTimeout(() => {
      setGameToast((prev) => (prev === message ? null : prev));
    }, 4000);
  }, []);

  // Centralized session recovery request (strictly invoked after connection is verified)
  const recoverActiveSession = useCallback(async (socket: Socket) => {
    const currentPlayer = playerRef.current;
    const currentLifecycle = roomLifecycleRef.current;
    const savedRoomCode = await AsyncStorage.getItem(STORAGE_KEYS.ACTIVE_ROOM_CODE);

    if (currentPlayer?.id) {
      socket.emit('register_user', { playerId: currentPlayer.id });
    }

    if (currentLifecycle === 'INTENTIONAL_EXIT' || currentLifecycle === 'NO_ROOM' || !savedRoomCode) {
      return;
    }

    if (currentPlayer?.id) {
      console.log(`🔄 [Socket] Emitting recover_session for player ${currentPlayer.id} in room ${savedRoomCode}`);
      socket.emit('recover_session', {
        playerId: currentPlayer.id,
        roomCode: savedRoomCode,
      });
    } else if (savedRoomCode) {
      console.log(`🔄 [Socket] Emitting request_sync fallback for room ${savedRoomCode}`);
      socket.emit('request_sync', { roomCode: savedRoomCode });
    }
  }, []);

  // Fast foreground resume handler: validates socket vitality, reconnects if dead, and recovers session
  const handleForegroundResume = useCallback(async () => {
    const socket = socketRef.current;
    if (!socket) return;

    console.log('📱 [Foreground] App returned to active state. Verifying socket and session...');

    // If socket is disconnected, trigger immediate reconnect without waiting for backoff
    if (!socket.connected) {
      console.log('📱 [Foreground] Socket is disconnected. Forcing immediate reconnection...');
      isReconnectingRef.current = true;
      socket.connect();
      return;
    }

    // If socket claims to be connected, send probe to catch silent/zombie TCP disconnection
    let probeAcknowledged = false;
    const probeTimer = setTimeout(() => {
      if (!probeAcknowledged) {
        console.warn('⚠️ [Foreground] Socket heartbeat probe timed out. Forcing reconnection...');
        socket.disconnect();
        socket.connect();
      }
    }, 1500);

    try {
      socket.emit('sync_time', { clientSendTime: Date.now() }, (res: any) => {
        probeAcknowledged = true;
        clearTimeout(probeTimer);
        serverTimeSync.syncWithSocket(socket);

        // Socket is verified alive on network layer. Recover session immediately.
        recoverActiveSession(socket);
      });
    } catch {
      clearTimeout(probeTimer);
      socket.disconnect();
      socket.connect();
    }
  }, [recoverActiveSession]);

  // AppState monitoring for reliable Android background/foreground transitions
  useEffect(() => {
    const subscription = AppState.addEventListener('change', (nextAppState: AppStateStatus) => {
      const prevAppState = appStateRef.current;
      appStateRef.current = nextAppState;

      if (nextAppState.match(/inactive|background/)) {
        console.log(`📱 [AppState] Application moving to background (${nextAppState}). Preserving socket and session.`);
        // Note: We do NOT disconnect or destroy the socket here. We let Android manage background naturally.
      } else if (nextAppState === 'active' && prevAppState.match(/inactive|background/)) {
        console.log('📱 [AppState] Application restored to foreground (active).');
        handleForegroundResume();
      }
    });

    return () => {
      subscription.remove();
    };
  }, [handleForegroundResume]);

  // If player becomes authenticated/restored after socket already connected, register and recover
  useEffect(() => {
    if (player?.id && socketRef.current?.connected) {
      recoverActiveSession(socketRef.current);
    }
  }, [player?.id, recoverActiveSession]);

  // Main Socket Initialization (Strict Singleton pattern)
  useEffect(() => {
    let socket: Socket;

    async function initSocket() {
      // Prevent duplicate instances
      if (socketRef.current) {
        return;
      }

      const customUrl = await AsyncStorage.getItem(STORAGE_KEYS.SERVER_URL);
      const serverUrl = customUrl ? customUrl.trim().replace(/\/+$/, '') : CONFIG.SOCKET_URL;

      socket = io(`${serverUrl}/game`, {
        transports: ['websocket', 'polling'],
        autoConnect: true,
        reconnection: true,
        reconnectionAttempts: Infinity,
        reconnectionDelay: 1000,
        reconnectionDelayMax: 5000,
        randomizationFactor: 0.5,
        timeout: 10000,
      });

      socketRef.current = socket;

      socket.on('connect', async () => {
        console.log(`🔌 [Socket] Connected successfully (socket.id: ${socket.id})`);
        setIsConnected(true);
        isReconnectingRef.current = false;
        serverTimeSync.syncWithSocket(socket);

        // Attempt session recovery immediately upon connection
        await recoverActiveSession(socket);
      });

      socket.on('disconnect', (reason: string) => {
        console.log(`🔌 [Socket] Disconnected: reason = ${reason}`);
        setIsConnected(false);
        if (roomLifecycleRef.current === 'ACTIVE_ROOM') {
          roomLifecycleRef.current = 'TEMPORARILY_DISCONNECTED';
          setRoomLifecycleState('TEMPORARILY_DISCONNECTED');
        }

        // If server initiated disconnect, force reconnect attempt
        if (reason === 'io server disconnect') {
          socket.connect();
        }
      });

      socket.on('connect_error', (error: Error) => {
        setIsConnected(false);
        console.warn(`⚠️ [Socket] Connection error: ${error.message}`);
        // Socket.IO auto-reconnect handles network retries with backoff & jitter
      });

      socket.on('reconnect_attempt', (attempt: number) => {
        console.log(`🔄 [Socket] Reconnection attempt #${attempt}`);
      });

      socket.on('reconnect', () => {
        console.log('✅ [Socket] Reconnected successfully');
        setIsConnected(true);
        isReconnectingRef.current = false;
      });

      // Authoritative Session Recovery Response from Backend
      socket.on('session_recovered', async (data: any) => {
        console.log('📥 [Socket] Received session_recovered:', data?.roomCode ? `Room ${data.roomCode}` : 'No active room');
        
        if (roomLifecycleRef.current === 'INTENTIONAL_EXIT') {
          await AsyncStorage.removeItem(STORAGE_KEYS.ACTIVE_ROOM_CODE);
          return;
        }

        if (data && data.room) {
          roomLifecycleRef.current = 'ACTIVE_ROOM';
          setRoomLifecycleState('ACTIVE_ROOM');
          setRoomState(data.room);
          await AsyncStorage.setItem(STORAGE_KEYS.ACTIVE_ROOM_CODE, data.room.code);
          serverTimeSync.syncWithSocket(socket);

          // Clear any disconnect countdown alerts for self
          const currentPlayer = playerRef.current;
          setDisconnectAlert((prev) => (prev && prev.playerId === currentPlayer?.id ? null : prev));

          // Restore appropriate screen based on authoritative room status
          const targetScreen = data.room.status === 'WAITING' ? 'Lobby' : 'GameView';
          restoreSessionScreen(targetScreen, data.room.code);
        } else {
          // Backend authoritative cleanup: Player was removed or room no longer exists under backend rules
          await AsyncStorage.removeItem(STORAGE_KEYS.ACTIVE_ROOM_CODE);
          const wasActive = roomLifecycleRef.current === 'ACTIVE_ROOM' || roomLifecycleRef.current === 'TEMPORARILY_DISCONNECTED';
          roomLifecycleRef.current = 'NO_ROOM';
          setRoomLifecycleState('NO_ROOM');
          setRoomState(null);

          if (wasActive) {
            restoreSessionScreen('Home');
            showToast('Match session ended or timed out.');
          }
        }
      });

      // Authoritative Room State Updates
      socket.on('room_state', async (updatedRoom: RoomState) => {
        if (roomLifecycleRef.current === 'INTENTIONAL_EXIT' || roomLifecycleRef.current === 'NO_ROOM') {
          return;
        }

        if (updatedRoom) {
          const currentPlayer = playerRef.current;
          if (currentPlayer?.id && Array.isArray(updatedRoom.players)) {
            const isMember = updatedRoom.players.some((p) => p.id === currentPlayer.id);
            if (!isMember) {
              await AsyncStorage.removeItem(STORAGE_KEYS.ACTIVE_ROOM_CODE);
              roomLifecycleRef.current = 'NO_ROOM';
              setRoomLifecycleState('NO_ROOM');
              setRoomState(null);
              setPendingRejoinRequest(null);
              setKickedNotice('You have been removed from this room by the host.');
              restoreSessionScreen('Home');
              return;
            }
          }

          roomLifecycleRef.current = 'ACTIVE_ROOM';
          setRoomLifecycleState('ACTIVE_ROOM');
          setRoomState(updatedRoom);
          await AsyncStorage.setItem(STORAGE_KEYS.ACTIVE_ROOM_CODE, updatedRoom.code);

          const hasDisconnected = updatedRoom.players?.some((p) => !p.isConnected);
          if (!hasDisconnected) {
            setDisconnectAlert(null);
          }
        }
      });

      socket.on('lobby_disconnect_countdown', (data: DisconnectAlert) => {
        setDisconnectAlert(data);
        sounds.playTurnAlert();
      });

      socket.on('game_disconnect_countdown', (data: DisconnectAlert) => {
        setDisconnectAlert(data);
        sounds.playTurnAlert();
      });

      socket.on('game_disconnect_cancelled', (data: { playerId: string }) => {
        setDisconnectAlert((prev) => (prev && prev.playerId === data.playerId ? null : prev));
      });

      socket.on('player_connected', (data: { username: string; playerId: string }) => {
        setDisconnectAlert((prev) => (prev && prev.playerId === data.playerId ? null : prev));
        const currentPlayer = playerRef.current;
        if (data.playerId !== currentPlayer?.id) {
          showToast(`🟢 ${data.username} connected!`);
        }
      });

      socket.on('player_disconnected', (data: { username: string; playerId?: string }) => {
        const currentPlayer = playerRef.current;
        if (data.playerId !== currentPlayer?.id) {
          showToast(`⚠️ ${data.username} lost connection`);
        }
      });

      socket.on('player_removed_disconnect', (data: { username: string; playerId?: string }) => {
        setDisconnectAlert(null);
        showToast(`⏱️ ${data.username} was removed due to disconnect timeout`);
      });

      socket.on('player_permanently_departed', (data: { username: string }) => {
        showToast(`👋 ${data.username} left the match permanently`);
      });

      socket.on('player_left', (data: { username: string }) => {
        showToast(`🚪 ${data.username} left the room`);
      });

      socket.on('kicked_from_room', async (data: { reason?: string }) => {
        await AsyncStorage.removeItem(STORAGE_KEYS.ACTIVE_ROOM_CODE);
        roomLifecycleRef.current = 'NO_ROOM';
        setRoomLifecycleState('NO_ROOM');
        setRoomState(null);
        setPendingRejoinRequest(null);
        setRejoinState(null);
        setKickedNotice(data.reason || 'You have been removed from this room by the host.');
        restoreSessionScreen('Home');
      });

      socket.on('player_kicked', (data: { username: string }) => {
        showToast(`👢 ${data.username} was kicked from the room`);
      });

      socket.on('rejoin_request_received', (data: RejoinRequest) => {
        sounds.playTurnAlert();
        setPendingRejoinRequest(data);
      });

      socket.on('rejoin_request_pending', (data: { requestId: string; roomCode: string; expiresInSeconds?: number }) => {
        setRejoinState({
          status: 'PENDING',
          requestId: data.requestId,
          roomCode: data.roomCode,
          expiresInSeconds: data.expiresInSeconds || 45,
        });
      });

      socket.on('rejoin_approved', async (data: { roomCode: string; room?: RoomState; player?: Player }) => {
        sounds.playWin();
        showToast('🎉 Your rejoin request was approved by the host!');
        setRejoinState({
          status: 'APPROVED',
          roomCode: data.roomCode,
          room: data.room,
          player: data.player,
        });
        if (data.room) {
          roomLifecycleRef.current = 'ACTIVE_ROOM';
          setRoomLifecycleState('ACTIVE_ROOM');
          setRoomState(data.room);
          await AsyncStorage.setItem(STORAGE_KEYS.ACTIVE_ROOM_CODE, data.roomCode);
          restoreSessionScreen(data.room.status === 'WAITING' ? 'Lobby' : 'GameView', data.roomCode);
        }
        const currentPlayer = playerRef.current;
        if (socketRef.current && data.roomCode && currentPlayer) {
          socketRef.current.emit('join_room', { roomCode: data.roomCode, player: currentPlayer });
        }
      });

      socket.on('rejoin_denied', (data: { message?: string }) => {
        setRejoinState({
          status: 'DENIED',
          message: data.message || 'The host declined your request to join this room.',
        });
      });

      socket.on('rejoin_error', (data: { message?: string }) => {
        setRejoinState({
          status: 'ERROR',
          message: data.message || 'Could not send rejoin request.',
        });
      });

      socket.on('room_closed', async (data: { reason?: string }) => {
        await AsyncStorage.removeItem(STORAGE_KEYS.ACTIVE_ROOM_CODE);
        roomLifecycleRef.current = 'NO_ROOM';
        setRoomLifecycleState('NO_ROOM');
        setRoomState(null);
        setPendingRejoinRequest(null);
        restoreSessionScreen('Home');
        showToast(`🔒 ${data.reason || 'The room has been closed'}`);
      });

      socket.on('turn_skipped', (data: { message?: string; username?: string }) => {
        sounds.playTurnAlert();
        showToast(`⏱️ ${data.message || `${data.username} skipped the turn`}`);
      });

      socket.on('game_started', (data: any) => {
        sounds.playReveal();
        showToast('🎭 Game Started! Reveal your secret roles!');
        if (data) {
          setRoomState((prev) => {
            if (!prev) return prev;
            return {
              ...prev,
              status: data.status || 'ROLE_REVEAL',
              turnOrder: data.turnOrder || prev.turnOrder,
              settings: {
                ...prev.settings,
                ...(data.settings || {}),
                ...(data.turnDurationSeconds ? { turnDurationSeconds: data.turnDurationSeconds } : {}),
                ...(data.votingDurationSeconds ? { votingDurationSeconds: data.votingDurationSeconds } : {}),
              },
            };
          });
        }
      });

      const handleRoundStarted = (data: any) => {
        sounds.playTurnAlert();
        showToast(`📝 Round ${data?.round || 1}: Clue submission has begun!`);
        if (data) {
          setRoomState((prev) => {
            if (!prev) return prev;
            return {
              ...prev,
              status: 'CLUE_ROUND',
              currentRound: data.round || prev.currentRound,
              activeTurnPlayerId: data.activeTurnPlayerId || prev.activeTurnPlayerId,
              activeTurnIndex: data.activeTurnIndex !== undefined ? data.activeTurnIndex : prev.activeTurnIndex,
              turnDeadline: data.turnDeadline || prev.turnDeadline,
              turnOrder: data.turnOrder || prev.turnOrder,
              settings: {
                ...prev.settings,
                ...(data.settings || {}),
                ...(data.duration ? { turnDurationSeconds: data.duration } : {}),
                ...(data.turnDurationSeconds ? { turnDurationSeconds: data.turnDurationSeconds } : {}),
                ...(data.votingDurationSeconds ? { votingDurationSeconds: data.votingDurationSeconds } : {}),
              },
            };
          });
        }
      };

      socket.on('clue_round_started', handleRoundStarted);
      socket.on('round_started', handleRoundStarted);

      socket.on('turn_started', (data: any) => {
        if (data) {
          setRoomState((prev) => {
            if (!prev) return prev;
            return {
              ...prev,
              status: 'CLUE_ROUND',
              activeTurnPlayerId: data.activeTurnPlayerId || prev.activeTurnPlayerId,
              activeTurnIndex: data.activeTurnIndex !== undefined ? data.activeTurnIndex : prev.activeTurnIndex,
              turnDeadline: data.turnDeadline || prev.turnDeadline,
              turnOrder: data.turnOrder || prev.turnOrder,
              currentRound: data.round || prev.currentRound,
              settings: {
                ...prev.settings,
                ...(data.settings || {}),
                ...(data.duration ? { turnDurationSeconds: data.duration } : {}),
                ...(data.turnDurationSeconds ? { turnDurationSeconds: data.turnDurationSeconds } : {}),
              },
            };
          });
        }
      });

      const handleVotingStarted = (data: any) => {
        sounds.playTurnAlert();
        showToast('🗳️ Voting Phase started! Cast your vote for the Imposter!');
        if (data) {
          setRoomState((prev) => {
            if (!prev) return prev;
            return {
              ...prev,
              status: 'VOTING',
              turnDeadline: null,
              votingDeadline: data.votingDeadline || prev.votingDeadline,
              settings: {
                ...prev.settings,
                ...(data.settings || {}),
                ...(data.duration ? { votingDurationSeconds: data.duration } : {}),
                ...(data.votingDurationSeconds ? { votingDurationSeconds: data.votingDurationSeconds } : {}),
              },
            };
          });
        }
      };

      socket.on('voting_phase_started', handleVotingStarted);
      socket.on('voting_started', handleVotingStarted);

      socket.on('game_finished', (result: any) => {
        sounds.playWin();
        showToast(result.winnerRole === 'IMPOSTER' ? '💥 Imposters Win!' : '🎉 Civilians Win!');
      });

      socket.on('room_returned_to_lobby', () => {
        showToast('🔄 Host returned room to lobby');
      });

      socket.on('player_username_updated', (data: { newUsername: string }) => {
        showToast(`✏️ Player renamed to "${data.newUsername}"`);
      });

      socket.on('settings_updated', (newSettings: RoomSettings) => {
        setRoomState((prev) => (prev ? { ...prev, settings: newSettings } : prev));
        showToast('⚙️ Game settings updated by host');
      });

      socket.on('room_categories_updated', (data: { categorySlugs: string[]; categoryNames: string[] }) => {
        setRoomState((prev) => {
          if (!prev) return prev;
          return {
            ...prev,
            settings: {
              ...prev.settings,
              categorySlugs: data.categorySlugs,
              categoryNames: data.categoryNames,
              selectedCategories: data.categorySlugs,
              categoryName: data.categoryNames?.join(', '),
            },
          };
        });
        showToast(`🏷️ Shared categories updated (${data.categorySlugs?.length || 0} selected)`);
      });

      socket.on('player_categories_updated', (data: { username: string; categoriesCount: number }) => {
        showToast(`🏷️ ${data.username} updated categories (${data.categoriesCount} selected)`);
      });

      socket.on('error', (err: { message: string }) => {
        console.error('Socket Error:', err.message);
        showToast(`⚠️ ${err.message}`);
      });
    }

    initSocket();

    // Periodic time synchronization while connected
    const periodicSync = setInterval(() => {
      if (socketRef.current?.connected) {
        serverTimeSync.syncWithSocket(socketRef.current);
      }
    }, 20000);

    return () => {
      clearInterval(periodicSync);
      if (socketRef.current) {
        socketRef.current.disconnect();
        socketRef.current = null;
      }
    };
  }, [recoverActiveSession, showToast]);

  const joinRoom = async (roomCode: string, playerData: Player | null) => {
    if (roomLifecycleRef.current === 'INTENTIONAL_EXIT') {
      return;
    }
    if (socketRef.current && roomCode) {
      const code = roomCode.toUpperCase();
      roomLifecycleRef.current = 'ACTIVE_ROOM';
      setRoomLifecycleState('ACTIVE_ROOM');
      await AsyncStorage.setItem(STORAGE_KEYS.ACTIVE_ROOM_CODE, code);
      socketRef.current.emit('join_room', { roomCode: code, player: playerData });
    }
  };

  const leaveRoom = async (roomCode?: string, playerId?: string) => {
    if (isLeavingRef.current) return;
    isLeavingRef.current = true;

    roomLifecycleRef.current = 'INTENTIONAL_EXIT';
    setRoomLifecycleState('INTENTIONAL_EXIT');

    const savedCode = await AsyncStorage.getItem(STORAGE_KEYS.ACTIVE_ROOM_CODE);
    const code = (roomCode || savedCode || '').toUpperCase();
    const targetPlayerId = playerId || playerRef.current?.id;

    await AsyncStorage.removeItem(STORAGE_KEYS.ACTIVE_ROOM_CODE);

    setRoomState(null);
    setDisconnectAlert(null);
    setPendingRejoinRequest(null);
    setRejoinState(null);

    if (socketRef.current && code) {
      socketRef.current.emit('leave_room', { roomCode: code, playerId: targetPlayerId });
    }

    if (code && targetPlayerId) {
      try {
        await roomApi.leaveRoom(code, targetPlayerId);
      } catch {
        // Safe if already handled
      }
    }

    roomLifecycleRef.current = 'NO_ROOM';
    setRoomLifecycleState('NO_ROOM');
    isLeavingRef.current = false;
    restoreSessionScreen('Home');
  };

  const returnToLobby = (roomCode: string, playerId?: string) => {
    if (socketRef.current && roomCode) {
      socketRef.current.emit('return_to_lobby', { roomCode: roomCode.toUpperCase(), playerId });
    }
  };

  const updateSettings = (roomCode: string, hostId: string, settings: Partial<RoomSettings>) => {
    if (socketRef.current) {
      socketRef.current.emit('update_settings', { roomCode, hostId, settings });
    }
  };

  const updateRoomCategories = (
    roomCode: string,
    playerId: string,
    categorySlugs: string[],
    categoryNames: string[]
  ) => {
    if (socketRef.current) {
      sounds.playClick();
      socketRef.current.emit('update_room_categories', {
        roomCode: (roomCode || '').toUpperCase(),
        playerId,
        categorySlugs,
        categoryNames,
      });
    }
  };

  const updatePlayerCategories = updateRoomCategories;

  const updateLobbyUsername = (roomCode: string, playerId: string, newUsername: string) => {
    if (socketRef.current) {
      socketRef.current.emit('update_username', { playerId, newUsername });
    }
  };

  const kickPlayer = (roomCode: string, hostId: string, targetPlayerId: string) => {
    if (socketRef.current) {
      socketRef.current.emit('kick_player', { roomCode, hostId, targetPlayerId });
    }
  };

  const startGame = (roomCode: string, hostId: string) => {
    if (socketRef.current) {
      socketRef.current.emit('start_game', { roomCode, hostId });
    }
  };

  const submitClue = (roomCode: string, playerId: string, clue: string) => {
    if (socketRef.current) {
      sounds.playClick();
      socketRef.current.emit('submit_clue', { roomCode, playerId, clue });
    }
  };

  const submitVote = (roomCode: string, voterId: string, targetPlayerId: string) => {
    if (socketRef.current) {
      sounds.playClick();
      socketRef.current.emit('submit_vote', { roomCode, voterId, targetPlayerId });
    }
  };

  const submitSkipVote = (roomCode: string, voterId: string) => {
    if (socketRef.current) {
      sounds.playClick();
      socketRef.current.emit('submit_skip_vote', { roomCode, voterId });
    }
  };

  const requestSync = (roomCode: string, playerId?: string) => {
    if (socketRef.current) {
      socketRef.current.emit('request_sync', { roomCode, playerId });
    }
  };

  const clearKickedNotice = () => setKickedNotice(null);

  const requestRejoin = (roomCode: string, playerToRejoin: Player) => {
    if (socketRef.current && roomCode && playerToRejoin) {
      if (playerToRejoin.id) {
        socketRef.current.emit('register_user', { playerId: playerToRejoin.id });
      }
      socketRef.current.emit('request_rejoin', { roomCode: roomCode.toUpperCase(), player: playerToRejoin });
      setRejoinState({
        status: 'PENDING',
        roomCode: roomCode.toUpperCase(),
        expiresInSeconds: 45,
      });
    }
  };

  const approveRejoin = (requestId: string, roomCode: string, hostId: string, targetPlayerId: string) => {
    if (socketRef.current) {
      socketRef.current.emit('approve_rejoin', {
        requestId,
        roomCode: (roomCode || '').toUpperCase(),
        hostId,
        targetPlayerId,
      });
      setPendingRejoinRequest(null);
    }
  };

  const denyRejoin = (requestId: string, roomCode: string, hostId: string, targetPlayerId: string) => {
    if (socketRef.current) {
      socketRef.current.emit('deny_rejoin', {
        requestId,
        roomCode: (roomCode || '').toUpperCase(),
        hostId,
        targetPlayerId,
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
        submitSkipVote,
        requestSync,
        serverTimeSync,
      }}
    >
      {children}
    </SocketContext.Provider>
  );
};

export const useSocket = (): SocketContextType => {
  const context = useContext(SocketContext);
  if (!context) {
    throw new Error('useSocket must be used within a SocketProvider');
  }
  return context;
};

export default SocketContext;
