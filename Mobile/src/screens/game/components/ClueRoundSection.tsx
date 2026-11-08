import React from 'react';
import { View, Text } from 'react-native';
import { Card } from '../../../components/common/Card';
import { CluePlayerRow } from './CluePlayerRow';
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
      <Card style={clueStyles.turnOrderCard}>
        <View style={clueStyles.turnOrderHeader}>
          <Text style={clueStyles.turnOrderTitle}>Clues & Turn Order</Text>
          <View style={clueStyles.roundPill}>
            <Text style={clueStyles.roundPillText}>Round {currentRound}</Text>
          </View>
        </View>

        <View style={clueStyles.playersClueList}>
          {orderedPlayers.map((p) => {
            const currentClueEntry = roomState.clueHistory?.find(
              (c) =>
                (c.playerId === p.id || String(c.playerId) === String(p.id)) &&
                Number(c.round) === Number(currentRound)
            );

            // Filter for previous rounds and sort descending so it renders R3 | R2 | R1
            const playerPastClues =
              roomState.clueHistory
                ?.filter(
                  (c) =>
                    (c.playerId === p.id || String(c.playerId) === String(p.id)) &&
                    Number(c.round) < Number(currentRound)
                )
                .sort((a, b) => Number(b.round) - Number(a.round)) || [];

            return (
              <CluePlayerRow
                key={p.id}
                player={p}
                isCurrentPlayer={p.id === currentPlayerId}
                activeTurnPlayerId={roomState.activeTurnPlayerId}
                currentRound={currentRound}
                clueEntry={currentClueEntry}
                pastClues={playerPastClues}
                isSpeaking={Boolean(activeSpeakerIds?.includes(p.id))}
                isGameOver={isGameOver}
                clueInput={clueInput}
                onClueInputChange={onClueInputChange}
                onClueSubmit={onClueSubmit}
                isImposter={isImposter}
              />
            );
          })}
        </View>
      </Card>
    </View>
  );
};