import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  Platform,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

export interface BottomSecretWordPanelProps {
  role?: string | null;
  myWord?: string | null;
  myHint?: string | null;
  isAlive: boolean;
  isImposter: boolean;
  isCivilian: boolean;
  isKeyboardVisible?: boolean;
}

export const BottomSecretWordPanel: React.FC<BottomSecretWordPanelProps> = ({
  role,
  myWord,
  myHint,
  isAlive,
  isImposter,
  isCivilian,
  isKeyboardVisible = false,
}) => {
  const insets = useSafeAreaInsets();

  const headerText = isCivilian
    ? 'The secret word is:'
    : isImposter
      ? 'Your imposter hint is:'
      : 'Spectator Mode';

  const displayedWord = isCivilian
    ? (myWord ? myWord.toUpperCase() : '—')
    : isImposter
      ? (myHint ? myHint.toUpperCase() : 'WATCH OTHERS')
      : (!isAlive ? 'SPECTATING' : '—');

  return (
    <View
      style={[
        styles.panel,
        isImposter && styles.imposterPanel, // Applies imposter color if true
        {
          paddingBottom: isKeyboardVisible
            ? 12
            : Math.max(insets.bottom, 16) + 6,
        },
      ]}
    >
      {/* Header Label */}
      <Text style={styles.headerLabel}>{headerText}</Text>

      {/* Main Secret Word / Hint */}
      <Text style={styles.wordText} numberOfLines={1} adjustsFontSizeToFit>
        {displayedWord}
      </Text>
    </View>
  );
};

const styles = StyleSheet.create({
  panel: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: '#232428', // Base dark charcoal/slate
    borderTopLeftRadius: 36,
    borderTopRightRadius: 36,
    paddingTop: 18,
    paddingHorizontal: 24,
    alignItems: 'center',
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: -6 },
    shadowOpacity: 0.45,
    shadowRadius: 12,
    elevation: 20,
    zIndex: 90,
  },
  imposterPanel: {
    backgroundColor: '#4A1515', // Dark red background for the imposter card
  },
  headerLabel: {
    color: '#9CA3AF',
    fontSize: 13,
    fontWeight: '700',
    textAlign: 'center',
    marginBottom: 6,
    letterSpacing: 0.2,
  },
  wordText: {
    color: '#FFFFFF',
    fontSize: 32,
    fontWeight: '800',
    letterSpacing: 3,
    textAlign: 'center',
    fontFamily: Platform.OS === 'android' ? 'serif' : 'Georgia',
    marginBottom: 8,
  },
});

export default BottomSecretWordPanel;