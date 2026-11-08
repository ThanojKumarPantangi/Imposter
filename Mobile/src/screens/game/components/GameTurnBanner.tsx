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
  const isRoleReveal = roomStatus === 'ROLE_REVEAL';
  const isResults = roomStatus === 'RESULTS';

  const visible = isVoting || showTurnNotification || isRoleReveal || isResults;
  let variant = isVoting ? 'voting' : turnNotificationVariant;
  let text = isVoting ? '🗳️ Vote for the Imposter!' : turnNotificationText;

  if (isRoleReveal) {
    variant = 'other';
    text = '🎭 Memorize Your Secret Role!';
  } else if (isResults) {
    variant = 'other';
    text = '💀 Round Results';
  }

  return (
    <TurnNotificationBanner
      visible={visible}
      variant={variant}
      text={text}
      deadline={deadline}
      totalDurationSeconds={totalDurationSeconds}
    />
  );
};

