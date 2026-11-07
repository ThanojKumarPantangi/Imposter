import React, { createContext, useContext, useEffect, useState, useRef, useCallback } from 'react';
import { AppState, AppStateStatus } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useSocket } from './SocketContext';
import { useAuth } from './AuthContext';

interface VoiceChatContextType {
  micEnabled: boolean;
  speakerEnabled: boolean;
  inVoiceRoom: boolean;
  voiceError: string | null;
  toggleMicrophone: () => Promise<void>;
  toggleSpeaker: () => void;
}

const VoiceChatContext = createContext<VoiceChatContextType | null>(null);

const STORAGE_KEY_MIC = 'imposter_voice_mic';
const STORAGE_KEY_SPEAKER = 'imposter_voice_speaker';

export const VoiceChatProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { socket, roomState } = useSocket();
  const { player } = useAuth();

  const [micEnabled, setMicEnabled] = useState<boolean>(false);
  const [speakerEnabled, setSpeakerEnabled] = useState<boolean>(true);
  const [inVoiceRoom, setInVoiceRoom] = useState<boolean>(false);
  const [voiceError, setVoiceError] = useState<string | null>(null);

  const joinedSocketIdRef = useRef<string | null>(null);
  const joinedRoomCodeRef = useRef<string | null>(null);
  const appStateRef = useRef<AppStateStatus>((AppState.currentState as AppStateStatus) || 'active');

  const micEnabledRef = useRef<boolean>(micEnabled);
  const speakerEnabledRef = useRef<boolean>(speakerEnabled);

  useEffect(() => {
    micEnabledRef.current = micEnabled;
  }, [micEnabled]);

  useEffect(() => {
    speakerEnabledRef.current = speakerEnabled;
  }, [speakerEnabled]);

  useEffect(() => {
    async function loadPreferences() {
      try {
        const savedMic = await AsyncStorage.getItem(STORAGE_KEY_MIC);
        const savedSpeaker = await AsyncStorage.getItem(STORAGE_KEY_SPEAKER);
        if (savedMic !== null) setMicEnabled(savedMic === 'true');
        if (savedSpeaker !== null) setSpeakerEnabled(savedSpeaker !== 'false');
      } catch {
        // safe
      }
    }
    loadPreferences();
  }, []);

  const syncVoiceStateToSocket = useCallback((currentSocket: any, roomCode: string, playerId: string) => {
    if (!currentSocket || !currentSocket.connected) return;

    // Avoid duplicate participant registrations on the same socket instance
    if (joinedSocketIdRef.current !== currentSocket.id || joinedRoomCodeRef.current !== roomCode) {
      currentSocket.emit('voice_signal_join', { roomCode, playerId });
      joinedSocketIdRef.current = currentSocket.id;
      joinedRoomCodeRef.current = roomCode;
    }

    // Always ensure mute state is synchronized
    currentSocket.emit('voice_mute_state', {
      roomCode,
      playerId,
      isMuted: !micEnabledRef.current,
      isDeafened: !speakerEnabledRef.current,
    });
  }, []);

  // Sync voice connection when room or socket changes
  useEffect(() => {
    if (roomState?.code && player?.id) {
      setInVoiceRoom(true);
      if (socket?.connected) {
        syncVoiceStateToSocket(socket, roomState.code, player.id);
      }
    } else {
      setInVoiceRoom(false);
      joinedSocketIdRef.current = null;
      joinedRoomCodeRef.current = null;
    }
  }, [roomState?.code, player?.id, socket?.connected, socket?.id, syncVoiceStateToSocket]);

  // AppState monitoring for voice chat recovery
  useEffect(() => {
    const subscription = AppState.addEventListener('change', (nextAppState: AppStateStatus) => {
      const prevAppState = appStateRef.current;
      appStateRef.current = nextAppState;

      if (nextAppState === 'active' && prevAppState.match(/inactive|background/)) {
        console.log('🎙️ [Voice] Restored to foreground. Verifying voice chat state...');
        if (roomState?.code && player?.id && socket?.connected) {
          syncVoiceStateToSocket(socket, roomState.code, player.id);
        }
      }
    });

    return () => {
      subscription.remove();
    };
  }, [roomState?.code, player?.id, socket, syncVoiceStateToSocket]);

  const toggleMicrophone = async () => {
    const nextState = !micEnabled;
    setMicEnabled(nextState);
    micEnabledRef.current = nextState;
    await AsyncStorage.setItem(STORAGE_KEY_MIC, String(nextState)).catch(() => {});

    if (socket && roomState?.code && player?.id) {
      socket.emit('voice_mute_state', {
        roomCode: roomState.code,
        playerId: player.id,
        isMuted: !nextState,
        isDeafened: !speakerEnabledRef.current,
      });
    }
  };

  const toggleSpeaker = async () => {
    const nextState = !speakerEnabled;
    setSpeakerEnabled(nextState);
    speakerEnabledRef.current = nextState;
    await AsyncStorage.setItem(STORAGE_KEY_SPEAKER, String(nextState)).catch(() => {});

    if (socket && roomState?.code && player?.id) {
      socket.emit('voice_mute_state', {
        roomCode: roomState.code,
        playerId: player.id,
        isMuted: !micEnabledRef.current,
        isDeafened: !nextState,
      });
    }
  };

  return (
    <VoiceChatContext.Provider
      value={{
        micEnabled,
        speakerEnabled,
        inVoiceRoom,
        voiceError,
        toggleMicrophone,
        toggleSpeaker,
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
