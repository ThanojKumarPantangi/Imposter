import React, { useState, useEffect } from 'react';
import { View, Text } from 'react-native';
import { serverTimeSync } from '../../../utils/serverTimeSync';
import { gameStyles } from '../styles/gameStyles';
import { DisconnectCountdownBadgeProps } from '../types/gameComponentTypes';

export const DisconnectCountdownBadge: React.FC<DisconnectCountdownBadgeProps> = ({
  deadline,
  timeout = 15,
  isGameOver = false,
}) => {
  const [secondsLeft, setSecondsLeft] = useState<number>(() => {
    if (isGameOver) return 0;
    if (!deadline) return timeout;
    return serverTimeSync.getRemainingSeconds(deadline);
  });

  useEffect(() => {
    if (isGameOver) return;
    const tick = () => {
      if (!deadline) {
        setSecondsLeft(timeout);
        return;
      }
      setSecondsLeft(serverTimeSync.getRemainingSeconds(deadline));
    };

    tick();
    const timer = setInterval(tick, 500);
    const unsubscribe = serverTimeSync.subscribe(tick);
    return () => {
      clearInterval(timer);
      unsubscribe();
    };
  }, [deadline, timeout, isGameOver]);

  if (isGameOver) return null;

  return (
    <View style={gameStyles.badgeColumn}>
      <View style={gameStyles.reconnectingTag}>
        <Text style={gameStyles.reconnectingTagText}>Disconnected</Text>
      </View>
      <Text style={gameStyles.removalSecondsText}>Removal in {secondsLeft}s</Text>
    </View>
  );
};

