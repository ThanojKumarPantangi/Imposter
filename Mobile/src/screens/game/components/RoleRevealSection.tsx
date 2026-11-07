import React from 'react';
import { View, Text } from 'react-native';
import { Sparkles } from 'lucide-react-native';
import { Card } from '../../../components/common/Card';
import { COLORS } from '../../../theme/colors';
import { gameStyles } from '../styles/gameStyles';
import { RoleRevealSectionProps } from '../types/gameComponentTypes';

export const RoleRevealSection: React.FC<RoleRevealSectionProps> = () => {
  return (
    <Card style={gameStyles.centerPhaseCard}>
      <View style={gameStyles.sparkleIconCircle}>
        <Sparkles size={32} color={COLORS.civilian.default} />
      </View>
      <Text style={gameStyles.phaseMainTitle}>Secret Roles Distributed</Text>
      <Text style={gameStyles.phaseSubTitle}>
        Memorize your word or hint above! Clue rounds will begin in a moment.
      </Text>
    </Card>
  );
};

