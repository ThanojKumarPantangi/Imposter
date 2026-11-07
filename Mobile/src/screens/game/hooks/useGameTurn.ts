import { useState, useMemo, useCallback } from 'react';
import { Player, RoomState } from '../../../types';
import { TurnNotificationVariant } from '../../../components/TurnNotificationBanner';
import { getActiveDeadline, getActiveDuration, getCurrentTurnKey } from '../utils/gameHelpers';

interface UseGameTurnProps {
  roomState?: RoomState | null;
  currentUserId?: string;
  isAlive: boolean;
}

export const useGameTurn = ({
  roomState,
  currentUserId,
  isAlive,
}: UseGameTurnProps) => {
  const [dismissedTurnKey, setDismissedTurnKey] = useState<string | null>(null);

  // Next Eligible Player in authoritative turn sequence
  const nextEligiblePlayerId = useMemo(() => {
    if (roomState?.status !== 'CLUE_ROUND') return null;
    if (!roomState.turnOrder || roomState.turnOrder.length === 0) return null;
    if (!roomState.activeTurnPlayerId) return null;

    const turnOrder = roomState.turnOrder;
    const currentIdx = turnOrder.indexOf(roomState.activeTurnPlayerId);
    if (currentIdx === -1) return null;

    const playerMap = new Map<string, Player>();
    roomState.players?.forEach((p) => playerMap.set(p.id, p));

    for (let i = currentIdx + 1; i < turnOrder.length; i++) {
      const candidateId = turnOrder[i];
      const p = playerMap.get(candidateId);
      if (p && p.isAlive && !p.permanentlyDeparted) {
        return candidateId;
      }
    }

    return null;
  }, [roomState?.status, roomState?.turnOrder, roomState?.activeTurnPlayerId, roomState?.players]);

  const isMyTurn = Boolean(
    isAlive &&
    roomState?.status === 'CLUE_ROUND' &&
    roomState?.activeTurnPlayerId &&
    roomState.activeTurnPlayerId === currentUserId
  );

  const isNext = Boolean(
    isAlive &&
    roomState?.status === 'CLUE_ROUND' &&
    !isMyTurn &&
    nextEligiblePlayerId &&
    nextEligiblePlayerId === currentUserId
  );

  const currentTurnKey = getCurrentTurnKey(roomState?.currentRound, roomState?.activeTurnPlayerId);
  const showNextBanner = isNext && dismissedTurnKey !== currentTurnKey;

  const handleDismissNextBanner = useCallback(() => {
    setDismissedTurnKey(currentTurnKey);
  }, [currentTurnKey]);

  // Turn notification logic
  const isClueRound = roomState?.status === 'CLUE_ROUND';
  const hasActiveTurn = Boolean(roomState?.activeTurnPlayerId);
  const activePlayer = roomState?.players?.find((p) => p.id === roomState?.activeTurnPlayerId);

  let turnNotificationVariant: TurnNotificationVariant = 'other';
  let turnNotificationText = '';

  if (showNextBanner) {
    turnNotificationVariant = 'next';
    turnNotificationText = "You're next";
  } else if (isMyTurn) {
    turnNotificationVariant = 'me';
    turnNotificationText = 'Your turn';
  } else if (hasActiveTurn && activePlayer) {
    turnNotificationVariant = 'other';
    turnNotificationText = `${activePlayer.username}'s turn`;
  }

  const showTurnNotification = isClueRound && hasActiveTurn;

  const activeDeadline = getActiveDeadline(roomState);
  const activeDuration = getActiveDuration(roomState);

  return {
    nextEligiblePlayerId,
    isMyTurn,
    isNext,
    currentTurnKey,
    dismissedTurnKey,
    showNextBanner,
    handleDismissNextBanner,
    turnNotificationVariant,
    turnNotificationText,
    showTurnNotification,
    activeDeadline,
    activeDuration,
  };
};

