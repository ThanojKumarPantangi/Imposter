import React from 'react';
import { View, Text, ActivityIndicator } from 'react-native';
import { COLORS } from '../../../theme/colors';
import { gameStyles } from '../styles/gameStyles';
import { GameLoadingProps } from '../types/gameComponentTypes';

export const GameLoading: React.FC<GameLoadingProps> = ({ isLeaving = false }) => {
  return (
    <View style={gameStyles.loadingContainer}>
      <ActivityIndicator size="large" color={COLORS.imposter.default} />
      <Text style={gameStyles.loadingText}>
        {isLeaving ? 'Leaving game...' : 'Connecting to authoritative game state...'}
      </Text>
    </View>
  );
};

