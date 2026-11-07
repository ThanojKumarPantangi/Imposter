import React from 'react';
import { TurnNotificationBanner } from '../../../components/TurnNotificationBanner';
import { GameTurnBannerProps } from '../types/gameComponentTypes';

export const GameTurnBanner: React.FC<GameTurnBannerProps> = ({
  roomStatus,
  showTurnNotification,
  turnNotificationVariant,
  turnNotificationText,
  deadline,
  totalDurationSeconds,
}) => {
  const isVoting = roomStatus === 'VOTING';

  return (
    <TurnNotificationBanner
      visible={isVoting || showTurnNotification}
      variant={isVoting ? 'voting' : turnNotificationVariant}
      text={isVoting ? '🗳️ Vote for the Imposter!' : turnNotificationText}
      deadline={deadline}
      totalDurationSeconds={totalDurationSeconds}
    />
  );
};

