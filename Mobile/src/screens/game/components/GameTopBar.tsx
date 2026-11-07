import React from 'react';
import { View, Text, TouchableOpacity } from 'react-native';
import { LogOut } from 'lucide-react-native';
import { VoiceControls } from '../../../components/VoiceControls';
import { COLORS } from '../../../theme/colors';
import { gameStyles } from '../styles/gameStyles';
import { GameTopBarProps } from '../types/gameComponentTypes';

interface Props extends GameTopBarProps {
  children?: React.ReactNode;
}

export const GameTopBar: React.FC<Props> = ({
  roundNumber,
  onLeaveGame,
  isLeaving,
  children,
}) => {
  return (
    <View style={gameStyles.topBar}>
      <View style={gameStyles.topBarMainRow}>
        <View style={gameStyles.topBarLeft}>
          <TouchableOpacity
            onPress={onLeaveGame}
            disabled={isLeaving}
            style={gameStyles.leaveBtn}
          >
            <LogOut size={16} color={COLORS.slate[400]} />
          </TouchableOpacity>

          <View style={gameStyles.roundBadge}>
            <Text style={gameStyles.roundLabel}>ROUND</Text>
            <Text style={gameStyles.roundNumber}>{roundNumber || 1}</Text>
          </View>
        </View>

        <View style={gameStyles.topBarRight}>
          <VoiceControls compact />
        </View>
      </View>

      {children}
    </View>
  );
};

