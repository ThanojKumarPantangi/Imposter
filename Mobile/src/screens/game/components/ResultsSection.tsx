import React, { useEffect, useState } from 'react';
import { View, Text } from 'react-native';
import { Skull, Clock } from 'lucide-react-native';
import { Card } from '../../../components/common/Card';
import { ResultsSectionProps } from '../types/gameComponentTypes';
import { RoleandResultStyles } from '../styles/RoleandResultStyles';
import { serverTimeSync } from '../../../utils/serverTimeSync';

export const ResultsSection: React.FC<ResultsSectionProps> = ({
  eliminationResult,
  deadline,
}) => {
  const effectiveDeadline = deadline || eliminationResult.resultsDeadline;
  const [secondsLeft, setSecondsLeft] = useState(() => {
    if (!effectiveDeadline) return eliminationResult.duration || 3;
    return Math.max(0, serverTimeSync.getRemainingSeconds(effectiveDeadline));
  });

  useEffect(() => {
    if (!effectiveDeadline) return;

    const tick = () => {
      const remaining = serverTimeSync.getRemainingSeconds(effectiveDeadline);
      setSecondsLeft(Math.max(0, remaining));
    };

    tick();
    const timer = setInterval(tick, 250);
    const unsubscribe = serverTimeSync.subscribe(tick);
    return () => {
      clearInterval(timer);
      unsubscribe();
    };
  }, [effectiveDeadline]);

  return (
    <Card style={RoleandResultStyles.centerPhaseCard}>
      <View style={RoleandResultStyles.skullCircle}>
        <Skull size={32} color="#F43F5E" />
      </View>

      <Text style={RoleandResultStyles.phaseMainTitle}>Round Elimination</Text>

      {eliminationResult.eliminatedPlayer ? (
        <View style={RoleandResultStyles.eliminationBox}>
          <Text style={RoleandResultStyles.eliminatedTag}>ELIMINATED BY VOTE</Text>
          <Text style={RoleandResultStyles.eliminatedPlayerName}>
            {eliminationResult.eliminatedPlayer.username}
          </Text>
          <View style={RoleandResultStyles.eliminatedRoleBadge}>
            <Text style={RoleandResultStyles.eliminatedRoleText}>
              Identity: {eliminationResult.eliminatedPlayer.role}
            </Text>
          </View>
        </View>
      ) : (
        <View style={RoleandResultStyles.tieBox}>
          <Text style={RoleandResultStyles.tieText}>
            {eliminationResult.wasSkipped
              ? 'The majority voted to skip!\nMoving to the next round.'
              : 'The vote was tied!\nNo player was eliminated this round.'}
          </Text>
        </View>
      )}

      <View style={[RoleandResultStyles.countdownBadge, RoleandResultStyles.countdownBadgeResults]}>
        <Clock size={16} color="#F43F5E" />
        <Text style={RoleandResultStyles.countdownText}>
          Next round starting in <Text style={RoleandResultStyles.countdownNumberRose}>{secondsLeft}s</Text>...
        </Text>
      </View>
    </Card>
  );
};