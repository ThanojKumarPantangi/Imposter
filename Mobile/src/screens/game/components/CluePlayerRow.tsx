import React, { useEffect, useRef } from 'react';
import {
  View,
  Text,
  Animated,
  StyleSheet,
  TextInput,
  ScrollView,
} from 'react-native';
import { PlayerAvatar } from '../../../components/PlayerAvatar';
import { DisconnectCountdownBadge } from './DisconnectCountdownBadge';
import { clueStyles } from '../styles/clueStyles';
import { CluePlayerRowProps } from '../types/gameComponentTypes';

const TypingIndicator = () => {
  const dot1 = useRef(new Animated.Value(0.3)).current;
  const dot2 = useRef(new Animated.Value(0.3)).current;
  const dot3 = useRef(new Animated.Value(0.3)).current;

  useEffect(() => {
    const animateDot = (anim: Animated.Value, delay: number) => {
      return Animated.loop(
        Animated.sequence([
          Animated.delay(delay),
          Animated.timing(anim, {
            toValue: 1,
            duration: 350,
            useNativeDriver: true,
          }),
          Animated.timing(anim, {
            toValue: 0.3,
            duration: 350,
            useNativeDriver: true,
          }),
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
    <View style={typingStyles.container}>
      <Animated.View style={[typingStyles.dot, { opacity: dot1 }]} />
      <Animated.View style={[typingStyles.dot, { opacity: dot2 }]} />
      <Animated.View style={[typingStyles.dot, { opacity: dot3 }]} />
    </View>
  );
};

const typingStyles = StyleSheet.create({
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
    backgroundColor: 'rgba(255, 255, 255, 0.85)',
  },
});

export const CluePlayerRow: React.FC<CluePlayerRowProps & { pastClues?: any[] }> = ({
  player,
  isCurrentPlayer,
  activeTurnPlayerId,
  clueEntry,
  pastClues = [],
  isSpeaking,
  isGameOver = false,
  clueInput = '',
  onClueInputChange,
  onClueSubmit,
  isImposter = false,
  disconnectDeadline,
  disconnectTimeout = 15,
}) => {
  const isDisconnected =
    (!player.isConnected || player.connectionStatus === 'DISCONNECTED') &&
    player.isAlive &&
    !player.permanentlyDeparted;

  const isActive = activeTurnPlayerId === player.id && !isDisconnected;

  const isEliminated = !player.isAlive || player.permanentlyDeparted;

  const hasEnteredWord = Boolean(clueEntry?.clue && clueEntry.clue.trim());

  const hasSkipped =
    !hasEnteredWord &&
    Boolean(clueEntry?.skipped || clueEntry?.status === 'SKIPPED');

  const isMyTurnActive =
    isActive &&
    isCurrentPlayer &&
    !hasEnteredWord &&
    !hasSkipped &&
    !isEliminated;

  const handleClueSubmit = () => {
    if (!clueInput.trim()) return;
    onClueSubmit?.();
  };

  return (
    <View
      style={[
        clueStyles.playerClueRow,
        isActive ? clueStyles.playerClueRowActive : clueStyles.playerClueRowInactive,
        isDisconnected && clueStyles.playerClueRowDisconnected,
        isEliminated && clueStyles.playerClueRowEliminated,
      ]}
    >
      <View style={clueStyles.playerAvatarWrapper}>
        <PlayerAvatar
          player={player}
          size="md"
          showStatus={false}
          isSpeaking={isSpeaking}
        />
      </View>

      <View style={clueStyles.playerInfoCol}>
        <View style={clueStyles.clueRowTop}>
          <Text
            style={[
              clueStyles.cluePlayerName,
              isActive ? clueStyles.cluePlayerNameActive : clueStyles.cluePlayerNameInactive,
            ]}
            numberOfLines={1}
          >
            {player.username}
            {isCurrentPlayer ? (
              <Text style={isActive ? clueStyles.youTagActive : clueStyles.youTagInactive}>
                {' '}(You)
              </Text>
            ) : null}
          </Text>

          {isDisconnected && (
            <DisconnectCountdownBadge
              deadline={disconnectDeadline}
              timeout={disconnectTimeout}
              isGameOver={isGameOver}
            />
          )}
        </View>

        {hasEnteredWord ? (
          <Text
            style={[
              clueStyles.clueWordText,
              isActive ? clueStyles.clueWordTextActive : clueStyles.clueWordTextInactive,
            ]}
            numberOfLines={1}
          >
            {clueEntry?.clue}
          </Text>
        ) : hasSkipped ? (
          <Text
            style={[
              clueStyles.skippedWordText,
              isActive ? clueStyles.skippedWordTextActive : clueStyles.skippedWordTextInactive,
            ]}
            numberOfLines={1}
          >
            Skipped
          </Text>
        ) : isMyTurnActive ? (
          <View style={clueStyles.inlineInputContainer}>
            <View style={clueStyles.inlineInputRow}>
              <TextInput
                value={clueInput}
                onChangeText={onClueInputChange}
                placeholder={isImposter ? 'Clue or word guess...' : 'Enter your clue...'}
                maxLength={40}
                autoFocus
                returnKeyType="send"
                submitBehavior="blurAndSubmit"
                onSubmitEditing={handleClueSubmit}
                style={clueStyles.inlineTextInput}
              />
            </View>
          </View>
        ) : isActive ? (
          <TypingIndicator />
        ) : null}

        {/* Previous Rounds Clues Display: Now Horizontal Scrollable */}
        {pastClues && pastClues.length > 0 && (
          <View style={clueStyles.pastCluesWrapper}>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={clueStyles.pastCluesScrollContent}
            >
              {pastClues.map((pastClue, index) => {
                const clueText =
                  pastClue.skipped || pastClue.status === 'SKIPPED'
                    ? 'Skipped'
                    : pastClue.clue;
                const isLast = index === pastClues.length - 1;

                return (
                  <View key={`past-${pastClue.round}`} style={clueStyles.pastClueItem}>
                    <Text style={clueStyles.pastClueRoundText}>R{pastClue.round}</Text>
                    <Text
                      style={[
                        clueStyles.pastClueWordText,
                        (pastClue.skipped || pastClue.status === 'SKIPPED') &&
                        clueStyles.pastClueWordSkipped,
                      ]}
                      numberOfLines={1}
                    >
                      {clueText}
                    </Text>
                    {!isLast && <View style={clueStyles.pastClueSeparator} />}
                  </View>
                );
              })}
            </ScrollView>
          </View>
        )}
      </View>
    </View>
  );
};