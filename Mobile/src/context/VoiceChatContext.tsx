import React, { createContext, useContext, useEffect, useState } from 'react';
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

  useEffect(() => {
    if (roomState?.code && player?.id) {
      setInVoiceRoom(true);
      if (socket?.connected) {
        socket.emit('voice_signal_join', { roomCode: roomState.code, playerId: player.id });
      }
    } else {
      setInVoiceRoom(false);
    }
  }, [roomState?.code, player?.id, socket?.connected]);

  const toggleMicrophone = async () => {
    const nextState = !micEnabled;
    setMicEnabled(nextState);
    await AsyncStorage.setItem(STORAGE_KEY_MIC, String(nextState)).catch(() => {});

    if (socket && roomState?.code && player?.id) {
      socket.emit('voice_mute_state', {
        roomCode: roomState.code,
        playerId: player.id,
        isMuted: !nextState,
      });
    }
  };

  const toggleSpeaker = async () => {
    const nextState = !speakerEnabled;
    setSpeakerEnabled(nextState);
    await AsyncStorage.setItem(STORAGE_KEY_SPEAKER, String(nextState)).catch(() => {});

    if (socket && roomState?.code && player?.id) {
      socket.emit('voice_mute_state', {
        roomCode: roomState.code,
        playerId: player.id,
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

