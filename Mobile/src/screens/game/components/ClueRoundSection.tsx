import React from 'react';
import { View, Text, TextInput, TouchableOpacity } from 'react-native';
import { Send } from 'lucide-react-native';
import { Card } from '../../../components/common/Card';
import { COLORS } from '../../../theme/colors';
import { CluePlayerRow } from './CluePlayerRow';
import { PreviousRounds } from './PreviousRounds';
import { clueStyles } from '../styles/clueStyles';
import { ClueRoundSectionProps } from '../types/gameComponentTypes';

export const ClueRoundSection: React.FC<ClueRoundSectionProps> = ({
  roomState,
  currentPlayerId,
  orderedPlayers,
  isMyTurn,
  isAlive,
  isImposter,
  clueInput,
  onClueInputChange,
  onClueSubmit,
  activeSpeakerIds,
}) => {
  const currentRound = roomState.currentRound || 1;
  const isGameOver = roomState.status === 'FINISHED';

  return (
    <View style={clueStyles.clueRoundContainer}>
      {/* Active Turn Banner */}
      {isMyTurn && isAlive && (
        <Card style={isMyTurn ? clueStyles.myTurnCard : clueStyles.otherTurnCard}>
          <View style={clueStyles.clueForm}>
            <View style={clueStyles.inputAndSubmitRow}>
              <TextInput
                value={clueInput}
                onChangeText={onClueInputChange}
                placeholder={
                  isImposter
                    ? 'Enter clue OR exact word guess...'
                    : 'Enter your related clue...'
                }
                placeholderTextColor={COLORS.slate[500]}
                maxLength={40}
                autoFocus
                style={clueStyles.clueTextInput}
              />
              <TouchableOpacity
                onPress={onClueSubmit}
                disabled={!clueInput.trim()}
                style={[
                  clueStyles.clueSendBtn,
                  !clueInput.trim() && clueStyles.disabledSendBtn,
                ]}
              >
                <Send size={16} color={COLORS.dark[950]} />
              </TouchableOpacity>
            </View>

            {isImposter && (
              <View style={clueStyles.imposterTipBox}>
                <Text style={clueStyles.imposterTipText}>
                  💡 <Text style={clueStyles.boldWhite}>Tip:</Text> Guess the secret word to win instantly!
                </Text>
              </View>
            )}
          </View>
        </Card>
      )}

      {/* Clues & Turn Order List */}
      <Card style={clueStyles.turnOrderCard}>
        <View style={clueStyles.turnOrderHeader}>
          <Text style={clueStyles.turnOrderTitle}>Clues & Turn Order</Text>
          <View style={clueStyles.roundPill}>
            <Text style={clueStyles.roundPillText}>Round {currentRound}</Text>
          </View>
        </View>

        <View style={clueStyles.playersClueList}>
          {orderedPlayers.map((p) => {
            const entry = roomState.clueHistory?.find(
              (c) => (c.playerId === p.id || String(c.playerId) === String(p.id)) && Number(c.round) === Number(currentRound)
            );
            return (
              <CluePlayerRow
                key={p.id}
                player={p}
                isCurrentPlayer={p.id === currentPlayerId}
                activeTurnPlayerId={roomState.activeTurnPlayerId}
                currentRound={currentRound}
                clueEntry={entry}
                isSpeaking={Boolean(activeSpeakerIds?.includes(p.id))}
                isGameOver={isGameOver}
              />
            );
          })}
        </View>

        {/* Previous Rounds Accordion */}
        <PreviousRounds
          clueHistory={roomState.clueHistory || []}
          currentRound={currentRound}
        />
      </Card>
    </View>
  );
};

