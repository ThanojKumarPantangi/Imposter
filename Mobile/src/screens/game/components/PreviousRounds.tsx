import React from 'react';
import { View, Text } from 'react-native';
import { clueStyles } from '../styles/clueStyles';
import { PreviousRoundsProps } from '../types/gameComponentTypes';

export const PreviousRounds: React.FC<PreviousRoundsProps> = ({
  clueHistory,
  currentRound,
}) => {
  const previousClues = clueHistory?.filter((c) => c.round < (currentRound || 1)) || [];

  if (previousClues.length === 0) return null;

  return (
    <View style={clueStyles.prevRoundsBox}>
      <Text style={clueStyles.prevRoundsTitle}>Previous Rounds Clues</Text>
      {previousClues.map((c, i) => (
        <View key={`${c.round}-${c.playerId}-${i}`} style={clueStyles.prevClueItem}>
          <Text style={clueStyles.prevClueText}>
            <Text style={clueStyles.boldWhite}>{c.username}:</Text>{' '}
            {c.skipped || c.status === 'SKIPPED' ? (
              <Text style={clueStyles.skippedAmber}>Skipped</Text>
            ) : (
              `“${c.clue}”`
            )}
          </Text>
          <Text style={clueStyles.prevRoundNum}>R{c.round}</Text>
        </View>
      ))}
    </View>
  );
};

