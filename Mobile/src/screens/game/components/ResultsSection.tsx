import React from 'react';
import { View, Text } from 'react-native';
import { Skull } from 'lucide-react-native';
import { Card } from '../../../components/common/Card';
import { COLORS } from '../../../theme/colors';
import { resultsStyles } from '../styles/resultsStyles';
import { gameStyles } from '../styles/gameStyles';
import { ResultsSectionProps } from '../types/gameComponentTypes';

export const ResultsSection: React.FC<ResultsSectionProps> = ({
  eliminationResult,
}) => {
  return (
    <Card style={gameStyles.centerPhaseCard}>
      <View style={resultsStyles.skullCircle}>
        <Skull size={32} color={COLORS.imposter.default} />
      </View>

      <Text style={gameStyles.phaseMainTitle}>Round Elimination</Text>

      {eliminationResult.eliminatedPlayer ? (
        <View style={resultsStyles.eliminationBox}>
          <Text style={resultsStyles.eliminatedTag}>Eliminated by Vote</Text>
          <Text style={resultsStyles.eliminatedPlayerName}>
            {eliminationResult.eliminatedPlayer.username}
          </Text>
          <View style={resultsStyles.eliminatedRoleBadge}>
            <Text style={resultsStyles.eliminatedRoleText}>
              Identity: {eliminationResult.eliminatedPlayer.role}
            </Text>
          </View>
        </View>
      ) : (
        <View style={resultsStyles.tieBox}>
          <Text style={resultsStyles.tieText}>
            {eliminationResult.wasSkipped
              ? 'The majority voted to skip! Moving to the next round.'
              : 'The vote was tied! No player was eliminated this round.'}
          </Text>
        </View>
      )}

      <Text style={gameStyles.phaseSubTitle}>
        Checking victory conditions and preparing for the next round...
      </Text>
    </Card>
  );
};

