import React, { useEffect, useState } from 'react';
import { View, Text } from 'react-native';
import { Sparkles, Clock } from 'lucide-react-native';
import { Card } from '../../../components/common/Card';
import { RoleRevealSectionProps } from '../types/gameComponentTypes';
import { RoleandResultStyles } from '../styles/RoleandResultStyles';
import { serverTimeSync } from '../../../utils/serverTimeSync';

export const RoleRevealSection: React.FC<RoleRevealSectionProps> = ({ deadline }) => {
  const [secondsLeft, setSecondsLeft] = useState(() => {
    if (!deadline) return 3;
    return Math.max(0, serverTimeSync.getRemainingSeconds(deadline));
  });

  useEffect(() => {
    if (!deadline) return;

    const tick = () => {
      const remaining = serverTimeSync.getRemainingSeconds(deadline);
      setSecondsLeft(Math.max(0, remaining));
    };

    tick();
    const timer = setInterval(tick, 250);
    const unsubscribe = serverTimeSync.subscribe(tick);
    return () => {
      clearInterval(timer);
      unsubscribe();
    };
  }, [deadline]);

  return (
    <Card style={RoleandResultStyles.centerPhaseCard}>
      <View style={RoleandResultStyles.sparkleIconCircle}>
        <Sparkles size={32} color="#38BDF8" />
      </View>

      <Text style={RoleandResultStyles.phaseMainTitle}>Secret Roles Distributed</Text>

      <Text style={RoleandResultStyles.phaseSubTitle}>
        Memorize your word or hint above! Clue rounds will begin in a moment.
      </Text>

      <View style={RoleandResultStyles.countdownBadge}>
        <Clock size={16} color="#38BDF8" />
        <Text style={RoleandResultStyles.countdownText}>
          Starting round 1 in <Text style={RoleandResultStyles.countdownNumberCyan}>{secondsLeft}s</Text>...
        </Text>
      </View>
    </Card>
  );
};