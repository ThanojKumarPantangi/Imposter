import React, { useEffect, useRef } from 'react';
import { View, Text, Animated, StyleSheet } from 'react-native';
import { Eye } from 'lucide-react-native';
import { Card } from '../../../components/common/Card';
import { PlayerAvatar } from '../../../components/PlayerAvatar';
import { DisconnectCountdownBadge } from './DisconnectCountdownBadge';
import { COLORS } from '../../../theme/colors';
import { votingStyles } from '../styles/votingStyles';
import { gameStyles } from '../styles/gameStyles';
import { SpectatorVotingSectionProps } from '../types/gameComponentTypes';

const VotingTypingIndicator = () => {
  const dot1 = useRef(new Animated.Value(0.3)).current;
  const dot2 = useRef(new Animated.Value(0.3)).current;
  const dot3 = useRef(new Animated.Value(0.3)).current;

  useEffect(() => {
    const animateDot = (anim: Animated.Value, delay: number) => {
      return Animated.loop(
        Animated.sequence([
          Animated.delay(delay),
          Animated.timing(anim, { toValue: 1, duration: 350, useNativeDriver: true }),
          Animated.timing(anim, { toValue: 0.3, duration: 350, useNativeDriver: true }),
        ])
      );
    };

    const a1 = animateDot(dot1, 0);
    const a2 = animateDot(dot2, 180);
    const a3 = animateDot(dot3, 360);

    a1.start();
    a2.start();
    a3.start();

    return () => {
      a1.stop();
      a2.stop();
      a3.stop();
    };
  }, [dot1, dot2, dot3]);

  return (
    <View style={vTypingStyles.container}>
      <Animated.View style={[vTypingStyles.dot, { opacity: dot1 }]} />
      <Animated.View style={[vTypingStyles.dot, { opacity: dot2 }]} />
      <Animated.View style={[vTypingStyles.dot, { opacity: dot3 }]} />
    </View>
  );
};

const vTypingStyles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    marginTop: 4,
  },
  dot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: 'rgba(255, 255, 255, 0.7)',
  },
});

export const SpectatorVotingSection: React.FC<SpectatorVotingSectionProps> = ({
  roomState,
  activeSpeakerIds,
  disconnectAlert,
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

          const isDisconnected =
            (!voter.isConnected || voter.connectionStatus === 'DISCONNECTED') &&
            voter.isAlive &&
            !voter.permanentlyDeparted;

          const playerDeadline =
            voter.disconnectDeadline ||
            (disconnectAlert?.playerId === voter.id
              ? disconnectAlert.disconnectDeadline || disconnectAlert.deadline
              : null);

          const playerTimeout =
            voter.gameDisconnectTimeout ||
            (disconnectAlert?.playerId === voter.id
              ? disconnectAlert.gameDisconnectTimeout || disconnectAlert.timeoutSeconds
              : roomState.settings?.gameDisconnectTimeout ||
                roomState.settings?.gameDisconnectGracePeriod ||
                15);

          return (
            <View key={voter.id} style={votingStyles.spectatorVoteItem}>
              <View style={votingStyles.targetAvatarWrapper}>
                <PlayerAvatar
                  player={voter}
                  size="md"
                  showStatus={false}
                  isSpeaking={Boolean(activeSpeakerIds?.includes(voter.id))}
                />
              </View>

              <View style={votingStyles.targetInfoCol}>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                  <Text style={votingStyles.voterName} numberOfLines={1}>
                    {voter.username}
                  </Text>
                  {isDisconnected && (
                    <DisconnectCountdownBadge
                      deadline={playerDeadline}
                      timeout={playerTimeout}
                      isGameOver={roomState.status === 'FINISHED'}
                    />
                  )}
                </View>

                {hasCast ? (
                  isSkip ? (
                    <Text style={votingStyles.targetSkipText} numberOfLines={1}>
                      Skipped
                    </Text>
                  ) : (
                    <Text style={votingStyles.targetVotedText} numberOfLines={1}>
                      🎯 {target?.username || 'Target'}
                    </Text>
                  )
                ) : (
                  <VotingTypingIndicator />
                )}
              </View>
            </View>
          );
        })}
      </View>
    </Card>
  );
};

