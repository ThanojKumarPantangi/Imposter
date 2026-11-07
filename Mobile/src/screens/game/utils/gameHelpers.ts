import { RoomState } from '../../../types';
import { TurnNotificationVariant } from '../../../components/TurnNotificationBanner';

export const getActiveDeadline = (roomState?: RoomState | null): number | null => {
  if (!roomState) return null;
  if (roomState.status === 'CLUE_ROUND') {
    return roomState.turnDeadline ?? null;
  }
  if (roomState.status === 'VOTING') {
    return roomState.votingDeadline ?? null;
  }
  return null;
};

export const getActiveDuration = (roomState?: RoomState | null): number => {
  if (!roomState) return 30;
  if (roomState.status === 'CLUE_ROUND') {
    return roomState.settings?.turnDurationSeconds || 30;
  }
  if (roomState.status === 'VOTING') {
    return roomState.settings?.votingDurationSeconds || 45;
  }
  return 30;
};

export const getCurrentTurnKey = (
  round?: number,
  activeTurnPlayerId?: string | null
): string => {
  return `${round || 1}-${activeTurnPlayerId || ''}`;
};

export interface TurnNotificationInfo {
  variant: TurnNotificationVariant;
  text: string;
  showNotification: boolean;
}

export const getTurnNotificationInfo = (
  roomState: RoomState | null | undefined,
  isMyTurn: boolean,
  showNextBanner: boolean
): TurnNotificationInfo => {
  if (!roomState) {
    return { variant: 'other', text: '', showNotification: false };
  }

  const isClueRound = roomState.status === 'CLUE_ROUND';
  const hasActiveTurn = Boolean(roomState.activeTurnPlayerId);
  const activePlayer = roomState.players?.find((p) => p.id === roomState.activeTurnPlayerId);

  let variant: TurnNotificationVariant = 'other';
  let text = '';

  if (showNextBanner) {
    variant = 'next';
    text = "You're next";
  } else if (isMyTurn) {
    variant = 'me';
    text = 'Your turn';
  } else if (hasActiveTurn && activePlayer) {
    variant = 'other';
    text = `${activePlayer.username}'s turn`;
  }

  const showNotification = isClueRound && hasActiveTurn;

  return { variant, text, showNotification };
};

