import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
  ActivityIndicator,
  Keyboard,
} from 'react-native';
import {
  Shield,
  Send,
  Vote,
  Trophy,
  Skull,
  LogOut,
  Sparkles,
  Eye,
  RotateCcw,
  Home as HomeIcon,
} from 'lucide-react-native';
import { useAuth } from '../context/AuthContext';
import { useSocket } from '../context/SocketContext';
import { useVoiceChat } from '../context/VoiceChatContext';
import { PlayerAvatar } from '../components/PlayerAvatar';
import { TurnNotificationBanner, TurnNotificationVariant } from '../components/TurnNotificationBanner';
import { BottomSecretWordPanel } from '../components/BottomSecretWordPanel';
import { VoiceControls } from '../components/VoiceControls';
import { Card } from '../components/common/Card';
import { GradientButton } from '../components/common/GradientButton';
import { Badge } from '../components/common/Badge';
import { COLORS } from '../theme/colors';
import { RADIUS, SPACING } from '../theme/spacing';
import { sounds } from '../utils/sound';
import { serverTimeSync } from '../utils/serverTimeSync';
import { Player } from '../types';

interface GameViewScreenProps {
  route: { params: { roomCode: string } };
  navigation: any;
}

function DisconnectCountdownBadge({
  deadline,
  timeout = 15,
  isGameOver = false,
}: {
  deadline?: number | null;
  timeout?: number;
  isGameOver?: boolean;
}) {
  const [secondsLeft, setSecondsLeft] = useState<number>(() => {
    if (isGameOver) return 0;
    if (!deadline) return timeout;
    return serverTimeSync.getRemainingSeconds(deadline);
  });

  useEffect(() => {
    if (isGameOver) return;
    const tick = () => {
      if (!deadline) {
        setSecondsLeft(timeout);
        return;
      }
      setSecondsLeft(serverTimeSync.getRemainingSeconds(deadline));
    };

    tick();
    const timer = setInterval(tick, 500);
    const unsubscribe = serverTimeSync.subscribe(tick);
    return () => {
      clearInterval(timer);
      unsubscribe();
    };
  }, [deadline, timeout, isGameOver]);

  if (isGameOver) return null;

  return (
    <View style={styles.badgeColumn}>
      <View style={styles.reconnectingTag}>
        <Text style={styles.reconnectingTagText}>Disconnected</Text>
      </View>
      <Text style={styles.removalSecondsText}>Removal in {secondsLeft}s</Text>
    </View>
  );
}

export const GameViewScreen: React.FC<GameViewScreenProps> = ({ route, navigation }) => {
  const { roomCode } = route.params;
  const { player } = useAuth();
  const {
    roomState,
    kickedNotice,
    disconnectAlert,
    submitClue,
    submitVote,
    submitSkipVote,
    joinRoom,
    leaveRoom,
    returnToLobby,
    roomLifecycleState,
  } = useSocket();
  const { activeSpeakerIds } = useVoiceChat();

  const [clueInput, setClueInput] = useState<string>('');
  const [selectedVoteTarget, setSelectedVoteTarget] = useState<string | null>(null);
  const [hasVoted, setHasVoted] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<string>('');
  const [isLeaving, setIsLeaving] = useState<boolean>(false);

  const normalizedCode = (roomCode || '').toUpperCase();

  // If kicked, go home
  useEffect(() => {
    if (kickedNotice) {
      navigation.navigate('Home');
    }
  }, [kickedNotice]);

  // Re-sync if needed (avoid duplicate joins during reconnect/recovery)
  useEffect(() => {
    if (kickedNotice) return;
    if (isLeaving || roomLifecycleState === 'INTENTIONAL_EXIT' || roomLifecycleState === 'NO_ROOM' || roomLifecycleState === 'TEMPORARILY_DISCONNECTED') return;
    if (player && (!roomState || roomState.code !== normalizedCode)) {
      joinRoom(normalizedCode, player);
    }
  }, [normalizedCode, player, roomState, kickedNotice, isLeaving, roomLifecycleState]);

  // If room resets to WAITING, return to Lobby
  useEffect(() => {
    if (isLeaving) return;
    if (roomState && roomState.status === 'WAITING') {
      navigation.replace('Lobby', { roomCode: normalizedCode });
    }
  }, [roomState?.status, normalizedCode, isLeaving]);

  // Reset vote submission when entering a new voting round
  useEffect(() => {
    if (roomState?.status === 'VOTING') {
      setHasVoted(false);
      setSelectedVoteTarget(null);
    }
  }, [roomState?.status, roomState?.currentRound]);

  const handleLeaveGame = useCallback(async () => {
    if (isLeaving) return;
    setIsLeaving(true);
    sounds.playClick();
    try {
      if (player?.id) {
        await leaveRoom(normalizedCode, player.id);
      }
    } finally {
      navigation.replace('Home');
    }
  }, [leaveRoom, normalizedCode, player?.id, isLeaving]);

  const handleReturnToLobby = () => {
    sounds.playClick();
    if (player?.id) {
      returnToLobby(normalizedCode, player.id);
    }
  };

  // Authoritative Turn Order:
  // Players are ordered in the exact sequence determined by the backend game engine (roomState.turnOrder),
  // followed by any non-participating/eliminated players.
  const orderedPlayers = useMemo(() => {
    if (!roomState?.players || roomState.players.length === 0) return [];

    const turnOrder = roomState.turnOrder;
    if (Array.isArray(turnOrder) && turnOrder.length > 0) {
      const playerMap = new Map<string, Player>();
      roomState.players.forEach((p) => {
        playerMap.set(p.id, p);
      });

      const ordered: Player[] = [];
      const seenIds = new Set<string>();

      // 1. Position players in exact authoritative turn order
      for (const id of turnOrder) {
        const p = playerMap.get(id);
        if (p) {
          ordered.push(p);
          seenIds.add(id);
        }
      }

      // 2. Append any remaining players (eliminated in previous rounds or departed)
      for (const p of roomState.players) {
        if (!seenIds.has(p.id)) {
          ordered.push(p);
        }
      }

      return ordered;
    }

    return roomState.players;
  }, [roomState?.players, roomState?.turnOrder]);

  // Next Eligible Player in authoritative turn sequence
  const nextEligiblePlayerId = useMemo(() => {
    if (roomState?.status !== 'CLUE_ROUND') return null;
    if (!roomState.turnOrder || roomState.turnOrder.length === 0) return null;
    if (!roomState.activeTurnPlayerId) return null;

    const turnOrder = roomState.turnOrder;
    const currentIdx = turnOrder.indexOf(roomState.activeTurnPlayerId);
    if (currentIdx === -1) return null;

    const playerMap = new Map<string, Player>();
    roomState.players?.forEach((p) => playerMap.set(p.id, p));

    for (let i = currentIdx + 1; i < turnOrder.length; i++) {
      const candidateId = turnOrder[i];
      const p = playerMap.get(candidateId);
      if (p && p.isAlive && !p.permanentlyDeparted) {
        return candidateId;
      }
    }

    return null;
  }, [roomState?.status, roomState?.turnOrder, roomState?.activeTurnPlayerId, roomState?.players]);

  const livingParticipants = useMemo(() => {
    if (!roomState?.turnOrder) return [];
    const playerMap = new Map<string, Player>();
    roomState.players?.forEach((p) => playerMap.set(p.id, p));
    return roomState.turnOrder.filter((id) => {
      const p = playerMap.get(id);
      return p && p.isAlive && !p.permanentlyDeparted;
    });
  }, [roomState?.turnOrder, roomState?.players]);

  const [dismissedTurnKey, setDismissedTurnKey] = useState<string | null>(null);
  const [isKeyboardVisible, setIsKeyboardVisible] = useState<boolean>(false);

  useEffect(() => {
    const showSub = Keyboard.addListener('keyboardDidShow', () => setIsKeyboardVisible(true));
    const hideSub = Keyboard.addListener('keyboardDidHide', () => setIsKeyboardVisible(false));
    return () => {
      showSub.remove();
      hideSub.remove();
    };
  }, []);

  if (isLeaving || !roomState) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={COLORS.imposter.default} />
        <Text style={styles.loadingText}>
          {isLeaving ? 'Leaving game...' : 'Connecting to authoritative game state...'}
        </Text>
      </View>
    );
  }

  const me = roomState.players.find((p) => p.id === player?.id) || {
    id: player?.id || '',
    username: player?.username || 'You',
    avatar: player?.avatar || 'avatar-1',
  };

  const alivePlayers = roomState.players.filter((p) => p.isAlive && !p.permanentlyDeparted);
  const totalAlive = alivePlayers.length;

  const votedCount = alivePlayers.filter(
    (p) => roomState.votes?.[p.id] !== undefined && roomState.votes?.[p.id] !== null
  ).length;

  const votingProgress = totalAlive > 0 ? (votedCount / totalAlive) * 100 : 0;

  const playersNotVoted = alivePlayers.filter(
    (p) => roomState.votes?.[p.id] === undefined || roomState.votes?.[p.id] === null
  );

  const isAlive = me.isAlive !== false && !me.permanentlyDeparted;
  const isMyTurn =
    isAlive && roomState.status === 'CLUE_ROUND' && roomState.activeTurnPlayerId === player?.id;
  const isImposter = me.role === 'IMPOSTER';
  const isCivilian = me.role === 'CIVILIAN';

  const isNext = Boolean(
    isAlive &&
    roomState.status === 'CLUE_ROUND' &&
    !isMyTurn &&
    nextEligiblePlayerId &&
    nextEligiblePlayerId === player?.id
  );

  const currentTurnKey = `${roomState.currentRound}-${roomState.activeTurnPlayerId}`;
  const showNextBanner = isNext && dismissedTurnKey !== currentTurnKey;

  const handleDismissNextBanner = () => {
    setDismissedTurnKey(currentTurnKey);
  };

  const activeSegmentIndex = livingParticipants.indexOf(roomState.activeTurnPlayerId || '');
  const totalSegments = livingParticipants.length;

  const activeDeadline =
    roomState.status === 'CLUE_ROUND'
      ? roomState.turnDeadline
      : roomState.status === 'VOTING'
        ? roomState.votingDeadline
        : null;

  const activeDuration =
    roomState.status === 'CLUE_ROUND'
      ? roomState.settings?.turnDurationSeconds || 30
      : roomState.status === 'VOTING'
        ? roomState.settings?.votingDurationSeconds || 45
        : 30;

  // --- DYNAMIC NOTIFICATION LOGIC ---
  const isClueRound = roomState.status === 'CLUE_ROUND';
  const hasActiveTurn = Boolean(roomState.activeTurnPlayerId);
  const activePlayer = roomState.players.find(p => p.id === roomState.activeTurnPlayerId);

  let turnNotificationVariant: TurnNotificationVariant = 'other';
  let turnNotificationText = '';

  if (showNextBanner) {
    turnNotificationVariant = 'next';
    turnNotificationText = "You're next";
  } else if (isMyTurn) {
    turnNotificationVariant = 'me';
    turnNotificationText = "Your turn";
  } else if (hasActiveTurn && activePlayer) {
    turnNotificationVariant = 'other';
    turnNotificationText = `${activePlayer.username}'s turn`;
  }

  const showTurnNotification = isClueRound && hasActiveTurn;

  const handleClueSubmit = () => {
    setErrorMessage('');
    if (!isAlive || !isMyTurn) return;
    if (!clueInput.trim()) return;

    try {
      if (player?.id) {
        submitClue(normalizedCode, player.id, clueInput.trim());
        setClueInput('');
      }
    } catch (err: any) {
      setErrorMessage(err.message);
    }
  };

  const handleVoteSubmit = () => {
    setErrorMessage('');
    if (!isAlive) return;
    if (!selectedVoteTarget) {
      setErrorMessage('Please select a player to vote for.');
      return;
    }
    if (player?.id) {
      submitVote(normalizedCode, player.id, selectedVoteTarget);
      setHasVoted(true);
    }
  };

  const handleSkipVote = () => {
    setErrorMessage('');
    if (!isAlive || hasVoted) return;
    if (player?.id) {
      submitSkipVote(normalizedCode, player.id);
      setHasVoted(true);
    }
  };

  return (
    <View style={styles.container}>
      {/* Top Game Bar */}
      <View style={styles.topBar}>
        {/* Main Navbar Row */}
        <View style={styles.topBarMainRow}>
          <View style={styles.topBarLeft}>
            <TouchableOpacity
              onPress={handleLeaveGame}
              disabled={isLeaving}
              style={styles.leaveBtn}
            >
              <LogOut size={16} color={COLORS.slate[400]} />
            </TouchableOpacity>

            <View style={styles.roundBadge}>
              <Text style={styles.roundLabel}>ROUND</Text>
              <Text style={styles.roundNumber}>{roomState.currentRound || 1}</Text>
            </View>
          </View>

          <View style={styles.topBarRight}>
            <VoiceControls compact />
          </View>
        </View>

        {/* Lower Section: Dynamic Turn Notification */}

        <TurnNotificationBanner
          visible={
            roomState.status === 'VOTING' ||
            showTurnNotification
          }
          variant={
            roomState.status === 'VOTING'
              ? 'voting'
              : turnNotificationVariant
          }
          text={
            roomState.status === 'VOTING'
              ? '🗳️ Vote for the Imposter!'
              : turnNotificationText
          }
          deadline={activeDeadline}
          totalDurationSeconds={activeDuration}
        />

      </View>

      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        {/* Eliminated Spectator Banner */}
        {!isAlive && roomState.status !== 'FINISHED' && (
          <View style={styles.spectatorBanner}>
            <View style={styles.spectatorIconBox}>
              <Skull size={20} color={COLORS.imposter.default} />
            </View>
            <View style={styles.spectatorTextCol}>
              <View style={styles.spectatorHeaderRow}>
                <Text style={styles.spectatorTitle}>YOU HAVE BEEN ELIMINATED</Text>
                <View style={styles.spectatorTag}>
                  <Text style={styles.spectatorTagText}>Spectator Mode</Text>
                </View>
              </View>
              <Text style={styles.spectatorDesc}>
                You can watch remaining rounds, but cannot submit clues or vote.
              </Text>
            </View>
          </View>
        )}

        {errorMessage ? (
          <View style={styles.errorBox}>
            <Text style={styles.errorText}>{errorMessage}</Text>
          </View>
        ) : null}

        {/* ========================================================== */}
        {/* PHASE 1: ROLE REVEAL */}
        {/* ========================================================== */}
        {roomState.status === 'ROLE_REVEAL' && (
          <Card style={styles.centerPhaseCard}>
            <View style={styles.sparkleIconCircle}>
              <Sparkles size={32} color={COLORS.civilian.default} />
            </View>
            <Text style={styles.phaseMainTitle}>Secret Roles Distributed</Text>
            <Text style={styles.phaseSubTitle}>
              Memorize your word or hint above! Clue rounds will begin in a moment.
            </Text>
          </Card>
        )}

        {/* ========================================================== */}
        {/* PHASE 2: CLUE ROUND */}
        {/* ========================================================== */}
        {roomState.status === 'CLUE_ROUND' && (
          <View style={styles.clueRoundContainer}>
            {/* Active Turn Banner */}
            {isMyTurn && isAlive && (
              <Card style={isMyTurn ? styles.myTurnCard : styles.otherTurnCard}>
                {/* Clue Input Form */}
                <View style={styles.clueForm}>
                  <View style={styles.inputAndSubmitRow}>
                    <TextInput
                      value={clueInput}
                      onChangeText={setClueInput}
                      placeholder={
                        isImposter
                          ? 'Enter clue OR exact word guess...'
                          : 'Enter your related clue...'
                      }
                      placeholderTextColor={COLORS.slate[500]}
                      maxLength={40}
                      autoFocus
                      style={styles.clueTextInput}
                    />
                    <TouchableOpacity
                      onPress={handleClueSubmit}
                      disabled={!clueInput.trim()}
                      style={[styles.clueSendBtn, !clueInput.trim() && styles.disabledSendBtn]}
                    >
                      <Send size={16} color={COLORS.dark[950]} />
                    </TouchableOpacity>
                  </View>

                  {isImposter && (
                    <View style={styles.imposterTipBox}>
                      <Text style={styles.imposterTipText}>
                        💡 <Text style={styles.boldWhite}>Imposter Tip:</Text> Guess the secret word and enter it here to win instantly!
                      </Text>
                    </View>
                  )}
                </View>
              </Card>
            )}

            {/* Clues & Turn Order List */}
            <Card style={styles.turnOrderCard}>
              <View style={styles.turnOrderHeader}>
                <Text style={styles.turnOrderTitle}>Clues & Turn Order</Text>
                <View style={styles.roundPill}>
                  <Text style={styles.roundPillText}>Round {roomState.currentRound || 1}</Text>
                </View>
              </View>

              <View style={styles.playersClueList}>
                {orderedPlayers.map((p) => {
                  const entry = roomState.clueHistory?.find(
                    (c) => c.playerId === p.id && c.round === (roomState.currentRound || 1)
                  );
                  const isDisconnected =
                    (!p.isConnected || p.connectionStatus === 'DISCONNECTED') &&
                    p.isAlive &&
                    !p.permanentlyDeparted;
                  const isActive = roomState.activeTurnPlayerId === p.id && !isDisconnected;
                  const isEliminated = !p.isAlive || p.permanentlyDeparted;
                  const isSkipped = entry?.status === 'SKIPPED' || entry?.skipped;
                  const isSubmitted = entry && !isSkipped && (entry.status === 'SUBMITTED' || entry.clue);

                  return (
                    <View
                      key={p.id}
                      style={[
                        styles.playerClueRow,
                        isActive && styles.playerClueRowActive,
                        isDisconnected && styles.playerClueRowDisconnected,
                        isEliminated && styles.playerClueRowEliminated,
                      ]}
                    >
                      <View style={styles.clueRowTop}>
                        <View style={styles.playerInfoRow}>
                          <PlayerAvatar player={p} size="sm" showStatus={false} isSpeaking={Boolean(activeSpeakerIds?.includes(p.id))} />
                          <Text style={styles.cluePlayerName} numberOfLines={1}>
                            {p.username}
                            {p.id === player?.id ? ' (You)' : ''}
                          </Text>
                        </View>

                        <View style={styles.statusColRight}>
                          {p.permanentlyDeparted ? (
                            <Text style={styles.statusDeparted}>Left</Text>
                          ) : !p.isAlive ? (
                            <Text style={styles.statusEliminated}>Eliminated</Text>
                          ) : isDisconnected ? (
                            <DisconnectCountdownBadge
                              deadline={p.disconnectDeadline}
                              timeout={p.gameDisconnectTimeout}
                              isGameOver={roomState.status === 'FINISHED'}
                            />
                          ) : isSubmitted ? (
                            <Text style={styles.statusSubmitted}>Submitted</Text>
                          ) : isSkipped ? (
                            <Text style={styles.statusSkipped}>Skipped</Text>
                          ) : isActive ? (
                            <Text style={styles.statusThinking}>Thinking...</Text>
                          ) : (
                            <Text style={styles.statusWaiting}>Waiting</Text>
                          )}
                        </View>
                      </View>

                      {/* Clue Text */}
                      <View style={styles.clueTextRow}>
                        {isSubmitted ? (
                          <Text style={styles.clueBubbleText}>“{entry?.clue}”</Text>
                        ) : isSkipped ? (
                          <Text style={styles.skippedClueText}>Clue skipped</Text>
                        ) : (
                          <Text style={styles.noClueYetText}>No clue submitted yet</Text>
                        )}
                      </View>
                    </View>
                  );
                })}
              </View>

              {/* Previous Rounds Accordion */}
              {roomState.clueHistory?.some((c) => c.round < (roomState.currentRound || 1)) && (
                <View style={styles.prevRoundsBox}>
                  <Text style={styles.prevRoundsTitle}>Previous Rounds Clues</Text>
                  {roomState.clueHistory
                    .filter((c) => c.round < (roomState.currentRound || 1))
                    .map((c, i) => (
                      <View key={`${c.round}-${c.playerId}-${i}`} style={styles.prevClueItem}>
                        <Text style={styles.prevClueText}>
                          <Text style={styles.boldWhite}>{c.username}:</Text>{' '}
                          {c.skipped ? <Text style={styles.skippedAmber}>Skipped</Text> : `“${c.clue}”`}
                        </Text>
                        <Text style={styles.prevRoundNum}>R{c.round}</Text>
                      </View>
                    ))}
                </View>
              )}
            </Card>
          </View>
        )}

        {/* ========================================================== */}
        {/* PHASE 3: VOTING */}
        {/* ========================================================== */}
        {roomState.status === 'VOTING' &&
          (isAlive ? (
            /* Alive Player Voting */
            <Card style={styles.votingContainerCard}>
              <View style={styles.votingHeader}>
                <View style={styles.voteIconBox}>
                  <Vote size={24} color={COLORS.imposter.default} />
                </View>
                <Text style={styles.phaseMainTitle}>Cast Your Vote</Text>
                <Text style={styles.phaseSubTitle}>
                  Review clues and vote to eliminate who you believe is the Imposter.
                </Text>
              </View>

              {/* Voting Progress */}
              <View style={styles.progressContainer}>
                <View style={styles.progressHeaderRow}>
                  <Text style={styles.progressLabel}>Voting Progress</Text>
                  <Text style={styles.progressCount}>
                    {votedCount} / {totalAlive} voted
                  </Text>
                </View>

                <View style={styles.progressBarTrack}>
                  <View style={[styles.progressBarFill, { width: `${votingProgress}%` }]} />
                </View>

                {playersNotVoted.length > 0 && (
                  <View style={styles.notVotedSection}>
                    <Text style={styles.notVotedLabel}>Waiting for votes from:</Text>
                    <View style={styles.notVotedChipsRow}>
                      {playersNotVoted.map((p) => (
                        <View key={p.id} style={styles.notVotedChip}>
                          <Text style={styles.notVotedChipText}>{p.username}</Text>
                        </View>
                      ))}
                    </View>
                  </View>
                )}
              </View>

              {/* Player Voting Cards */}
              <View style={styles.votingGrid}>
                {roomState.players
                  .filter((p) => p.isAlive && !p.permanentlyDeparted)
                  .map((p) => {
                    const isSelf = p.id === player?.id;
                    const isSelected = selectedVoteTarget === p.id;
                    return (
                      <TouchableOpacity
                        key={p.id}
                        disabled={isSelf || hasVoted}
                        onPress={() => {
                          sounds.playClick();
                          setSelectedVoteTarget(p.id);
                        }}
                        style={[
                          styles.voteTargetCard,
                          isSelected && styles.voteTargetSelected,
                          isSelf && styles.voteTargetSelf,
                        ]}
                      >
                        <View style={styles.targetRow}>
                          <PlayerAvatar player={p} size="sm" showStatus={false} isSpeaking={Boolean(activeSpeakerIds?.includes(p.id))} />
                          <View>
                            <Text style={styles.targetName}>{p.username}</Text>
                            <Text style={styles.targetSub}>
                              {isSelf ? '(Cannot vote self)' : 'Vote to Eliminate'}
                            </Text>
                          </View>
                        </View>
                      </TouchableOpacity>
                    );
                  })}
              </View>

              {/* Submit & Skip Actions */}
              <View style={styles.voteActionsRow}>
                <GradientButton
                  title={hasVoted ? 'Vote Submitted!' : 'Confirm Vote'}
                  onPress={handleVoteSubmit}
                  disabled={!selectedVoteTarget || hasVoted}
                  variant="primary"
                  style={styles.voteConfirmBtn}
                />

                <TouchableOpacity
                  onPress={handleSkipVote}
                  disabled={hasVoted}
                  style={[styles.skipVoteBtn, hasVoted && styles.skipVoteDisabled]}
                >
                  <Text style={styles.skipVoteText}>
                    {hasVoted ? 'Submitted' : 'Skip Vote'}
                  </Text>
                </TouchableOpacity>
              </View>
            </Card>
          ) : (
            /* Spectator Live Voting Tracker */
            <Card style={styles.votingContainerCard}>
              <View style={styles.votingHeader}>
                <View style={styles.eyeIconBox}>
                  <Eye size={24} color={COLORS.accent.purple} />
                </View>
                <Text style={styles.phaseMainTitle}>Voting in Progress — Spectating</Text>
                <Text style={styles.phaseSubTitle}>
                  Alive players are voting to eliminate who they suspect is the Imposter.
                </Text>
              </View>

              <View style={styles.spectatorVoteList}>
                {roomState.players
                  .filter((p) => p.isAlive && !p.permanentlyDeparted)
                  .map((voter) => {
                    const targetId = roomState.votes?.[voter.id];
                    const isSkip = targetId === 'SKIP';
                    const target = isSkip ? null : roomState.players.find((p) => p.id === targetId);
                    const hasCast = Boolean(targetId);

                    return (
                      <View key={voter.id} style={styles.spectatorVoteItem}>
                        <View style={styles.voterLeft}>
                          <PlayerAvatar player={voter} size="sm" showStatus={false} isSpeaking={Boolean(activeSpeakerIds?.includes(voter.id))} />
                          <Text style={styles.voterName}>{voter.username}</Text>
                        </View>

                        <View style={styles.voterTarget}>
                          {hasCast ? (
                            isSkip ? (
                              <Text style={styles.targetSkipText}>⏭️ Skipped</Text>
                            ) : (
                              <Text style={styles.targetVotedText}>🎯 {target?.username || 'Target'}</Text>
                            )
                          ) : (
                            <Text style={styles.targetUndecided}>Undecided...</Text>
                          )}
                        </View>
                      </View>
                    );
                  })}
              </View>
            </Card>
          ))}

        {/* ========================================================== */}
        {/* PHASE 4: RESULTS */}
        {/* ========================================================== */}
        {roomState.status === 'RESULTS' && roomState.eliminationResult && (
          <Card style={styles.centerPhaseCard}>
            <View style={styles.skullCircle}>
              <Skull size={32} color={COLORS.imposter.default} />
            </View>

            <Text style={styles.phaseMainTitle}>Round Elimination</Text>

            {roomState.eliminationResult.eliminatedPlayer ? (
              <View style={styles.eliminationBox}>
                <Text style={styles.eliminatedTag}>Eliminated by Vote</Text>
                <Text style={styles.eliminatedPlayerName}>
                  {roomState.eliminationResult.eliminatedPlayer.username}
                </Text>
                <View style={styles.eliminatedRoleBadge}>
                  <Text style={styles.eliminatedRoleText}>
                    Identity: {roomState.eliminationResult.eliminatedPlayer.role}
                  </Text>
                </View>
              </View>
            ) : (
              <View style={styles.tieBox}>
                <Text style={styles.tieText}>
                  {roomState.eliminationResult.wasSkipped
                    ? 'The majority voted to skip! Moving to the next round.'
                    : 'The vote was tied! No player was eliminated this round.'}
                </Text>
              </View>
            )}

            <Text style={styles.phaseSubTitle}>
              Checking victory conditions and preparing for the next round...
            </Text>
          </Card>
        )}

        {/* ========================================================== */}
        {/* PHASE 5: FINISHED */}
        {/* ========================================================== */}
        {roomState.status === 'FINISHED' && roomState.winnerResult && (
          <Card style={styles.centerPhaseCard}>
            <View style={styles.trophyCircle}>
              <Trophy size={40} color="#f59e0b" />
            </View>

            <Text style={styles.winnerHeadline}>
              {roomState.winnerResult.winnerRole === 'IMPOSTER' ? (
                <Text style={styles.imposterWinText}>IMPOSTERS WIN!</Text>
              ) : (
                <Text style={styles.civilianWinText}>CIVILIANS WIN!</Text>
              )}
            </Text>

            <Text style={styles.winConditionDesc}>
              {roomState.winnerResult.winCondition === 'IMPOSTER_GUESSED_WORD'
                ? '💥 An Imposter correctly entered the exact secret word!'
                : roomState.winnerResult.winCondition === 'ALL_IMPOSTERS_ELIMINATED'
                  ? '🎉 All Imposters were successfully identified and eliminated!'
                  : roomState.winnerResult.winCondition === 'IMPOSTERS_PARITY'
                    ? '🎭 Imposters have reached equal numbers with the Civilians!'
                    : 'Match completed!'}
            </Text>

            {/* Secret Reveal Box */}
            <View style={styles.secretRevealBox}>
              <View style={styles.secretRevealRow}>
                <View style={styles.secretRevealCol}>
                  <Text style={styles.revealLabel}>Secret Word</Text>
                  <Text style={styles.revealSecretWord}>{roomState.winnerResult.secretWord}</Text>
                </View>
                <View style={styles.secretRevealCol}>
                  <Text style={styles.revealLabel}>Imposter Hint</Text>
                  <Text style={styles.revealHint}>{roomState.winnerResult.hint}</Text>
                </View>
              </View>

              <View style={styles.impostersListSection}>
                <Text style={styles.revealLabel}>Imposters in this Match</Text>
                <View style={styles.imposterChipsRow}>
                  {roomState.winnerResult.imposters?.map((imp) => (
                    <Badge key={imp.id} label={imp.username} variant="imposter" />
                  ))}
                </View>
              </View>
            </View>

            {/* Actions */}
            <View style={styles.winnerActionsRow}>
              <GradientButton
                title="Back to Home"
                onPress={handleLeaveGame}
                variant="secondary"
                icon={<HomeIcon size={16} color={COLORS.slate[300]} />}
                iconPosition="left"
                style={styles.halfBtn}
              />

              <GradientButton
                title="Return to Lobby"
                onPress={handleReturnToLobby}
                variant="primary"
                icon={<RotateCcw size={16} color={COLORS.white} />}
                iconPosition="left"
                style={styles.halfBtn}
              />
            </View>
          </Card>
        )}
      </ScrollView>

      {/* Fixed Bottom Secret Word / Imposter Hint Panel */}
      {roomState.status !== 'FINISHED' && (
        <BottomSecretWordPanel
          role={me.role}
          myWord={roomState.myWord}
          myHint={roomState.myHint}
          isAlive={isAlive}
          isImposter={isImposter}
          isCivilian={isCivilian}
          isKeyboardVisible={isKeyboardVisible}
        />
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.dark[950],
  },
  loadingContainer: {
    flex: 1,
    backgroundColor: COLORS.dark[950],
    alignItems: 'center',
    justifyContent: 'center',
    padding: SPACING.xl,
    gap: SPACING.md,
  },
  loadingText: {
    fontSize: 13,
    color: COLORS.slate[400],
    fontWeight: '600',
  },
  topBar: {
    position: 'relative',
    flexDirection: 'column',
    width: '100%',
    backgroundColor: 'rgba(7, 9, 14, 0.95)',
    borderBottomWidth: 1,
    borderBottomLeftRadius: 45,
    borderBottomRightRadius: 45,
    borderBottomColor: 'rgba(30, 41, 59, 0.7)',
    zIndex: 50,
  },
  topBarMainRow: {
    position: 'relative',
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: SPACING.lg,
    paddingVertical: SPACING.sm,
    width: '100%',
  },
  topBarLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.md,
  },
  leaveBtn: {
    padding: SPACING.sm,
    borderRadius: RADIUS.md,
    backgroundColor: COLORS.dark[900],
    borderWidth: 1,
    borderColor: COLORS.slate[800],
  },
  roundBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  roundLabel: {
    fontSize: 9,
    fontWeight: '800',
    color: COLORS.slate[400],
  },
  roundNumber: {
    fontSize: 16,
    fontWeight: '900',
    color: COLORS.civilian.default,
  },
  topBarRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
  },
  scrollContent: {
    padding: SPACING.md,
    paddingBottom: 220,
    gap: SPACING.md,
  },
  spectatorBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(244, 63, 94, 0.12)',
    borderWidth: 1,
    borderColor: 'rgba(244, 63, 94, 0.35)',
    borderRadius: RADIUS.lg,
    padding: SPACING.md,
    gap: SPACING.md,
  },
  spectatorIconBox: {
    width: 40,
    height: 40,
    borderRadius: RADIUS.md,
    backgroundColor: 'rgba(244, 63, 94, 0.2)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  spectatorTextCol: {
    flex: 1,
  },
  spectatorHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 2,
  },
  spectatorTitle: {
    fontSize: 12,
    fontWeight: '900',
    color: COLORS.white,
  },
  spectatorTag: {
    backgroundColor: 'rgba(244, 63, 94, 0.25)',
    paddingHorizontal: 6,
    paddingVertical: 1,
    borderRadius: RADIUS.round,
  },
  spectatorTagText: {
    fontSize: 8,
    fontWeight: '800',
    color: '#fb7185',
    textTransform: 'uppercase',
  },
  spectatorDesc: {
    fontSize: 11,
    color: COLORS.slate[300],
  },
  errorBox: {
    backgroundColor: 'rgba(244, 63, 94, 0.12)',
    borderWidth: 1,
    borderColor: 'rgba(244, 63, 94, 0.35)',
    borderRadius: RADIUS.md,
    padding: SPACING.md,
  },
  errorText: {
    color: COLORS.imposter.default,
    fontSize: 12,
    fontWeight: '700',
    textAlign: 'center',
  },
  centerPhaseCard: {
    alignItems: 'center',
    padding: SPACING.xl,
    gap: SPACING.sm,
  },
  sparkleIconCircle: {
    width: 56,
    height: 56,
    borderRadius: RADIUS.xl,
    backgroundColor: 'rgba(6, 182, 212, 0.15)',
    borderWidth: 1,
    borderColor: 'rgba(6, 182, 212, 0.35)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: SPACING.sm,
  },
  phaseMainTitle: {
    fontSize: 20,
    fontWeight: '900',
    color: COLORS.white,
    textAlign: 'center',
  },
  phaseSubTitle: {
    fontSize: 12,
    color: COLORS.slate[400],
    textAlign: 'center',
    lineHeight: 18,
    maxWidth: 340,
  },
  clueRoundContainer: {
    gap: SPACING.md,
  },
  myTurnCard: {
    borderWidth: 1.5,
    borderColor: COLORS.civilian.default,
    backgroundColor: 'rgba(6, 182, 212, 0.08)',
  },
  otherTurnCard: {
    backgroundColor: COLORS.dark[900],
  },
  clueForm: {
    gap: SPACING.sm,
  },
  inputAndSubmitRow: {
    flexDirection: 'row',
    gap: SPACING.sm,
  },
  clueTextInput: {
    flex: 1,
    backgroundColor: COLORS.dark[950],
    borderWidth: 1,
    borderColor: COLORS.slate[700],
    borderRadius: RADIUS.md,
    paddingHorizontal: SPACING.md,
    paddingVertical: 10,
    color: COLORS.white,
    fontSize: 14,
    fontWeight: '600',
  },
  clueSendBtn: {
    backgroundColor: COLORS.civilian.default,
    borderRadius: RADIUS.md,
    paddingHorizontal: SPACING.lg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  disabledSendBtn: {
    opacity: 0.45,
  },
  imposterTipBox: {
    backgroundColor: 'rgba(244, 63, 94, 0.1)',
    borderWidth: 1,
    borderColor: 'rgba(244, 63, 94, 0.25)',
    borderRadius: RADIUS.md,
    padding: SPACING.sm,
  },
  imposterTipText: {
    fontSize: 10,
    color: '#fb7185',
  },
  turnOrderCard: {
    width: '100%',
  },
  turnOrderHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: SPACING.md,
  },
  turnOrderTitle: {
    fontSize: 15,
    fontWeight: '800',
    color: COLORS.white,
  },
  roundPill: {
    backgroundColor: COLORS.dark[800],
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: RADIUS.round,
  },
  roundPillText: {
    fontSize: 10,
    fontWeight: '700',
    color: COLORS.slate[400],
  },
  playersClueList: {
    gap: SPACING.sm,
  },
  playerClueRow: {
    backgroundColor: COLORS.dark[850],
    borderRadius: RADIUS.md,
    borderWidth: 1,
    borderColor: COLORS.slate[800],
    padding: SPACING.sm,
    gap: 4,
  },
  playerClueRowActive: {
    borderColor: COLORS.civilian.default,
    backgroundColor: 'rgba(6, 182, 212, 0.08)',
  },
  playerClueRowDisconnected: {
    borderColor: 'rgba(244, 63, 94, 0.4)',
    backgroundColor: 'rgba(244, 63, 94, 0.08)',
  },
  playerClueRowEliminated: {
    opacity: 0.55,
  },
  clueRowTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  playerInfoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
    flex: 1,
  },
  cluePlayerName: {
    fontSize: 13,
    fontWeight: '700',
    color: COLORS.slate[200],
  },
  statusColRight: {
    alignItems: 'flex-end',
  },
  statusDeparted: {
    fontSize: 9,
    fontWeight: '700',
    color: COLORS.slate[500],
    textTransform: 'uppercase',
  },
  statusEliminated: {
    fontSize: 9,
    fontWeight: '700',
    color: COLORS.slate[500],
    textTransform: 'uppercase',
  },
  statusSubmitted: {
    fontSize: 9,
    fontWeight: '800',
    color: COLORS.accent.emerald,
    textTransform: 'uppercase',
  },
  statusSkipped: {
    fontSize: 9,
    fontWeight: '800',
    color: COLORS.accent.amber,
    textTransform: 'uppercase',
  },
  statusThinking: {
    fontSize: 9,
    fontWeight: '800',
    color: COLORS.civilian.default,
    textTransform: 'uppercase',
  },
  statusWaiting: {
    fontSize: 9,
    fontWeight: '600',
    color: COLORS.slate[500],
  },
  clueTextRow: {
    paddingLeft: 34,
  },
  clueBubbleText: {
    fontSize: 13,
    fontWeight: '800',
    color: '#38bdf8',
  },
  skippedClueText: {
    fontSize: 12,
    fontStyle: 'italic',
    color: COLORS.accent.amber,
  },
  noClueYetText: {
    fontSize: 11,
    color: COLORS.slate[600],
  },
  prevRoundsBox: {
    marginTop: SPACING.md,
    paddingTop: SPACING.md,
    borderTopWidth: 1,
    borderTopColor: COLORS.slate[800],
  },
  prevRoundsTitle: {
    fontSize: 10,
    fontWeight: '800',
    color: COLORS.slate[400],
    textTransform: 'uppercase',
    marginBottom: SPACING.xs,
  },
  prevClueItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 3,
  },
  prevClueText: {
    fontSize: 11,
    color: COLORS.slate[400],
  },
  boldWhite: {
    color: COLORS.white,
    fontWeight: '700',
  },
  skippedAmber: {
    color: COLORS.accent.amber,
    fontStyle: 'italic',
  },
  prevRoundNum: {
    fontSize: 9,
    color: COLORS.slate[500],
    fontWeight: '700',
  },
  votingContainerCard: {
    width: '100%',
    gap: SPACING.md,
  },
  votingHeader: {
    alignItems: 'center',
    gap: 4,
  },
  voteIconBox: {
    width: 48,
    height: 48,
    borderRadius: RADIUS.xl,
    backgroundColor: 'rgba(244, 63, 94, 0.15)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 4,
  },
  eyeIconBox: {
    width: 48,
    height: 48,
    borderRadius: RADIUS.xl,
    backgroundColor: 'rgba(168, 85, 247, 0.15)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 4,
  },
  progressContainer: {
    backgroundColor: COLORS.dark[950],
    borderRadius: RADIUS.lg,
    padding: SPACING.md,
    gap: SPACING.xs,
  },
  progressHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  progressLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: COLORS.slate[300],
  },
  progressCount: {
    fontSize: 12,
    fontWeight: '800',
    color: COLORS.accent.emerald,
  },
  progressBarTrack: {
    height: 6,
    backgroundColor: COLORS.slate[800],
    borderRadius: RADIUS.round,
    overflow: 'hidden',
  },
  progressBarFill: {
    height: '100%',
    backgroundColor: COLORS.accent.emerald,
    borderRadius: RADIUS.round,
  },
  notVotedSection: {
    marginTop: 6,
  },
  notVotedLabel: {
    fontSize: 10,
    color: COLORS.slate[400],
    marginBottom: 4,
  },
  notVotedChipsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 4,
  },
  notVotedChip: {
    backgroundColor: COLORS.dark[800],
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: RADIUS.round,
  },
  notVotedChipText: {
    fontSize: 10,
    color: COLORS.slate[300],
    fontWeight: '600',
  },
  votingGrid: {
    gap: SPACING.sm,
  },
  voteTargetCard: {
    backgroundColor: COLORS.dark[850],
    borderWidth: 1.5,
    borderColor: COLORS.slate[800],
    borderRadius: RADIUS.lg,
    padding: SPACING.md,
  },
  voteTargetSelected: {
    borderColor: COLORS.imposter.default,
    backgroundColor: 'rgba(244, 63, 94, 0.12)',
  },
  voteTargetSelf: {
    opacity: 0.5,
  },
  targetRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.md,
  },
  targetName: {
    fontSize: 14,
    fontWeight: '700',
    color: COLORS.white,
  },
  targetSub: {
    fontSize: 11,
    color: COLORS.slate[400],
    marginTop: 1,
  },
  voteActionsRow: {
    flexDirection: 'row',
    gap: SPACING.sm,
    marginTop: SPACING.sm,
  },
  voteConfirmBtn: {
    flex: 2,
  },
  skipVoteBtn: {
    flex: 1,
    borderWidth: 1,
    borderColor: 'rgba(245, 158, 11, 0.4)',
    backgroundColor: 'rgba(245, 158, 11, 0.1)',
    borderRadius: RADIUS.lg,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
  },
  skipVoteDisabled: {
    opacity: 0.4,
  },
  skipVoteText: {
    color: COLORS.accent.amber,
    fontWeight: '800',
    fontSize: 13,
  },
  spectatorVoteList: {
    backgroundColor: COLORS.dark[950],
    borderRadius: RADIUS.lg,
    padding: SPACING.sm,
    gap: SPACING.sm,
  },
  spectatorVoteItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: SPACING.sm,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.slate[800],
  },
  voterLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
  },
  voterName: {
    fontSize: 13,
    fontWeight: '700',
    color: COLORS.slate[200],
  },
  voterTarget: {
    alignItems: 'flex-end',
  },
  targetSkipText: {
    fontSize: 12,
    fontWeight: '700',
    color: COLORS.accent.amber,
  },
  targetVotedText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#fb7185',
  },
  targetUndecided: {
    fontSize: 11,
    color: COLORS.slate[500],
    fontStyle: 'italic',
  },
  skullCircle: {
    width: 64,
    height: 64,
    borderRadius: RADIUS.xxl,
    backgroundColor: 'rgba(244, 63, 94, 0.15)',
    borderWidth: 1,
    borderColor: 'rgba(244, 63, 94, 0.35)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: SPACING.sm,
  },
  eliminationBox: {
    backgroundColor: COLORS.dark[950],
    borderWidth: 1,
    borderColor: COLORS.slate[800],
    borderRadius: RADIUS.lg,
    padding: SPACING.lg,
    alignItems: 'center',
    width: '100%',
    marginVertical: SPACING.md,
  },
  eliminatedTag: {
    fontSize: 10,
    fontWeight: '800',
    color: COLORS.slate[400],
    textTransform: 'uppercase',
  },
  eliminatedPlayerName: {
    fontSize: 22,
    fontWeight: '900',
    color: COLORS.imposter.default,
    marginVertical: 4,
  },
  eliminatedRoleBadge: {
    backgroundColor: COLORS.dark[800],
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: RADIUS.round,
  },
  eliminatedRoleText: {
    fontSize: 10,
    fontWeight: '700',
    color: COLORS.slate[300],
    textTransform: 'uppercase',
  },
  tieBox: {
    backgroundColor: COLORS.dark[950],
    borderRadius: RADIUS.lg,
    padding: SPACING.md,
    marginVertical: SPACING.md,
    width: '100%',
  },
  tieText: {
    fontSize: 12,
    color: COLORS.accent.amber,
    fontWeight: '700',
    textAlign: 'center',
  },
  trophyCircle: {
    width: 72,
    height: 72,
    borderRadius: RADIUS.xxl,
    backgroundColor: 'rgba(245, 158, 11, 0.15)',
    borderWidth: 1,
    borderColor: 'rgba(245, 158, 11, 0.35)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: SPACING.sm,
  },
  winnerHeadline: {
    fontSize: 28,
    fontWeight: '900',
    letterSpacing: -0.5,
  },
  imposterWinText: {
    color: COLORS.imposter.default,
  },
  civilianWinText: {
    color: COLORS.civilian.default,
  },
  winConditionDesc: {
    fontSize: 13,
    color: COLORS.slate[300],
    textAlign: 'center',
    marginVertical: SPACING.sm,
    lineHeight: 18,
  },
  secretRevealBox: {
    backgroundColor: COLORS.dark[950],
    borderWidth: 1,
    borderColor: COLORS.slate[800],
    borderRadius: RADIUS.lg,
    padding: SPACING.md,
    width: '100%',
    gap: SPACING.md,
    marginVertical: SPACING.md,
  },
  secretRevealRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  secretRevealCol: {
    flex: 1,
  },
  revealLabel: {
    fontSize: 9,
    fontWeight: '800',
    color: COLORS.slate[400],
    textTransform: 'uppercase',
    marginBottom: 2,
  },
  revealSecretWord: {
    fontSize: 16,
    fontWeight: '900',
    color: COLORS.civilian.default,
  },
  revealHint: {
    fontSize: 13,
    fontWeight: '700',
    color: COLORS.slate[200],
  },
  impostersListSection: {
    gap: 4,
  },
  imposterChipsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  winnerActionsRow: {
    flexDirection: 'row',
    gap: SPACING.sm,
    width: '100%',
    marginTop: SPACING.sm,
  },
  halfBtn: {
    flex: 1,
  },
  badgeColumn: {
    alignItems: 'flex-end',
  },
  reconnectingTag: {
    backgroundColor: 'rgba(245, 158, 11, 0.15)',
    paddingHorizontal: 6,
    paddingVertical: 1,
    borderRadius: RADIUS.round,
  },
  reconnectingTagText: {
    fontSize: 8,
    fontWeight: '800',
    color: COLORS.accent.amber,
  },
  removalSecondsText: {
    fontSize: 9,
    fontWeight: '700',
    color: COLORS.imposter.default,
    marginTop: 1,
  },
});