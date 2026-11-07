import React from 'react';
import { View, Text } from 'react-native';
import { Trophy, RotateCcw, Home as HomeIcon } from 'lucide-react-native';
import { Card } from '../../../components/common/Card';
import { GradientButton } from '../../../components/common/GradientButton';
import { Badge } from '../../../components/common/Badge';
import { COLORS } from '../../../theme/colors';
import { resultsStyles } from '../styles/resultsStyles';
import { gameStyles } from '../styles/gameStyles';
import { FinishedSectionProps } from '../types/gameComponentTypes';

export const FinishedSection: React.FC<FinishedSectionProps> = ({
  winnerResult,
  onLeaveGame,
  onReturnToLobby,
}) => {
  return (
    <Card style={gameStyles.centerPhaseCard}>
      <View style={resultsStyles.trophyCircle}>
        <Trophy size={40} color="#f59e0b" />
      </View>

      <Text style={resultsStyles.winnerHeadline}>
        {winnerResult.winnerRole === 'IMPOSTER' ? (
          <Text style={resultsStyles.imposterWinText}>IMPOSTERS WIN!</Text>
        ) : (
          <Text style={resultsStyles.civilianWinText}>CIVILIANS WIN!</Text>
        )}
      </Text>

      <Text style={resultsStyles.winConditionDesc}>
        {winnerResult.winCondition === 'IMPOSTER_GUESSED_WORD'
          ? '💥 An Imposter correctly entered the exact secret word!'
          : winnerResult.winCondition === 'ALL_IMPOSTERS_ELIMINATED'
            ? '🎉 All Imposters were successfully identified and eliminated!'
            : winnerResult.winCondition === 'IMPOSTERS_PARITY'
              ? '🎭 Imposters have reached equal numbers with the Civilians!'
              : 'Match completed!'}
      </Text>

      {/* Secret Reveal Box */}
      <View style={resultsStyles.secretRevealBox}>
        <View style={resultsStyles.secretRevealRow}>
          <View style={resultsStyles.secretRevealCol}>
            <Text style={resultsStyles.revealLabel}>Secret Word</Text>
            <Text style={resultsStyles.revealSecretWord}>{winnerResult.secretWord}</Text>
          </View>
          <View style={resultsStyles.secretRevealCol}>
            <Text style={resultsStyles.revealLabel}>Imposter Hint</Text>
            <Text style={resultsStyles.revealHint}>{winnerResult.hint}</Text>
          </View>
        </View>

        <View style={resultsStyles.impostersListSection}>
          <Text style={resultsStyles.revealLabel}>Imposters in this Match</Text>
          <View style={resultsStyles.imposterChipsRow}>
            {winnerResult.imposters?.map((imp) => (
              <Badge key={imp.id} label={imp.username} variant="imposter" />
            ))}
          </View>
        </View>
      </View>

      {/* Actions */}
      <View style={resultsStyles.winnerActionsRow}>
        <GradientButton
          title="Back to Home"
          onPress={onLeaveGame}
          variant="secondary"
          icon={<HomeIcon size={16} color={COLORS.slate[300]} />}
          iconPosition="left"
          style={resultsStyles.halfBtn}
        />

        <GradientButton
          title="Return to Lobby"
          onPress={onReturnToLobby}
          variant="primary"
          icon={<RotateCcw size={16} color={COLORS.white} />}
          iconPosition="left"
          style={resultsStyles.halfBtn}
        />
      </View>
    </Card>
  );
};

