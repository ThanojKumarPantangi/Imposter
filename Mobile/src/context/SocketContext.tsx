import React, { createContext, useContext, useEffect, useState, useRef, useCallback } from 'react';
import { AppState, AppStateStatus } from 'react-native';
import { io, Socket } from 'socket.io-client';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useAuth } from './AuthContext';
import { roomApi } from '../services/api/roomApi';
import { sounds } from '../utils/sound';
import { serverTimeSync } from '../utils/serverTimeSync';
import { CONFIG, STORAGE_KEYS } from '../config/constants';
import { RoomState, DisconnectAlert, RejoinRequest, RejoinState, Player, RoomSettings, RoomStatus } from '../types';
import { restoreSessionScreen, getCurrentRouteName, replace } from '../navigation/navigationService';
import { showToast as triggerGlobalToast } from '../components/Toast';

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
  const isRecoveringSessionRef = useRef<boolean>(false);
  const lastProcessedTransitionIdRef = useRef<string | null>(null);

  const [isConnected, setIsConnected] = useState<boolean>(false);
  const [roomState, setRoomState] = useState<RoomState | null>(null);
  const roomStateRef = useRef<RoomState | null>(null);
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

  // Keep roomStateRef synchronized
  useEffect(() => {
    roomStateRef.current = roomState;
  }, [roomState]);

  // Keep roomLifecycleRef synchronized
  useEffect(() => {
    roomLifecycleRef.current = roomLifecycleState;
  }, [roomLifecycleState]);

  // Initialize roomLifecycleState from persisted storage on launch
  useEffect(() => {
    async function initPersistedRoomState() {
      try {
        const savedRoomCode = await AsyncStorage.getItem(STORAGE_KEYS.ACTIVE_ROOM_CODE);
        if (savedRoomCode && roomLifecycleRef.current === 'NO_ROOM') {
          console.log(`[SESSION-RESTORE] Found saved active room in storage: ${savedRoomCode}`);
          roomLifecycleRef.current = 'ACTIVE_ROOM';
          setRoomLifecycleState('ACTIVE_ROOM');
        }
      } catch (e: any) {
        console.warn('[SESSION-RESTORE] Error reading saved room code:', e.message);
      }
    }
    initPersistedRoomState();
  }, []);

  // Unified single global toast notifications
  const showToast = useCallback((message: string) => {
    triggerGlobalToast(message);
  }, []);

  // Centralized session recovery request (strictly invoked after connection is verified)
  const recoverActiveSession = useCallback(async (socket: Socket) => {
    if (isRecoveringSessionRef.current) {
      console.log('[SESSION-RESTORE] Session restoration already in progress. Skipping parallel call.');
      return;
    }
    isRecoveringSessionRef.current = true;

    try {
      console.log('[SESSION-RESTORE] Checking active session');
      const currentPlayer = playerRef.current;
      const currentLifecycle = roomLifecycleRef.current;
      const savedRoomCode = await AsyncStorage.getItem(STORAGE_KEYS.ACTIVE_ROOM_CODE);

      if (currentPlayer?.id) {
        socket.emit('register_user', { playerId: currentPlayer.id });
      }

      if (currentLifecycle === 'INTENTIONAL_EXIT') {
        console.log('[SESSION-RESTORE] User intentionally left room. Skipping restoration.');
        return;
      }

      if (!savedRoomCode) {
        console.log('[SESSION-RESTORE] No active session found');
        return;
      }

      console.log('[SESSION-RESTORE] Socket connection status:', socket.connected ? 'CONNECTED' : 'DISCONNECTED');
      if (!socket.connected) {
        console.log('[SESSION-RESTORE] Reconnecting socket');
        isReconnectingRef.current = true;
        socket.connect();
        return;
      }

      console.log(`[SESSION-RESTORE] Fetching latest session state for room: ${savedRoomCode}`);
      if (currentPlayer?.id) {
        socket.emit('recover_session', {
          playerId: currentPlayer.id,
          roomCode: savedRoomCode,
        });
      } else {
        socket.emit('request_sync', { roomCode: savedRoomCode });
      }
    } catch (err: any) {
      console.warn('⚠️ [SESSION-RESTORE] Error recovering session:', err.message);
    } finally {
      isRecoveringSessionRef.current = false;
    }
  }, []);

  // Fast foreground resume handler: validates socket vitality, reconnects if dead, and recovers session
  const handleForegroundResume = useCallback(async () => {
    const socket = socketRef.current;
    if (!socket) return;

    console.log('[SESSION-RESTORE] Checking active session on foreground resume');

    // If socket is disconnected, trigger immediate reconnect without waiting for backoff
    if (!socket.connected) {
      console.log('[SESSION-RESTORE] Socket connection status: DISCONNECTED');
      console.log('[SESSION-RESTORE] Reconnecting socket');
      isReconnectingRef.current = true;
      socket.connect();
      return;
    }

    console.log('[SESSION-RESTORE] Socket connection status: CONNECTED');
    // Socket is already connected. Sync time and recover session idempotently.
    try {
      serverTimeSync.syncWithSocket(socket);
      await recoverActiveSession(socket);
    } catch (err: any) {
      console.warn('⚠️ [SESSION-RESTORE] Error syncing session on foreground resume:', err.message);
    }
  }, [recoverActiveSession]);

  // AppState monitoring for reliable Android background/foreground transitions
  useEffect(() => {
    const subscription = AppState.addEventListener('change', (nextAppState: AppStateStatus) => {
      const prevAppState = appStateRef.current;
      appStateRef.current = nextAppState;

      if (nextAppState.match(/inactive|background/)) {
        console.log('[APP-LIFECYCLE] App entered background');
      } else if (nextAppState === 'active' && prevAppState.match(/inactive|background/)) {
        console.log('[APP-LIFECYCLE] App returned to foreground');
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

  // Centralized Game Phase Transition Processor (Deduplication & Single Transition Guarantee)
  const processGamePhaseTransition = useCallback(
    (
      eventName: string,
      incomingPhase: RoomStatus,
      payload: any,
      applyStateUpdate: () => void
    ) => {
      const roomCode = (payload?.roomCode || roomStateRef.current?.code || '').toUpperCase();
      const roundId = payload?.round ?? payload?.currentRound ?? roomStateRef.current?.currentRound ?? 1;
      const transitionId = `${roomCode}_${roundId}_${incomingPhase}`;

      console.log(`[GAME-PHASE] Received phase event: ${eventName}`);
      console.log(`[GAME-PHASE] Current phase: ${roomStateRef.current?.status || 'UNKNOWN'}`);
      console.log(`[GAME-PHASE] Incoming phase: ${incomingPhase}`);
      console.log(`[GAME-PHASE] Round ID: ${roundId}`);
      console.log(`[GAME-PHASE] Transition ID: ${transitionId}`);

      if (lastProcessedTransitionIdRef.current === transitionId) {
        console.log(`[GAME-PHASE] Duplicate transition ignored: ${transitionId}`);
        return;
      }

      console.log(`[GAME-PHASE] Processing valid transition: ${transitionId}`);
      lastProcessedTransitionIdRef.current = transitionId;

      // Apply authoritative state changes exactly once
      applyStateUpdate();

      // Check navigation destination and prevent redundant transitions
      const currentRoute = getCurrentRouteName();
      const destinationScreen = incomingPhase === 'WAITING' ? 'Lobby' : 'GameView';

      if (currentRoute === destinationScreen) {
        console.log(`[GAME-PHASE] Destination screen already active: ${currentRoute}`);
      } else {
        if (currentRoute === 'Lobby' && destinationScreen === 'GameView') {
          replace('GameView', { roomCode });
          console.log('[GAME-PHASE] Navigation completed: Replaced Lobby with GameView');
        } else if (currentRoute === 'GameView' && destinationScreen === 'Lobby') {
          replace('Lobby', { roomCode });
          console.log('[GAME-PHASE] Navigation completed: Replaced GameView with Lobby');
        } else {
          console.log(`[GAME-PHASE] Navigation completed: Current screen is ${currentRoute}`);
        }
      }
    },
    []
  );

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
      });

      socket.on('reconnect_attempt', (attempt: number) => {
        console.log(`🔄 [Socket] Reconnection attempt #${attempt}`);
      });

      socket.on('reconnect', async () => {
        console.log('✅ [Socket] Reconnected successfully');
        setIsConnected(true);
        isReconnectingRef.current = false;
        await recoverActiveSession(socket);
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
          roomStateRef.current = data.room;
          await AsyncStorage.setItem(STORAGE_KEYS.ACTIVE_ROOM_CODE, data.room.code);
          serverTimeSync.syncWithSocket(socket);

          // Record current transition ID to prevent duplicate phase processing on recovery
          const transitionId = `${data.room.code}_${data.room.currentRound || 1}_${data.room.status}`;
          lastProcessedTransitionIdRef.current = transitionId;

          // Clear any disconnect countdown alerts for self
          const currentPlayer = playerRef.current;
          setDisconnectAlert((prev) => (prev && prev.playerId === currentPlayer?.id ? null : prev));

          if (data.room.status === 'WAITING') {
            console.log(`[SESSION-RESTORE] Active lobby restored: ${data.room.code}`);
          } else {
            console.log(`[SESSION-RESTORE] Active game restored: ${data.room.code} (Phase: ${data.room.status})`);
          }

          // Restore appropriate screen based on authoritative room status
          const targetScreen = data.room.status === 'WAITING' ? 'Lobby' : 'GameView';
          restoreSessionScreen(targetScreen, data.room.code);
        } else {
          console.log('[SESSION-RESTORE] Session expired');
          await AsyncStorage.removeItem(STORAGE_KEYS.ACTIVE_ROOM_CODE);
          const wasActive = roomLifecycleRef.current === 'ACTIVE_ROOM' || roomLifecycleRef.current === 'TEMPORARILY_DISCONNECTED';
          roomLifecycleRef.current = 'NO_ROOM';
          setRoomLifecycleState('NO_ROOM');
          setRoomState(null);
          roomStateRef.current = null;

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
              roomStateRef.current = null;
              setPendingRejoinRequest(null);
              setKickedNotice('You have been removed from this room by the host.');
              restoreSessionScreen('Home');
              return;
            }
          }

          roomLifecycleRef.current = 'ACTIVE_ROOM';
          setRoomLifecycleState('ACTIVE_ROOM');
          setRoomState(updatedRoom);
          roomStateRef.current = updatedRoom;
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
        roomStateRef.current = null;
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
          roomStateRef.current = data.room;
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
        roomStateRef.current = null;
        setPendingRejoinRequest(null);
        restoreSessionScreen('Home');
        showToast(`🔒 ${data.reason || 'The room has been closed'}`);
      });

      socket.on('turn_skipped', (data: { message?: string; username?: string }) => {
        sounds.playTurnAlert();
        showToast(`⏱️ ${data.message || `${data.username} skipped the turn`}`);
      });

      // 1. GAME STARTED (ROLE REVEAL)
      socket.on('game_started', (data: any) => {
        processGamePhaseTransition('game_started', 'ROLE_REVEAL', data, () => {
          sounds.playReveal();
          showToast('🎭 Game Started! Reveal your secret roles!');
          if (data) {
            setRoomState((prev) => {
              if (!prev) return prev;
              const next: RoomState = {
                ...prev,
                status: 'ROLE_REVEAL',
                roleRevealDeadline: data.roleRevealDeadline || prev.roleRevealDeadline,
                turnOrder: data.turnOrder || prev.turnOrder,
                settings: {
                  ...prev.settings,
                  ...(data.settings || {}),
                  ...(data.turnDurationSeconds ? { turnDurationSeconds: data.turnDurationSeconds } : {}),
                  ...(data.votingDurationSeconds ? { votingDurationSeconds: data.votingDurationSeconds } : {}),
                },
              };
              roomStateRef.current = next;
              return next;
            });
          }
        });
      });

      // 2. ROUND RESULTS
      socket.on('round_results', (data: any) => {
        processGamePhaseTransition('round_results', 'RESULTS', data, () => {
          sounds.playTurnAlert();
          showToast('💀 Round results calculated!');
          if (data) {
            setRoomState((prev) => {
              if (!prev) return prev;
              const next: RoomState = {
                ...prev,
                status: 'RESULTS',
                eliminationResult: data,
                resultsDeadline: data.resultsDeadline || prev.resultsDeadline,
              };
              roomStateRef.current = next;
              return next;
            });
          }
        });
      });

      // 3. CLUE ROUND STARTED (Consolidated handler deduplicating clue_round_started & round_started)
      const handleRoundStarted = (eventName: string, data: any) => {
        processGamePhaseTransition(eventName, 'CLUE_ROUND', data, () => {
          sounds.playTurnAlert();
          showToast(`📝 Round ${data?.round || 1}: Clue submission has begun!`);
          if (data) {
            setRoomState((prev) => {
              if (!prev) return prev;
              const next: RoomState = {
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
              roomStateRef.current = next;
              return next;
            });
          }
        });
      };

      socket.on('clue_round_started', (data: any) => handleRoundStarted('clue_round_started', data));
      socket.on('round_started', (data: any) => handleRoundStarted('round_started', data));

      // 4. TURN STARTED (In-round progression)
      socket.on('turn_started', (data: any) => {
        if (data) {
          setRoomState((prev) => {
            if (!prev) return prev;
            const next: RoomState = {
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
            roomStateRef.current = next;
            return next;
          });
        }
      });

      // 5. VOTING STARTED (Consolidated handler deduplicating voting_phase_started & voting_started)
      const handleVotingStarted = (eventName: string, data: any) => {
        processGamePhaseTransition(eventName, 'VOTING', data, () => {
          sounds.playTurnAlert();
          showToast('🗳️ Voting Phase started! Cast your vote for the Imposter!');
          if (data) {
            setRoomState((prev) => {
              if (!prev) return prev;
              const next: RoomState = {
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
              roomStateRef.current = next;
              return next;
            });
          }
        });
      };

      socket.on('voting_phase_started', (data: any) => handleVotingStarted('voting_phase_started', data));
      socket.on('voting_started', (data: any) => handleVotingStarted('voting_started', data));

      // 6. GAME FINISHED
      socket.on('game_finished', (result: any) => {
        processGamePhaseTransition('game_finished', 'FINISHED', result, () => {
          sounds.playWin();
          showToast(result.winnerRole === 'IMPOSTER' ? '💥 Imposters Win!' : '🎉 Civilians Win!');
          setRoomState((prev) => {
            if (!prev) return prev;
            const next: RoomState = { ...prev, status: 'FINISHED' };
            roomStateRef.current = next;
            return next;
          });
        });
      });

      // 7. RETURN TO LOBBY
      socket.on('room_returned_to_lobby', (data: any) => {
        processGamePhaseTransition('room_returned_to_lobby', 'WAITING', data, () => {
          showToast('🔄 Host returned room to lobby');
          setRoomState((prev) => {
            if (!prev) return prev;
            const next: RoomState = { ...prev, status: 'WAITING' };
            roomStateRef.current = next;
            return next;
          });
        });
      });

      socket.on('player_username_updated', (data: { newUsername: string }) => {
        showToast(`✏️ Player renamed to "${data.newUsername}"`);
      });

      socket.on('settings_updated', (newSettings: RoomSettings) => {
        setRoomState((prev) => {
          if (!prev) return prev;
          const next: RoomState = { ...prev, settings: newSettings };
          roomStateRef.current = next;
          return next;
        });
        showToast('⚙️ Game settings updated by host');
      });

      socket.on('room_categories_updated', (data: { categorySlugs: string[]; categoryNames: string[] }) => {
        setRoomState((prev) => {
          if (!prev) return prev;
          const next: RoomState = {
            ...prev,
            settings: {
              ...prev.settings,
              categorySlugs: data.categorySlugs,
              categoryNames: data.categoryNames,
              selectedCategories: data.categorySlugs,
              categoryName: data.categoryNames?.join(', '),
            },
          };
          roomStateRef.current = next;
          return next;
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
  }, [recoverActiveSession, processGamePhaseTransition]);

  const joinRoom = async (roomCode: string, playerData: Player | null) => {
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
    roomStateRef.current = null;
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
