import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Skull } from 'lucide-react-native';
import { Card } from '../../../components/common/Card';
import { ResultsSectionProps } from '../types/gameComponentTypes';
import { RoleandResultStyles } from '../styles/RoleandResultStyles';

export const ResultsSection: React.FC<ResultsSectionProps> = ({
  eliminationResult,
}) => {
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

      <Text style={RoleandResultStyles.phaseSubTitle}>
        Checking victory conditions and preparing for the next round...
      </Text>
    </Card>
  );
};