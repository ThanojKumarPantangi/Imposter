import React, { useEffect, useState } from 'react';
import { View, Text } from 'react-native';
import { Skull, Clock, Vote, FastForward } from 'lucide-react-native';
import { Card } from '../../../components/common/Card';
import { PlayerAvatar } from '../../../components/PlayerAvatar';
import { ResultsSectionProps } from '../types/gameComponentTypes';
import { RoleandResultStyles } from '../styles/RoleandResultStyles';
import { serverTimeSync } from '../../../utils/serverTimeSync';

export const ResultsSection: React.FC<ResultsSectionProps> = ({
  eliminationResult,
  deadline,
  roomState,
  impostersRemaining,
}) => {
  const effectiveDeadline = deadline || eliminationResult.resultsDeadline;
  const [secondsLeft, setSecondsLeft] = useState(() => {
    if (!effectiveDeadline) return eliminationResult.duration || 3;
    return Math.max(0, serverTimeSync.getRemainingSeconds(effectiveDeadline));
  });

  useEffect(() => {
    if (!effectiveDeadline) return;

    const tick = () => {
      const remaining = serverTimeSync.getRemainingSeconds(effectiveDeadline);
      setSecondsLeft(Math.max(0, remaining));
    };

    tick();
    const timer = setInterval(tick, 250);
    const unsubscribe = serverTimeSync.subscribe(tick);
    return () => {
      clearInterval(timer);
      unsubscribe();
    };
  }, [effectiveDeadline]);

  const remainingCount = (() => {
    if (typeof eliminationResult?.impostersRemaining === 'number') {
      return eliminationResult.impostersRemaining;
    }
    if (typeof impostersRemaining === 'number') {
      return impostersRemaining;
    }
    const initialCount = roomState?.settings?.impostersCount ?? 1;
    const eliminatedIsImposter = eliminationResult?.eliminatedPlayer?.role === 'IMPOSTER';
    return Math.max(0, initialCount - (eliminatedIsImposter ? 1 : 0));
  })();

  const imposterRemainText =
    remainingCount === 1 ? '1 imposter remains' : `${remainingCount} imposters remain`;

  // Aggregate votes: from eliminationResult.voteCounts or fallback to roomState.votes
  const voteCounts: Record<string, number> = {
    ...(eliminationResult?.voteCounts || {}),
  };
  let skipVotes =
    typeof eliminationResult?.skipVotes === 'number' ? eliminationResult.skipVotes : 0;

  if (Object.keys(voteCounts).length === 0 && skipVotes === 0 && roomState?.votes) {
    for (const targetId of Object.values(roomState.votes)) {
      if (targetId === 'SKIP') {
        skipVotes++;
      } else if (targetId) {
        voteCounts[targetId] = (voteCounts[targetId] || 0) + 1;
      }
    }
  }

  // Filter only who got votes >= 1, sorted descending by count
  const playerVoteEntries = Object.entries(voteCounts)
    .filter(([_, count]) => typeof count === 'number' && count >= 1)
    .sort((a, b) => b[1] - a[1]);

  const hasSkipVotes = skipVotes >= 1;
  const hasVotes = playerVoteEntries.length > 0 || hasSkipVotes;

  const playersMap = new Map((roomState?.players || []).map((p) => [p.id, p]));

  return (
    <View style={RoleandResultStyles.resultsWrapper}>
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

        {/* Vote tally breakdown (only showing targets with votes >= 1) */}
        {hasVotes && (
          <View style={RoleandResultStyles.votesTallyContainer}>
            <View style={RoleandResultStyles.votesTallyHeader}>
              <Vote size={14} color="#94A3B8" />
              <Text style={RoleandResultStyles.votesTallyTitle}>Votes Cast</Text>
            </View>

            <View style={RoleandResultStyles.votesTallyList}>
              {/* Skip Votes */}
              {hasSkipVotes && (
                <View style={RoleandResultStyles.voteItemRow}>
                  <View style={RoleandResultStyles.voteItemLeft}>
                    <View style={RoleandResultStyles.skipVoteIconCircle}>
                      <FastForward size={14} color="#F59E0B" />
                    </View>
                    <Text style={RoleandResultStyles.voteItemName}>Skip Vote</Text>
                  </View>
                  <View style={RoleandResultStyles.voteCountBadge}>
                    <Text style={RoleandResultStyles.voteCountBadgeText}>
                      {skipVotes} {skipVotes === 1 ? 'vote' : 'votes'}
                    </Text>
                  </View>
                </View>
              )}

              {/* Player Votes (votes >= 1) */}
              {playerVoteEntries.map(([playerId, count]) => {
                const player = playersMap.get(playerId);
                const username =
                  player?.username ||
                  (eliminationResult.eliminatedPlayer?.id === playerId
                    ? eliminationResult.eliminatedPlayer.username
                    : 'Unknown Player');
                const isEliminated = eliminationResult.eliminatedPlayer?.id === playerId;

                return (
                  <View key={playerId} style={RoleandResultStyles.voteItemRow}>
                    <View style={RoleandResultStyles.voteItemLeft}>
                      <PlayerAvatar
                        player={player}
                        username={username}
                        size="sm"
                        showStatus={false}
                      />
                      <Text style={RoleandResultStyles.voteItemName} numberOfLines={1}>
                        {username}
                      </Text>
                      {isEliminated && (
                        <View style={RoleandResultStyles.eliminatedTagSmall}>
                          <Text style={RoleandResultStyles.eliminatedTagSmallText}>ELIMINATED</Text>
                        </View>
                      )}
                    </View>
                    <View
                      style={[
                        RoleandResultStyles.voteCountBadge,
                        isEliminated && RoleandResultStyles.voteCountBadgeEliminated,
                      ]}
                    >
                      <Text
                        style={[
                          RoleandResultStyles.voteCountBadgeText,
                          isEliminated && RoleandResultStyles.voteCountBadgeTextEliminated,
                        ]}
                      >
                        {count} {count === 1 ? 'vote' : 'votes'}
                      </Text>
                    </View>
                  </View>
                );
              })}
            </View>
          </View>
        )}

        <View style={[RoleandResultStyles.countdownBadge, RoleandResultStyles.countdownBadgeResults]}>
          <Clock size={16} color="#F43F5E" />
          <Text style={RoleandResultStyles.countdownText}>
            Next round starting in <Text style={RoleandResultStyles.countdownNumberRose}>{secondsLeft}s</Text>...
          </Text>
        </View>
      </Card>

      <View style={RoleandResultStyles.impostersRemainPill}>
        <Text style={RoleandResultStyles.impostersRemainText}>{imposterRemainText}</Text>
      </View>
    </View>
  );
};