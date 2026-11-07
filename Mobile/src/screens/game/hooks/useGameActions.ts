import { useState, useCallback } from 'react';
import { sounds } from '../../../utils/sound';

interface UseGameActionsProps {
  roomCode: string;
  currentUserId?: string;
  isAlive: boolean;
  isMyTurn: boolean;
  leaveRoom: (roomCode?: string, playerId?: string) => Promise<void>;
  returnToLobby: (roomCode: string, playerId?: string) => void;
  submitClue: (roomCode: string, playerId: string, clue: string) => void;
  navigation: any;
}

export const useGameActions = ({
  roomCode,
  currentUserId,
  isAlive,
  isMyTurn,
  leaveRoom,
  returnToLobby,
  submitClue,
  navigation,
}: UseGameActionsProps) => {
  const [clueInput, setClueInput] = useState<string>('');
  const [errorMessage, setErrorMessage] = useState<string>('');
  const [isLeaving, setIsLeaving] = useState<boolean>(false);

  const handleLeaveGame = useCallback(async () => {
    if (isLeaving) return;
    setIsLeaving(true);
    sounds.playClick();
    try {
      if (currentUserId) {
        await leaveRoom(roomCode, currentUserId);
      }
    } finally {
      navigation.replace('Home');
    }
  }, [leaveRoom, roomCode, currentUserId, isLeaving, navigation]);

  const handleReturnToLobby = useCallback(() => {
    sounds.playClick();
    if (currentUserId) {
      returnToLobby(roomCode, currentUserId);
    }
  }, [returnToLobby, roomCode, currentUserId]);

  const handleClueSubmit = useCallback(() => {
    setErrorMessage('');
    if (!isAlive || !isMyTurn) return;
    if (!clueInput.trim()) return;

    try {
      if (currentUserId) {
        submitClue(roomCode, currentUserId, clueInput.trim());
        setClueInput('');
      }
    } catch (err: any) {
      setErrorMessage(err.message || 'Failed to submit clue');
    }
  }, [isAlive, isMyTurn, clueInput, currentUserId, submitClue, roomCode]);

  return {
    clueInput,
    setClueInput,
    errorMessage,
    setErrorMessage,
    isLeaving,
    setIsLeaving,
    handleLeaveGame,
    handleReturnToLobby,
    handleClueSubmit,
  };
};

