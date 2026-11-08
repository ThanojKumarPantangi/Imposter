import React, { createContext, useContext, useEffect, useState, useRef, useCallback } from 'react';
import { AppState, AppStateStatus } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  RTCPeerConnection,
  RTCIceCandidate,
  RTCSessionDescription,
  mediaDevices,
} from 'react-native-webrtc';
import { useSocket } from './SocketContext';
import { useAuth } from './AuthContext';
import { CONFIG } from '../config/constants';
import { permissionService, MicPermissionStatus } from '../services/audio/permissionService';
import { audioRouteService, AudioRouteType } from '../services/audio/audioRouteService';
import { showError } from '../components/Toast';

export interface VoiceChatContextType {
  micEnabled: boolean;
  speakerEnabled: boolean;
  inVoiceRoom: boolean;
  voiceError: string | null;
  clearVoiceError: () => void;
  currentRoute: AudioRouteType;
  availableRoutes: AudioRouteType[];
  toggleMicrophone: () => Promise<void>;
  toggleSpeaker: () => Promise<void>;
  setAudioRoute: (route: AudioRouteType) => Promise<void>;
  activeSpeakerIds: string[];
}

const VoiceChatContext = createContext<VoiceChatContextType | null>(null);

const STORAGE_KEY_MIC = 'imposter_voice_mic';
const STORAGE_KEY_SPEAKER = 'imposter_voice_speaker';

const getIceServers = () => {
  const iceServers: any[] = [
    { urls: ['stun:stun.l.google.com:19302', 'stun:stun1.l.google.com:19302'] },
  ];

  if (CONFIG.TURN_URL) {
    const urls: string[] = [];
    if (CONFIG.TURN_URL.includes('?')) {
      urls.push(CONFIG.TURN_URL);
    } else {
      urls.push(`${CONFIG.TURN_URL}?transport=udp`);
      urls.push(`${CONFIG.TURN_URL}?transport=tcp`);
    }

    iceServers.push({
      urls,
      username: CONFIG.TURN_USERNAME,
      credential: CONFIG.TURN_CREDENTIAL,
    });
  }

  return { iceServers };
};

export const VoiceChatProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { socket, roomState, roomLifecycleState } = useSocket();
  const { player } = useAuth();

  const [micEnabled, setMicEnabled] = useState<boolean>(false);
  const [speakerEnabled, setSpeakerEnabled] = useState<boolean>(true);
  const [inVoiceRoom, setInVoiceRoom] = useState<boolean>(false);
  const [voiceError, setVoiceError] = useState<string | null>(null);
  const [currentRoute, setCurrentRoute] = useState<AudioRouteType>('speaker');
  const [availableRoutes, setAvailableRoutes] = useState<AudioRouteType[]>(['speaker']);
  const [activeSpeakerIds, setActiveSpeakerIds] = useState<string[]>([]);

  // Synchronous refs to prevent race conditions and stale closure traps in WebRTC callbacks
  const micEnabledRef = useRef<boolean>(false);
  const speakerEnabledRef = useRef<boolean>(true);
  const localStreamRef = useRef<any>(null);
  const peersRef = useRef<{ [peerSocketId: string]: { pc: any; playerId: string; makingOffer: boolean } }>({});
  const iceCandidateQueuesRef = useRef<{ [peerSocketId: string]: any[] }>({});
  const remoteTracksRef = useRef<{ [peerSocketId: string]: any }>({});
  const isAcquiringMicRef = useRef<boolean>(false);
  const appStateRef = useRef<AppStateStatus>((AppState.currentState as AppStateStatus) || 'active');

  // Lifecycle & Session Idempotency Refs
  const activeRoomCodeRef = useRef<string | null>(null);
  const isInitializingVoiceRef = useRef<boolean>(false);
  const hasJoinedVoiceRef = useRef<boolean>(false);
  const joinedSocketIdRef = useRef<string | null>(null);

  useEffect(() => {
    micEnabledRef.current = micEnabled;
  }, [micEnabled]);

  useEffect(() => {
    speakerEnabledRef.current = speakerEnabled;
  }, [speakerEnabled]);

  const clearVoiceError = useCallback(() => {
    setVoiceError(null);
  }, []);

  // Centralized Permission Warning Display
  const handlePermissionWarning = useCallback(
    (status: MicPermissionStatus, isUserAction: boolean = false) => {
      if (status === 'granted') {
        setVoiceError(null);
        return;
      }
      if (status === 'never_ask_again') {
        const errorMsg = 'Microphone permission permanently disabled. Enable in Settings.';
        setVoiceError(errorMsg);
        // Only show settings prompt once per 'never_ask_again' state, OR when user explicitly clicks Mic
        if (isUserAction || !permissionService.hasWarned('never_ask_again')) {
          permissionService.setWarned('never_ask_again', true);
          permissionService.promptSettingsRedirect();
        }
      } else if (status === 'denied') {
        const errorMsg = 'Microphone permission required for voice chat.';
        setVoiceError(errorMsg);
        if (isUserAction || !permissionService.hasWarned('denied')) {
          permissionService.setWarned('denied', true);
          showError(errorMsg);
        }
      }
    },
    []
  );

  // Load persisted audio preferences on startup
  useEffect(() => {
    async function loadPreferences() {
      try {
        const savedMic = await AsyncStorage.getItem(STORAGE_KEY_MIC);
        const savedSpeaker = await AsyncStorage.getItem(STORAGE_KEY_SPEAKER);
        if (savedMic !== null) {
          const val = savedMic === 'true';
          setMicEnabled(val);
          micEnabledRef.current = val;
        }
        if (savedSpeaker !== null) {
          const val = savedSpeaker !== 'false';
          setSpeakerEnabled(val);
          speakerEnabledRef.current = val;
        }
      } catch (err) {
        console.warn('[AUDIO] Error loading audio preferences:', err);
      }
    }
    loadPreferences();
  }, []);

  // Listen to native Android audio route changes and audio interruptions
  useEffect(() => {
    const unsubRoute = audioRouteService.addRouteChangeListener((info) => {
      console.log(`[AUDIO-ROUTE] Native route update -> current: ${info.currentRoute}`);
      setCurrentRoute(info.currentRoute);
      setAvailableRoutes(info.availableRoutes);
    });

    const unsubInterruption = audioRouteService.addInterruptionListener((data) => {
      console.log(`[AUDIO] Audio interruption event: ${data.event}`);
      if (data.event === 'focus_lost') {
        // Temporarily pause microphone transmission on focus loss
        if (localStreamRef.current) {
          const track = localStreamRef.current.getAudioTracks()[0];
          if (track) track.enabled = false;
        }
      } else if (data.event === 'focus_gained') {
        // Restore microphone transmission if user still has mic ON
        if (localStreamRef.current && micEnabledRef.current) {
          const track = localStreamRef.current.getAudioTracks()[0];
          if (track) track.enabled = true;
        }
      }
    });

    return () => {
      unsubRoute();
      unsubInterruption();
    };
  }, []);

  // Attach local audio track across all active RTCPeerConnections
  const attachTrackToAllPeers = useCallback(async (audioTrack: any) => {
    if (!audioTrack) return;
    console.log(`[WEBRTC] Attaching local audio track (${audioTrack.id}) across all active peers...`);

    for (const [peerSocketId, peer] of Object.entries(peersRef.current)) {
      const { pc } = peer;
      try {
        const transceivers = pc.getTransceivers ? pc.getTransceivers() : [];
        const transceiver = transceivers.find(
          (t: any) => t.receiver?.track?.kind === 'audio' || t.sender?.track?.kind === 'audio'
        );

        if (transceiver && transceiver.sender) {
          if (transceiver.direction !== 'sendrecv') {
            transceiver.direction = 'sendrecv';
          }
          await transceiver.sender.replaceTrack(audioTrack);
          console.log(`[WEBRTC] Replaced audio track for peer ${peerSocketId}`);
        } else {
          const senders = pc.getSenders ? pc.getSenders() : [];
          const sender = senders.find((s: any) => s.track?.kind === 'audio' || !s.track);
          if (sender) {
            await sender.replaceTrack(audioTrack);
            console.log(`[WEBRTC] Replaced track on existing sender for peer ${peerSocketId}`);
          } else if (localStreamRef.current) {
            pc.addTrack(audioTrack, localStreamRef.current);
            console.log(`[WEBRTC] Added new track to pc for peer ${peerSocketId}`);
          }
        }
      } catch (err: any) {
        console.warn(`[WEBRTC] Error attaching audio track to peer ${peerSocketId}:`, err.message);
      }
    }
  }, []);

  // Acquire local microphone stream via react-native-webrtc mediaDevices
  const acquireLocalStream = useCallback(async (): Promise<any> => {
    if (isAcquiringMicRef.current) return localStreamRef.current;
    isAcquiringMicRef.current = true;

    try {
      // Check existing stream vitality
      const existingStream = localStreamRef.current;
      const existingTrack = existingStream?.getAudioTracks()[0];
      if (existingStream && existingTrack && existingTrack.readyState === 'live') {
        existingTrack.enabled = micEnabledRef.current;
        await attachTrackToAllPeers(existingTrack);
        return existingStream;
      }

      console.log('[MIC] Requesting local media stream from react-native-webrtc mediaDevices...');
      let stream: any;
      try {
        stream = (await mediaDevices.getUserMedia({
          audio: {
            echoCancellation: true,
            noiseSuppression: true,
            autoGainControl: true,
          } as any,
          video: false,
        })) as any;
      } catch (e: any) {
        console.warn('[MIC] Audio constraints getUserMedia fallback to { audio: true }:', e.message);
        stream = (await mediaDevices.getUserMedia({
          audio: true,
          video: false,
        })) as any;
      }

      localStreamRef.current = stream;
      const audioTrack = stream.getAudioTracks()[0];
      if (audioTrack) {
        audioTrack.enabled = micEnabledRef.current;
        console.log(`[MIC] Local microphone track acquired: id=${audioTrack.id}, enabled=${audioTrack.enabled}`);
        await attachTrackToAllPeers(audioTrack);
      }

      return stream;
    } catch (err: any) {
      console.error('[MIC] Failed to acquire microphone stream:', err.message);
      throw err;
    } finally {
      isAcquiringMicRef.current = false;
    }
  }, [attachTrackToAllPeers]);

  // Flush queued ICE candidates that arrived before setRemoteDescription
  const flushQueuedCandidates = useCallback(async (peerSocketId: string) => {
    const peer = peersRef.current[peerSocketId];
    const queue = iceCandidateQueuesRef.current[peerSocketId];
    if (peer && peer.pc && queue && queue.length > 0) {
      const candidates = [...queue];
      iceCandidateQueuesRef.current[peerSocketId] = [];
      console.log(`[WEBRTC] Flushing ${candidates.length} queued ICE candidates for peer ${peerSocketId}`);
      for (const cand of candidates) {
        try {
          await peer.pc.addIceCandidate(new RTCIceCandidate(cand));
        } catch (e: any) {
          console.warn('[WEBRTC] Error applying queued ICE candidate:', e.message);
        }
      }
    }
  }, []);

  // Cleanup single peer connection
  const cleanupPeer = useCallback((peerSocketId: string) => {
    if (peersRef.current[peerSocketId]) {
      console.log(`[WEBRTC] Closing peer connection for peerSocketId: ${peerSocketId}`);
      try {
        peersRef.current[peerSocketId].pc.close();
      } catch (e: any) {
        console.warn(`[WEBRTC] Error closing pc for ${peerSocketId}:`, e.message);
      }
      delete peersRef.current[peerSocketId];
    }
    delete remoteTracksRef.current[peerSocketId];
    delete iceCandidateQueuesRef.current[peerSocketId];
  }, []);

  // Cleanup all peer connections and release local audio resources (only on actual exit)
  const cleanupAllPeers = useCallback(() => {
    console.log('[WEBRTC] Cleaning up all voice peers and releasing audio session...');
    Object.keys(peersRef.current).forEach(cleanupPeer);
    peersRef.current = {};
    remoteTracksRef.current = {};
    iceCandidateQueuesRef.current = {};

    if (localStreamRef.current) {
      try {
        localStreamRef.current.getTracks().forEach((t: any) => {
          t.enabled = false;
          t.stop();
        });
      } catch (e: any) {
        console.warn('[MIC] Error stopping local tracks:', e.message);
      }
      localStreamRef.current = null;
    }

    activeRoomCodeRef.current = null;
    hasJoinedVoiceRef.current = false;
    joinedSocketIdRef.current = null;
    isInitializingVoiceRef.current = false;
    setInVoiceRoom(false);
    audioRouteService.stopVoipSession().catch(() => {});
  }, [cleanupPeer]);

  // Create or retrieve an RTCPeerConnection for a remote peer
  const getOrCreatePeerConnection = useCallback(
    (peerSocketId: string, peerPlayerId: string): any => {
      if (peersRef.current[peerSocketId]) {
        return peersRef.current[peerSocketId].pc;
      }

      // Clean up any stale peer connection for the SAME player from prior socket ID
      for (const [oldSocketId, existingPeer] of Object.entries(peersRef.current)) {
        if (existingPeer.playerId === peerPlayerId && oldSocketId !== peerSocketId) {
          console.log(`[WEBRTC] Removing stale peer connection for player ${peerPlayerId} (old socket: ${oldSocketId})`);
          cleanupPeer(oldSocketId);
        }
      }

      try {
        console.log(`[WEBRTC] Creating new RTCPeerConnection for peer ${peerSocketId} (player ${peerPlayerId})`);
        const pc = new (RTCPeerConnection as any)(getIceServers());

        // Attach local audio track if available (enabled=true if mic is on, enabled=false if mic is muted)
        const audioTrack = localStreamRef.current?.getAudioTracks()[0];
        if (audioTrack && audioTrack.readyState === 'live') {
          pc.addTrack(audioTrack, localStreamRef.current);
          console.log(`[WEBRTC] Attached local mic track to new peer ${peerSocketId} (enabled: ${audioTrack.enabled})`);
        } else {
          // Add audio transceiver upfront with sendrecv direction so SDP offer/answer includes the m=audio section
          try {
            pc.addTransceiver('audio', { direction: 'sendrecv' });
          } catch (e: any) {
            console.warn('[WEBRTC] Could not add audio transceiver upfront:', e.message);
          }
        }

        // ICE Candidate Generation
        pc.onicecandidate = (event: any) => {
          if (event.candidate && socket?.connected) {
            socket.emit('voice_signal_ice_candidate', {
              targetSocketId: peerSocketId,
              candidate: event.candidate,
              senderId: player?.id,
            });
          }
        };

        // Connection State Monitoring & Recovery
        pc.onconnectionstatechange = () => {
          console.log(`[WEBRTC] Peer ${peerSocketId} connectionState: ${pc.connectionState}`);
          if (pc.connectionState === 'failed') {
            try {
              if (typeof pc.restartIce === 'function') {
                pc.restartIce();
              }
            } catch {
              // ignore
            }
          }
        };

        // Remote Audio Track Received (Hardware Playback)
        pc.ontrack = (event: any) => {
          console.log(`[AUDIO] ontrack received from peer ${peerSocketId}, track kind: ${event.track?.kind}`);
          if (event.track) {
            remoteTracksRef.current[peerSocketId] = event.track;
            // Synchronize remote track playback with current speaker/deafen state
            event.track.enabled = speakerEnabledRef.current;
            console.log(`[AUDIO] Remote audio track configured: enabled=${event.track.enabled}`);
          }
        };

        peersRef.current[peerSocketId] = {
          pc,
          playerId: peerPlayerId,
          makingOffer: false,
        };

        return pc;
      } catch (err: any) {
        console.error(`[WEBRTC] Failed to create RTCPeerConnection for peer ${peerSocketId}:`, err);
        return null;
      }
    },
    [socket, player?.id, cleanupPeer]
  );

  // Centralized Idempotent Voice Session Initializer
  const initVoiceSession = useCallback(
    async (forceReconnect: boolean = false) => {
      if (!socket || !roomState?.code || !player?.id) return;
      const targetRoomCode = roomState.code;

      // Prevent concurrent initializations
      if (isInitializingVoiceRef.current) {
        console.log('[VOICE] Voice initialization already in progress. Skipping parallel execution.');
        return;
      }

      // Idempotency: if already joined this room with the current socket ID and not forced, preserve session
      if (
        !forceReconnect &&
        hasJoinedVoiceRef.current &&
        activeRoomCodeRef.current === targetRoomCode &&
        joinedSocketIdRef.current === socket.id
      ) {
        console.log(`[VOICE] Voice session already active for room ${targetRoomCode} (socket: ${socket.id}). Preserving session.`);
        return;
      }

      isInitializingVoiceRef.current = true;
      activeRoomCodeRef.current = targetRoomCode;

      try {
        console.log(`[VOICE] Initializing voice session for room ${targetRoomCode} (player ${player.id}, socket ${socket.id})...`);

        // Initialize Native Android Audio Session in VoIP mode
        try {
          await audioRouteService.startVoipSession();
          await audioRouteService.setSpeakerphoneOn(speakerEnabledRef.current);
        } catch (err: any) {
          console.warn('[AUDIO-ROUTE] Error initializing VoIP audio session:', err.message);
        }

        // Centralized microphone permission check
        try {
          let hasPermission = await permissionService.checkMicrophonePermission();
          if (!hasPermission && micEnabledRef.current) {
            // Only request if mic preference was on and permission not already permanently denied
            if (permissionService.getStatus() !== 'never_ask_again') {
              const status = await permissionService.requestMicrophonePermission();
              hasPermission = status === 'granted';
              handlePermissionWarning(status, false);
            } else {
              handlePermissionWarning('never_ask_again', false);
            }
          }

          if (hasPermission) {
            await acquireLocalStream();
          } else if (micEnabledRef.current) {
            console.warn('[MIC] Mic was saved as ON but permission not granted. Resetting to OFF.');
            setMicEnabled(false);
            micEnabledRef.current = false;
            await AsyncStorage.setItem(STORAGE_KEY_MIC, 'false');
          }
        } catch (err: any) {
          console.warn('[MIC] Could not acquire local mic stream on room join:', err.message);
        }

        // Join voice signaling room on backend
        if (socket.connected) {
          console.log(`[VOICE] Emitting voice_signal_join for room ${targetRoomCode}`);
          socket.emit('voice_signal_join', { roomCode: targetRoomCode, playerId: player.id });
          hasJoinedVoiceRef.current = true;
          joinedSocketIdRef.current = socket.id ?? null;
        }
      } finally {
        isInitializingVoiceRef.current = false;
      }
    },
    [socket, roomState?.code, player?.id, acquireLocalStream, handlePermissionWarning]
  );

  // Centralized recheck of permission when app resumes (e.g. from Android Settings)
  const recheckPermissionOnResume = useCallback(async () => {
    try {
      const hasPerm = await permissionService.checkMicrophonePermission();
      if (hasPerm) {
        console.log('[MIC] Microphone permission detected as granted upon foreground resume.');
        setVoiceError(null);
        permissionService.resetWarnings();
        if (micEnabledRef.current) {
          const stream = await acquireLocalStream();
          const audioTrack = stream?.getAudioTracks()[0];
          if (audioTrack) {
            audioTrack.enabled = true;
            await attachTrackToAllPeers(audioTrack);
          }
        }
      }
    } catch (err: any) {
      console.warn('[MIC] Error rechecking permission on resume:', err.message);
    }
  }, [acquireLocalStream, attachTrackToAllPeers]);

  // Main Voice Room Lifecycle Effect
  useEffect(() => {
    const isOutOfRoom =
      !socket ||
      !roomState?.code ||
      !player?.id ||
      roomLifecycleState === 'INTENTIONAL_EXIT' ||
      roomLifecycleState === 'NO_ROOM';

    if (isOutOfRoom) {
      if (roomLifecycleState === 'INTENTIONAL_EXIT' || roomLifecycleState === 'NO_ROOM') {
        AsyncStorage.removeItem(STORAGE_KEY_MIC).catch(() => {});
        AsyncStorage.removeItem(STORAGE_KEY_SPEAKER).catch(() => {});
        setMicEnabled(false);
        micEnabledRef.current = false;
        setSpeakerEnabled(true);
        speakerEnabledRef.current = true;
      }
      if (activeRoomCodeRef.current || hasJoinedVoiceRef.current) {
        cleanupAllPeers();
      }
      return;
    }

    // Preserve peer connections during temporary network drops
    if (roomLifecycleState === 'TEMPORARILY_DISCONNECTED') {
      console.log('[VOICE] Room temporarily disconnected. Preserving peer connections for recovery...');
      return;
    }

    // If room code changed to a DIFFERENT room, clean up old room first
    if (activeRoomCodeRef.current && activeRoomCodeRef.current !== roomState.code) {
      console.log(`[VOICE] Switching voice room from ${activeRoomCodeRef.current} to ${roomState.code}`);
      cleanupAllPeers();
    }

    setInVoiceRoom(true);

    // Initialize voice session only if not already joined for this room and socket
    if (
      !hasJoinedVoiceRef.current ||
      activeRoomCodeRef.current !== roomState.code ||
      joinedSocketIdRef.current !== socket.id
    ) {
      initVoiceSession();
    }

    // 1. Authoritative Voice Participants List from Backend
    const handleVoiceParticipantsList = async ({ participants }: { participants: any[] }) => {
      console.log(`[VOICE] Received voice_participants_list with ${participants?.length || 0} participants`);
      if (!Array.isArray(participants)) return;

      for (const p of participants) {
        const targetSocketId = p.socketId || p.peerSocketId;
        if (!targetSocketId || targetSocketId === socket.id) continue;

        // Clean up any stale peer for this player
        if (p.playerId) {
          for (const [oldSocketId, existingPeer] of Object.entries(peersRef.current)) {
            if (existingPeer.playerId === p.playerId && oldSocketId !== targetSocketId) {
              cleanupPeer(oldSocketId);
            }
          }
        }

        // Initialize peer connection so it is ready for incoming/outgoing offers
        getOrCreatePeerConnection(targetSocketId, p.playerId);
      }
    };

    // 2. Another Peer Joined -> Initiate WebRTC Offer
    const handlePeerJoined = async ({ peerSocketId, playerId }: { peerSocketId: string; playerId: string }) => {
      if (!peerSocketId || peerSocketId === socket.id) return;
      console.log(`[VOICE] New peer joined voice: ${playerId} (socket: ${peerSocketId}). Creating offer...`);

      try {
        const pc = getOrCreatePeerConnection(peerSocketId, playerId);
        if (!pc) return;
        const peer = peersRef.current[peerSocketId];
        if (peer) peer.makingOffer = true;

        const offer = await pc.createOffer();
        await pc.setLocalDescription(offer);

        socket.emit('voice_signal_offer', {
          targetSocketId: peerSocketId,
          offer,
          callerId: player.id,
        });
        console.log(`[WEBRTC] Sent voice_signal_offer to ${peerSocketId}`);
      } catch (err: any) {
        console.error('[WEBRTC] Error creating voice offer:', err.message);
      } finally {
        if (peersRef.current[peerSocketId]) {
          peersRef.current[peerSocketId].makingOffer = false;
        }
      }
    };

    // 3. Incoming Offer from Remote Peer -> Create Answer
    const handleSignalOffer = async ({
      callerSocketId,
      callerId,
      offer,
    }: {
      callerSocketId: string;
      callerId: string;
      offer: any;
    }) => {
      if (!callerSocketId || callerSocketId === socket.id) return;
      console.log(`[WEBRTC] Received voice_signal_offer from caller ${callerId} (${callerSocketId})`);

      try {
        const pc = getOrCreatePeerConnection(callerSocketId, callerId);
        if (!pc) return;
        const peer = peersRef.current[callerSocketId];

        // Polite Peer Glare Resolution
        const isPolite = player?.id && callerId ? player.id.localeCompare(callerId) > 0 : false;
        const offerCollision = pc.signalingState !== 'stable' || (peer && peer.makingOffer);

        if (offerCollision) {
          if (!isPolite) {
            console.log(`[WEBRTC] Glare collision: impolite peer ignoring offer from ${callerSocketId}`);
            return;
          }
          console.log(`[WEBRTC] Glare collision: polite peer rolling back for offer from ${callerSocketId}`);
          await pc.setLocalDescription({ type: 'rollback' as any });
        }

        await pc.setRemoteDescription(new RTCSessionDescription(offer));
        await flushQueuedCandidates(callerSocketId);

        // Ensure our audio track is attached if mic is ON
        const audioTrack = localStreamRef.current?.getAudioTracks()[0];
        if (audioTrack && audioTrack.readyState === 'live' && micEnabledRef.current) {
          const transceivers = pc.getTransceivers ? pc.getTransceivers() : [];
          const transceiver = transceivers.find(
            (t: any) => t.receiver?.track?.kind === 'audio' || t.sender?.track?.kind === 'audio'
          );
          if (transceiver && transceiver.sender) {
            if (transceiver.direction !== 'sendrecv') {
              transceiver.direction = 'sendrecv';
            }
            await transceiver.sender.replaceTrack(audioTrack);
          } else {
            const senders = pc.getSenders ? pc.getSenders() : [];
            const sender = senders.find((s: any) => s.track?.kind === 'audio');
            if (sender) {
              await sender.replaceTrack(audioTrack);
            }
          }
        }

        const answer = await pc.createAnswer();
        await pc.setLocalDescription(answer);

        socket.emit('voice_signal_answer', {
          targetSocketId: callerSocketId,
          answer,
          responderId: player.id,
        });
        console.log(`[WEBRTC] Sent voice_signal_answer to ${callerSocketId}`);
      } catch (err: any) {
        console.error('[WEBRTC] Error answering voice offer:', err.message);
      }
    };

    // 4. Incoming Answer from Remote Peer
    const handleSignalAnswer = async ({
      responderSocketId,
      answer,
    }: {
      responderSocketId: string;
      answer: any;
    }) => {
      console.log(`[WEBRTC] Received voice_signal_answer from ${responderSocketId}`);
      try {
        const peer = peersRef.current[responderSocketId];
        if (peer && peer.pc) {
          if (peer.pc.signalingState === 'have-local-offer') {
            await peer.pc.setRemoteDescription(new RTCSessionDescription(answer));
            await flushQueuedCandidates(responderSocketId);
            console.log(`[WEBRTC] Remote description set successfully for ${responderSocketId}`);
          } else {
            console.warn(`[WEBRTC] Ignoring answer in state: ${peer.pc.signalingState}`);
          }
        }
      } catch (err: any) {
        console.error('[WEBRTC] Error setting remote description from answer:', err.message);
      }
    };

    // 5. Incoming ICE Candidate
    const handleSignalIceCandidate = async ({
      senderSocketId,
      candidate,
    }: {
      senderSocketId: string;
      candidate: any;
    }) => {
      try {
        if (!candidate) return;
        const peer = peersRef.current[senderSocketId];
        if (peer && peer.pc && peer.pc.remoteDescription && peer.pc.remoteDescription.type) {
          await peer.pc.addIceCandidate(new RTCIceCandidate(candidate));
        } else {
          if (!iceCandidateQueuesRef.current[senderSocketId]) {
            iceCandidateQueuesRef.current[senderSocketId] = [];
          }
          iceCandidateQueuesRef.current[senderSocketId].push(candidate);
        }
      } catch (err: any) {
        console.warn('[WEBRTC] Error adding ICE candidate:', err.message);
      }
    };

    // 6. Remote Peer Left
    const handlePeerLeft = ({ peerSocketId, playerId }: { peerSocketId: string; playerId?: string }) => {
      console.log(`[VOICE] Peer left: socket=${peerSocketId}, playerId=${playerId}`);
      if (peerSocketId) cleanupPeer(peerSocketId);
      if (playerId) {
        for (const [sId, p] of Object.entries(peersRef.current)) {
          if (p.playerId === playerId) {
            cleanupPeer(sId);
          }
        }
      }
    };

    // 7. Socket Reconnection -> Re-verify Voice Peers without recreating if socket ID didn't change
    const handleSocketConnect = () => {
      console.log(`[VOICE] Socket reconnected (${socket.id}). Re-verifying voice room peers...`);
      if (roomState?.code && player?.id) {
        initVoiceSession(true);
      }
    };

    socket.on('voice_participants_list', handleVoiceParticipantsList);
    socket.on('voice_peer_joined', handlePeerJoined);
    socket.on('voice_signal_offer', handleSignalOffer);
    socket.on('voice_signal_answer', handleSignalAnswer);
    socket.on('voice_signal_ice_candidate', handleSignalIceCandidate);
    socket.on('voice_peer_left', handlePeerLeft);
    socket.on('connect', handleSocketConnect);

    return () => {
      socket.off('voice_participants_list', handleVoiceParticipantsList);
      socket.off('voice_peer_joined', handlePeerJoined);
      socket.off('voice_signal_offer', handleSignalOffer);
      socket.off('voice_signal_answer', handleSignalAnswer);
      socket.off('voice_signal_ice_candidate', handleSignalIceCandidate);
      socket.off('voice_peer_left', handlePeerLeft);
      socket.off('connect', handleSocketConnect);

      // NOTE: We do NOT call cleanupAllPeers() here.
      // WebRTC peer connections and native VoIP session are preserved across
      // screen transitions (e.g. Lobby <-> GameView) and component re-renders.
      // Only actual room exits or session ends clean up peer connections.
    };
  }, [
    socket,
    roomState?.code,
    player?.id,
    roomLifecycleState,
    getOrCreatePeerConnection,
    initVoiceSession,
    cleanupPeer,
    cleanupAllPeers,
    flushQueuedCandidates,
  ]);

  // Provider Unmount Cleanup (App teardown)
  useEffect(() => {
    return () => {
      cleanupAllPeers();
    };
  }, [cleanupAllPeers]);

  // AppState monitoring for Idempotent Voice Session Recovery & Permission Recheck
  useEffect(() => {
    const subscription = AppState.addEventListener('change', async (nextAppState: AppStateStatus) => {
      const prevAppState = appStateRef.current;
      appStateRef.current = nextAppState;

      if (nextAppState === 'active' && prevAppState.match(/inactive|background/)) {
        console.log('[VOICE] Returned to foreground. Idempotent audio routing & permission verification...');

        // 1. Recheck microphone permission in case user granted it in Android Settings
        await recheckPermissionOnResume();

        // 2. If in active room, verify audio routing idempotently without destroying peer connections
        if (roomState?.code && player?.id && socket?.connected) {
          audioRouteService.startVoipSession().then(() => {
            audioRouteService.setSpeakerphoneOn(speakerEnabledRef.current);
          }).catch(() => {});

          // If socket.id changed while backgrounded, re-join voice signaling idempotently
          if (joinedSocketIdRef.current !== socket.id) {
            initVoiceSession(true);
          } else {
            // Re-synchronize mute state over Socket.IO
            socket.emit('voice_mute_state', {
              roomCode: roomState.code,
              playerId: player.id,
              isMuted: !micEnabledRef.current,
              isDeafened: !speakerEnabledRef.current,
            });
          }
        }
      }
    });

    return () => {
      subscription.remove();
    };
  }, [roomState?.code, player?.id, socket, recheckPermissionOnResume, initVoiceSession]);

  // Toggle Microphone (Default OFF -> ON)
  const toggleMicrophone = async () => {
    try {
      setVoiceError(null);

      if (!micEnabledRef.current) {
        // Turning Mic ON
        console.log('[MIC] User requested microphone UNMUTE');

        // Check runtime permission centrally
        let hasPermission = await permissionService.checkMicrophonePermission();
        if (!hasPermission) {
          const status = await permissionService.requestMicrophonePermission();
          if (status !== 'granted') {
            // User explicitly requested unmute, show settings prompt or error
            handlePermissionWarning(status, true);
            return;
          }
          hasPermission = true;
        }

        // Acquire local stream & enable track
        const stream = await acquireLocalStream();
        const audioTrack = stream?.getAudioTracks()[0];
        if (audioTrack) {
          audioTrack.enabled = true;
          await attachTrackToAllPeers(audioTrack);

          // Renegotiate with peers if needed
          for (const [peerSocketId, peer] of Object.entries(peersRef.current)) {
            const { pc } = peer;
            const transceivers = pc.getTransceivers ? pc.getTransceivers() : [];
            const transceiver = transceivers.find(
              (t: any) => t.receiver?.track?.kind === 'audio' || t.sender?.track?.kind === 'audio'
            );
            const needsRenegotiate =
              !transceiver ||
              transceiver.currentDirection === 'recvonly' ||
              transceiver.currentDirection === 'inactive';

            if (needsRenegotiate && pc.signalingState === 'stable') {
              try {
                const offer = await pc.createOffer();
                await pc.setLocalDescription(offer);
                socket?.emit('voice_signal_offer', {
                  targetSocketId: peerSocketId,
                  offer,
                  callerId: player?.id,
                });
                console.log(`[WEBRTC] Sent renegotiated offer to ${peerSocketId} upon unmuting mic`);
              } catch (err: any) {
                console.warn(`[WEBRTC] Error renegotiating offer for ${peerSocketId}:`, err.message);
              }
            }
          }
        }

        setMicEnabled(true);
        micEnabledRef.current = true;
        await AsyncStorage.setItem(STORAGE_KEY_MIC, 'true');

        if (socket && roomState?.code && player?.id) {
          socket.emit('voice_mute_state', {
            roomCode: roomState.code,
            playerId: player.id,
            isMuted: false,
            isDeafened: !speakerEnabledRef.current,
          });
        }
        console.log('[MIC] Microphone successfully unmuted');
      } else {
        // Turning Mic OFF (Mute)
        console.log('[MIC] User requested microphone MUTE');
        if (localStreamRef.current) {
          const audioTrack = localStreamRef.current.getAudioTracks()[0];
          if (audioTrack) {
            audioTrack.enabled = false;
          }
        }

        setMicEnabled(false);
        micEnabledRef.current = false;
        await AsyncStorage.setItem(STORAGE_KEY_MIC, 'false');

        if (socket && roomState?.code && player?.id) {
          socket.emit('voice_mute_state', {
            roomCode: roomState.code,
            playerId: player.id,
            isMuted: true,
            isDeafened: !speakerEnabledRef.current,
          });
        }
        console.log('[MIC] Microphone successfully muted');
      }
    } catch (err: any) {
      console.error('[MIC] Error toggling microphone:', err);
      const msg = err.message || 'Microphone error';
      setVoiceError(msg);
      showError(msg);
      setMicEnabled(false);
      micEnabledRef.current = false;
    }
  };

  // Toggle Speaker / Deafen (Default ON -> OFF)
  const toggleSpeaker = async () => {
    try {
      const nextState = !speakerEnabledRef.current;
      console.log(`[AUDIO] User toggled speaker: ${nextState ? 'Audio ON' : 'Deafened'}`);

      // Update hardware routing
      await audioRouteService.setSpeakerphoneOn(nextState);

      // Silence or enable all remote audio tracks
      for (const [peerSocketId, track] of Object.entries(remoteTracksRef.current)) {
        if (track) {
          track.enabled = nextState;
          console.log(`[AUDIO] Remote track for ${peerSocketId} set enabled=${nextState}`);
        }
      }

      setSpeakerEnabled(nextState);
      speakerEnabledRef.current = nextState;
      await AsyncStorage.setItem(STORAGE_KEY_SPEAKER, String(nextState));

      if (socket && roomState?.code && player?.id) {
        socket.emit('voice_mute_state', {
          roomCode: roomState.code,
          playerId: player.id,
          isMuted: !micEnabledRef.current,
          isDeafened: !nextState,
        });
      }
    } catch (err: any) {
      console.error('[AUDIO] Error toggling speaker:', err);
    }
  };

  // Set explicit audio route (e.g. bluetooth, earpiece, speaker)
  const setAudioRoute = async (route: AudioRouteType) => {
    try {
      console.log(`[AUDIO-ROUTE] Explicitly setting route to: ${route}`);
      if (route === 'speaker') {
        await audioRouteService.setSpeakerphoneOn(true);
      } else {
        await audioRouteService.setSpeakerphoneOn(false);
      }
      setCurrentRoute(route);
    } catch (err: any) {
      console.error('[AUDIO-ROUTE] Error setting audio route:', err);
    }
  };

  return (
    <VoiceChatContext.Provider
      value={{
        micEnabled,
        speakerEnabled,
        inVoiceRoom,
        voiceError,
        clearVoiceError,
        currentRoute,
        availableRoutes,
        toggleMicrophone,
        toggleSpeaker,
        setAudioRoute,
        activeSpeakerIds,
      }}
    >
      {children}
    </VoiceChatContext.Provider>
  );
};

export const useVoiceChat = (): VoiceChatContextType => {
  const context = useContext(VoiceChatContext);
  if (!context) {
    throw new Error('useVoiceChat must be used within a VoiceChatProvider');
  }
  return context;
};

export default VoiceChatContext;
