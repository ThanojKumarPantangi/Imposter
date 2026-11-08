import React from 'react';
import { View, Text } from 'react-native';
import { Sparkles } from 'lucide-react-native';
import { Card } from '../../../components/common/Card';
import { RoleRevealSectionProps } from '../types/gameComponentTypes';
import { RoleandResultStyles } from '../styles/RoleandResultStyles';

export const RoleRevealSection: React.FC<RoleRevealSectionProps> = () => {
  return (
    <Card style={RoleandResultStyles.centerPhaseCard}>
      <View style={RoleandResultStyles.sparkleIconCircle}>
        <Sparkles size={32} color="#38BDF8" />
      </View>

      <Text style={RoleandResultStyles.phaseMainTitle}>Secret Roles Distributed</Text>

      <Text style={RoleandResultStyles.phaseSubTitle}>
        Memorize your word or hint above! Clue rounds will begin in a moment.
      </Text>
    </Card>
  );
};