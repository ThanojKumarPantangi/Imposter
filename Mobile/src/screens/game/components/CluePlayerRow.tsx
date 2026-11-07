import React from 'react';
import { View, Text } from 'react-native';
import { PlayerAvatar } from '../../../components/PlayerAvatar';
import { DisconnectCountdownBadge } from './DisconnectCountdownBadge';
import { clueStyles } from '../styles/clueStyles';
import { CluePlayerRowProps } from '../types/gameComponentTypes';

export const CluePlayerRow: React.FC<CluePlayerRowProps> = ({
  player,
  isCurrentPlayer,
  activeTurnPlayerId,
  clueEntry,
  isSpeaking,
  isGameOver,
}) => {
  const isDisconnected =
    (!player.isConnected || player.connectionStatus === 'DISCONNECTED') &&
    player.isAlive &&
    !player.permanentlyDeparted;
  const isActive = activeTurnPlayerId === player.id && !isDisconnected;
  const isEliminated = !player.isAlive || player.permanentlyDeparted;
  const isSkipped = clueEntry?.status === 'SKIPPED' || clueEntry?.skipped;
  const isSubmitted = clueEntry && !isSkipped && (clueEntry.status === 'SUBMITTED' || clueEntry.clue);

  return (
    <View
      style={[
        clueStyles.playerClueRow,
        isActive && clueStyles.playerClueRowActive,
        isDisconnected && clueStyles.playerClueRowDisconnected,
        isEliminated && clueStyles.playerClueRowEliminated,
      ]}
    >
      <View style={clueStyles.clueRowTop}>
        <View style={clueStyles.playerInfoRow}>
          <PlayerAvatar
            player={player}
            size="sm"
            showStatus={false}
            isSpeaking={isSpeaking}
          />
          <Text style={clueStyles.cluePlayerName} numberOfLines={1}>
            {player.username}
            {isCurrentPlayer ? ' (You)' : ''}
          </Text>
        </View>

        <View style={clueStyles.statusColRight}>
          {player.permanentlyDeparted ? (
            <Text style={clueStyles.statusDeparted}>Left</Text>
          ) : !player.isAlive ? (
            <Text style={clueStyles.statusEliminated}>Eliminated</Text>
          ) : isDisconnected ? (
            <DisconnectCountdownBadge
              deadline={player.disconnectDeadline}
              timeout={player.gameDisconnectTimeout}
              isGameOver={isGameOver}
            />
          ) : isSubmitted ? (
            <Text style={clueStyles.statusSubmitted}>Submitted</Text>
          ) : isSkipped ? (
            <Text style={clueStyles.statusSkipped}>Skipped</Text>
          ) : isActive ? (
            <Text style={clueStyles.statusThinking}>Thinking...</Text>
          ) : (
            <Text style={clueStyles.statusWaiting}>Waiting</Text>
          )}
        </View>
      </View>

      {/* Clue Text */}
      <View style={clueStyles.clueTextRow}>
        {isSubmitted ? (
          <Text style={clueStyles.clueBubbleText}>“{clueEntry?.clue}”</Text>
        ) : isSkipped ? (
          <Text style={clueStyles.skippedClueText}>Clue skipped</Text>
        ) : (
          <Text style={clueStyles.noClueYetText}>No clue submitted yet</Text>
        )}
      </View>
    </View>
  );
};

