import React from 'react';
import { View, Text, Image } from 'react-native';
import { AlertTriangle, ShieldCheck, RotateCcw, Home as HomeIcon } from 'lucide-react-native';
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
  const isImposterWin = winnerResult.winnerRole === 'IMPOSTER';

  return (
    <View style={resultsStyles.finishedContainer}>
      {/* Header Animation / Icon Area */}
      <View style={resultsStyles.winHeader}>
        {isImposterWin ? (
          <AlertTriangle size={64} color="#F43F5E" fill="#F43F5E" />
        ) : (
          <ShieldCheck size={64} color="#38BDF8" fill="rgba(56, 189, 248, 0.2)" />
        )}

        <Text style={[
          resultsStyles.winHeadline,
          isImposterWin ? resultsStyles.textImposter : resultsStyles.textCivilian
        ]}>
          {winnerResult.winCondition === 'IMPOSTER_GUESSED_WORD'
            ? 'An imposter guessed the\nword!'
            : winnerResult.winCondition === 'ALL_IMPOSTERS_ELIMINATED'
              ? 'All imposters\neliminated!'
              : winnerResult.winCondition === 'IMPOSTERS_PARITY'
                ? 'Imposters took over!'
                : isImposterWin ? 'Imposters win!' : 'Civilians win!'}
        </Text>
      </View>

      {/* Character Illustration / Animation Area */}
      <View style={resultsStyles.illustrationContainer}>
        {/* Replace this View with your actual Lottie Animation or Image component */}
        {isImposterWin ? (
          <View style={resultsStyles.placeholderGraphic}>
            {/* Example of where to put your Imposter image */}
            <Image source={require('../../../../assets/Civilian-win.png')} style={resultsStyles.characterImage} />
          </View>
        ) : (
          <View style={resultsStyles.placeholderGraphic}>
            {/* Example of where to put your Civilian image */}
            <Image source={require('../../../../assets/Imposter-win.png')} style={resultsStyles.characterImage} />
          </View>
        )}
      </View>

      {/* Bottom Card Area (Secret Word & Players) */}
      <View style={resultsStyles.bottomInfoCard}>
        <Text style={resultsStyles.secretWordLabel}>SECRET WORD:</Text>
        <Text style={resultsStyles.secretWordValue}>{winnerResult.secretWord}</Text>

        {/* Showing Imposters */}
        <View style={resultsStyles.impostersListSection}>
          <View style={resultsStyles.imposterChipsRow}>
            {winnerResult.imposters?.map((imp) => (
              <Badge key={imp.id} label={imp.username} variant="imposter" />
            ))}
          </View>
        </View>

        {/* Actions */}
        <View style={resultsStyles.winnerActionsRow}>
          <GradientButton
            title="Home"
            onPress={onLeaveGame}
            variant="secondary"
            icon={<HomeIcon size={16} color={COLORS.slate[300]} />}
            iconPosition="left"
            style={resultsStyles.halfBtn}
          />

          <GradientButton
            title="Play Again"
            onPress={onReturnToLobby}
            variant="primary"
            icon={<RotateCcw size={16} color={COLORS.white} />}
            iconPosition="left"
            style={resultsStyles.halfBtn}
          />
        </View>
      </View>
    </View>
  );
};