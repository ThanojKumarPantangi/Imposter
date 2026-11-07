import React from 'react';
import { View, Text } from 'react-native';
import { Eye } from 'lucide-react-native';
import { Card } from '../../../components/common/Card';
import { PlayerAvatar } from '../../../components/PlayerAvatar';
import { COLORS } from '../../../theme/colors';
import { votingStyles } from '../styles/votingStyles';
import { gameStyles } from '../styles/gameStyles';
import { SpectatorVotingSectionProps } from '../types/gameComponentTypes';

export const SpectatorVotingSection: React.FC<SpectatorVotingSectionProps> = ({
  roomState,
  activeSpeakerIds,
}) => {
  const alivePlayers = roomState.players.filter(
    (p) => p.isAlive && !p.permanentlyDeparted
  );

  return (
    <Card style={votingStyles.votingContainerCard}>
      <View style={votingStyles.votingHeader}>
        <View style={votingStyles.eyeIconBox}>
          <Eye size={24} color={COLORS.accent.purple} />
        </View>
        <Text style={gameStyles.phaseMainTitle}>Voting in Progress — Spectating</Text>
        <Text style={gameStyles.phaseSubTitle}>
          Alive players are voting to eliminate who they suspect is the Imposter.
        </Text>
      </View>

      <View style={votingStyles.spectatorVoteList}>
        {alivePlayers.map((voter) => {
          const targetId = roomState.votes?.[voter.id];
          const isSkip = targetId === 'SKIP';
          const target = isSkip
            ? null
            : roomState.players.find((p) => p.id === targetId);
          const hasCast = Boolean(targetId);

          return (
            <View key={voter.id} style={votingStyles.spectatorVoteItem}>
              <View style={votingStyles.voterLeft}>
                <PlayerAvatar
                  player={voter}
                  size="sm"
                  showStatus={false}
                  isSpeaking={Boolean(activeSpeakerIds?.includes(voter.id))}
                />
                <Text style={votingStyles.voterName}>{voter.username}</Text>
              </View>

              <View style={votingStyles.voterTarget}>
                {hasCast ? (
                  isSkip ? (
                    <Text style={votingStyles.targetSkipText}>⏭️ Skipped</Text>
                  ) : (
                    <Text style={votingStyles.targetVotedText}>
                      🎯 {target?.username || 'Target'}
                    </Text>
                  )
                ) : (
                  <Text style={votingStyles.targetUndecided}>Undecided...</Text>
                )}
              </View>
            </View>
          );
        })}
      </View>
    </Card>
  );
};

