import React from 'react';
import { View, Text, TouchableOpacity } from 'react-native';
import { Vote } from 'lucide-react-native';
import { Card } from '../../../components/common/Card';
import { GradientButton } from '../../../components/common/GradientButton';
import { COLORS } from '../../../theme/colors';
import { VotingProgress } from './VotingProgress';
import { VotePlayerCard } from './VotePlayerCard';
import { votingStyles } from '../styles/votingStyles';
import { gameStyles } from '../styles/gameStyles';
import { VotingSectionProps } from '../types/gameComponentTypes';

export const VotingSection: React.FC<VotingSectionProps> = ({
  roomState,
  currentPlayerId,
  selectedVoteTarget,
  hasVoted,
  votedCount,
  totalAlive,
  votingProgress,
  playersNotVoted,
  activeSpeakerIds,
  onSelectTarget,
  onVoteSubmit,
  onSkipVote,
  disconnectAlert,
}) => {
  const alivePlayers = roomState.players.filter(
    (p) => p.isAlive && !p.permanentlyDeparted
  );

  return (
    <Card style={votingStyles.votingContainerCard}>
      {/* Voting Progress */}
      <VotingProgress
        votedCount={votedCount}
        totalAlive={totalAlive}
        votingProgress={votingProgress}
        playersNotVoted={playersNotVoted}
      />

      {/* Player Voting Cards */}
      <View style={votingStyles.votingGrid}>
        {alivePlayers.map((p) => {
          const isSelf = p.id === currentPlayerId;
          const isSelected = selectedVoteTarget === p.id;
          const playerDeadline =
            p.disconnectDeadline ||
            (disconnectAlert?.playerId === p.id
              ? disconnectAlert.disconnectDeadline || disconnectAlert.deadline
              : null);
          const playerTimeout =
            p.gameDisconnectTimeout ||
            (disconnectAlert?.playerId === p.id
              ? disconnectAlert.gameDisconnectTimeout || disconnectAlert.timeoutSeconds
              : roomState.settings?.gameDisconnectTimeout ||
                roomState.settings?.gameDisconnectGracePeriod ||
                15);

          return (
            <VotePlayerCard
              key={p.id}
              player={p}
              isSelf={isSelf}
              isSelected={isSelected}
              hasVoted={hasVoted}
              isSpeaking={Boolean(activeSpeakerIds?.includes(p.id))}
              onSelect={onSelectTarget}
              disconnectDeadline={playerDeadline}
              disconnectTimeout={playerTimeout}
              isGameOver={roomState.status === 'FINISHED'}
            />
          );
        })}
      </View>

      {/* Submit & Skip Actions */}
      <View style={votingStyles.voteActionsRow}>
        <GradientButton
          title={hasVoted ? 'Vote Submitted!' : 'Confirm Vote'}
          onPress={onVoteSubmit}
          disabled={!selectedVoteTarget || hasVoted}
          variant="primary"
          style={votingStyles.voteConfirmBtn}
        />

        <TouchableOpacity
          onPress={onSkipVote}
          disabled={hasVoted}
          style={[
            votingStyles.skipVoteBtn,
            hasVoted && votingStyles.skipVoteDisabled,
          ]}
        >
          <Text style={votingStyles.skipVoteText}>
            {hasVoted ? 'Submitted' : 'Skip Vote'}
          </Text>
        </TouchableOpacity>
      </View>
    </Card>
  );
};

