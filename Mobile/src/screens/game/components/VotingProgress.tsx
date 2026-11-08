import React from 'react';
import { View, Text, ScrollView } from 'react-native';
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
          {votedCount} <Text style={votingStyles.progressCountMuted}>/ {totalAlive} voted</Text>
        </Text>
      </View>

      <View style={votingStyles.progressBarTrack}>
        <View style={[votingStyles.progressBarFill, { width: `${votingProgress}%` }]} />
      </View>

      {playersNotVoted.length > 0 && (
        <View style={votingStyles.notVotedSection}>
          <Text style={votingStyles.notVotedLabel}>Waiting for votes from:</Text>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={votingStyles.notVotedChipsScrollContent}
          >
            {playersNotVoted.map((p) => (
              <View key={p.id} style={votingStyles.notVotedChip}>
                <View style={votingStyles.pendingDot} />
                <Text style={votingStyles.notVotedChipText}>{p.username}</Text>
              </View>
            ))}
          </ScrollView>
        </View>
      )}
    </View>
  );
};