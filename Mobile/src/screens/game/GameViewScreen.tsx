import React, { useEffect } from 'react';
import { View, Text, ScrollView } from 'react-native';
import { useAuth } from '../../context/AuthContext';
import { useSocket } from '../../context/SocketContext';
import { useVoiceChat } from '../../context/VoiceChatContext';
import { BottomSecretWordPanel } from '../../components/BottomSecretWordPanel';

// Hooks
import { useGamePlayers } from './hooks/useGamePlayers';
import { useGameTurn } from './hooks/useGameTurn';
import { useGameVoting } from './hooks/useGameVoting';
import { useGameActions } from './hooks/useGameActions';
import { useKeyboardVisibility } from './hooks/useKeyboardVisibility';

// Components
import { GameTopBar } from './components/GameTopBar';
import { GameTurnBanner } from './components/GameTurnBanner';
import { GameLoading } from './components/GameLoading';
import { RoleRevealSection } from './components/RoleRevealSection';
import { EliminatedBanner } from './components/EliminatedBanner';
import { ClueRoundSection } from './components/ClueRoundSection';
import { VotingSection } from './components/VotingSection';
import { SpectatorVotingSection } from './components/SpectatorVotingSection';
import { ResultsSection } from './components/ResultsSection';
import { FinishedSection } from './components/FinishedSection';

// Styles
import { gameStyles } from './styles/gameStyles';

interface GameViewScreenProps {
  route: { params: { roomCode: string } };
  navigation: any;
}

export const GameViewScreen: React.FC<GameViewScreenProps> = ({ route, navigation }) => {
  const { roomCode } = route.params;
  const { player } = useAuth();
  const {
    roomState,
    kickedNotice,
    joinRoom,
    leaveRoom,
    returnToLobby,
    submitClue,
    submitVote,
    submitSkipVote,
    roomLifecycleState,
  } = useSocket();
  const { activeSpeakerIds } = useVoiceChat();

  const normalizedCode = (roomCode || '').toUpperCase();

  // Custom Hooks
  const isKeyboardVisible = useKeyboardVisibility();

  const {
    orderedPlayers,
    alivePlayers,
    totalAlive,
    me,
    isAlive,
    isImposter,
    isCivilian,
  } = useGamePlayers({
    roomState,
    currentUserId: player?.id,
    currentUsername: player?.username,
    currentAvatar: player?.avatar,
  });

  const {
    isMyTurn,
    turnNotificationVariant,
    turnNotificationText,
    showTurnNotification,
    activeDeadline,
    activeDuration,
  } = useGameTurn({
    roomState,
    currentUserId: player?.id,
    isAlive,
  });

  const {
    clueInput,
    setClueInput,
    errorMessage,
    setErrorMessage,
    isLeaving,
    handleLeaveGame,
    handleReturnToLobby,
    handleClueSubmit,
  } = useGameActions({
    roomCode: normalizedCode,
    currentUserId: player?.id,
    isAlive,
    isMyTurn,
    leaveRoom,
    returnToLobby,
    submitClue,
    navigation,
  });

  const {
    selectedVoteTarget,
    setSelectedVoteTarget,
    hasVoted,
    votedCount,
    votingProgress,
    playersNotVoted,
    handleVoteSubmit,
    handleSkipVote,
  } = useGameVoting({
    roomState,
    roomCode: normalizedCode,
    currentUserId: player?.id,
    isAlive,
    alivePlayers,
    totalAlive,
    submitVote,
    submitSkipVote,
    setErrorMessage,
  });

  // If kicked, go home
  useEffect(() => {
    if (kickedNotice) {
      navigation.navigate('Home');
    }
  }, [kickedNotice, navigation]);

  // Re-sync if needed (avoid duplicate joins during reconnect/recovery)
  useEffect(() => {
    if (kickedNotice) return;
    if (
      isLeaving ||
      roomLifecycleState === 'INTENTIONAL_EXIT' ||
      roomLifecycleState === 'NO_ROOM' ||
      roomLifecycleState === 'TEMPORARILY_DISCONNECTED'
    ) {
      return;
    }
    if (player && (!roomState || roomState.code !== normalizedCode)) {
      joinRoom(normalizedCode, player);
    }
  }, [
    normalizedCode,
    player,
    roomState,
    kickedNotice,
    isLeaving,
    roomLifecycleState,
    joinRoom,
  ]);

  // If room resets to WAITING, return to Lobby
  useEffect(() => {
    if (isLeaving) return;
    if (roomState && roomState.status === 'WAITING') {
      navigation.replace('Lobby', { roomCode: normalizedCode });
    }
  }, [roomState?.status, normalizedCode, isLeaving, navigation]);

  // Loading or Intentional Exit Screen
  if (isLeaving || !roomState) {
    return <GameLoading isLeaving={isLeaving} />;
  }

  return (
    <View style={gameStyles.container}>
      {/* Top Game Bar with dynamic timer banner */}
      <GameTopBar
        roundNumber={roomState.currentRound || 1}
        onLeaveGame={handleLeaveGame}
        isLeaving={isLeaving}
      >
        <GameTurnBanner
          roomStatus={roomState.status}
          showTurnNotification={showTurnNotification}
          turnNotificationVariant={turnNotificationVariant}
          turnNotificationText={turnNotificationText}
          deadline={activeDeadline}
          totalDurationSeconds={activeDuration}
        />
      </GameTopBar>

      <ScrollView
        contentContainerStyle={
          roomState.status === 'FINISHED'
            ? gameStyles.scrollContentFinished
            : gameStyles.scrollContent
        }
        showsVerticalScrollIndicator={false}
      >
        {/* Eliminated Spectator Banner */}
        {!isAlive && roomState.status !== 'FINISHED' && <EliminatedBanner />}

        {errorMessage ? (
          <View style={gameStyles.errorBox}>
            <Text style={gameStyles.errorText}>{errorMessage}</Text>
          </View>
        ) : null}

        {/* ========================================================== */}
        {/* PHASE 1: ROLE REVEAL */}
        {/* ========================================================== */}
        {roomState.status === 'ROLE_REVEAL' && <RoleRevealSection />}

        {/* ========================================================== */}
        {/* PHASE 2: CLUE ROUND */}
        {/* ========================================================== */}
        {roomState.status === 'CLUE_ROUND' && (
          <ClueRoundSection
            roomState={roomState}
            currentPlayerId={player?.id}
            orderedPlayers={orderedPlayers}
            isMyTurn={isMyTurn}
            isAlive={isAlive}
            isImposter={isImposter}
            clueInput={clueInput}
            onClueInputChange={setClueInput}
            onClueSubmit={handleClueSubmit}
            activeSpeakerIds={activeSpeakerIds}
          />
        )}

        {/* ========================================================== */}
        {/* PHASE 3: VOTING */}
        {/* ========================================================== */}
        {roomState.status === 'VOTING' &&
          (isAlive ? (
            <VotingSection
              roomState={roomState}
              currentPlayerId={player?.id}
              selectedVoteTarget={selectedVoteTarget}
              hasVoted={hasVoted}
              votedCount={votedCount}
              totalAlive={totalAlive}
              votingProgress={votingProgress}
              playersNotVoted={playersNotVoted}
              activeSpeakerIds={activeSpeakerIds}
              onSelectTarget={setSelectedVoteTarget}
              onVoteSubmit={handleVoteSubmit}
              onSkipVote={handleSkipVote}
            />
          ) : (
            <SpectatorVotingSection
              roomState={roomState}
              activeSpeakerIds={activeSpeakerIds}
            />
          ))}

        {/* ========================================================== */}
        {/* PHASE 4: RESULTS */}
        {/* ========================================================== */}
        {roomState.status === 'RESULTS' && roomState.eliminationResult && (
          <ResultsSection eliminationResult={roomState.eliminationResult} />
        )}

        {/* ========================================================== */}
        {/* PHASE 5: FINISHED */}
        {/* ========================================================== */}
        {roomState.status === 'FINISHED' && roomState.winnerResult && (
          <FinishedSection
            winnerResult={roomState.winnerResult}
            onLeaveGame={handleLeaveGame}
            onReturnToLobby={handleReturnToLobby}
          />
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