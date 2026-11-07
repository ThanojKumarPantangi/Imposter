import React from 'react';
import { View, Text } from 'react-native';
import { votingStyles } from '../styles/votingStyles';
import { VotingProgressProps } from '../types/gameComponentTypes';

export const VotingProgress: React.FC<VotingProgressProps> = ({
  votedCount,
  totalAlive,
  votingProgress,
  playersNotVoted,
}) => {
  return (
    <View style={votingStyles.progressContainer}>
      <View style={votingStyles.progressHeaderRow}>
        <Text style={votingStyles.progressLabel}>Voting Progress</Text>
        <Text style={votingStyles.progressCount}>
          {votedCount} / {totalAlive} voted
        </Text>
      </View>

      <View style={votingStyles.progressBarTrack}>
        <View style={[votingStyles.progressBarFill, { width: `${votingProgress}%` }]} />
      </View>

      {playersNotVoted.length > 0 && (
        <View style={votingStyles.notVotedSection}>
          <Text style={votingStyles.notVotedLabel}>Waiting for votes from:</Text>
          <View style={votingStyles.notVotedChipsRow}>
            {playersNotVoted.map((p) => (
              <View key={p.id} style={votingStyles.notVotedChip}>
                <Text style={votingStyles.notVotedChipText}>{p.username}</Text>
              </View>
            ))}
          </View>
        </View>
      )}
    </View>
  );
};

