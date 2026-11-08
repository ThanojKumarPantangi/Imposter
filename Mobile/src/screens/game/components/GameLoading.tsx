import React from 'react';
import { View, Text, ActivityIndicator, StyleSheet } from 'react-native';
import { GameLoadingProps } from '../types/gameComponentTypes';

export const GameLoading: React.FC<GameLoadingProps> = ({ isLeaving = false }) => {
  return (
    <View style={loadingStyles.loadingContainer}>
      <View style={loadingStyles.spinnerBox}>
        <ActivityIndicator size="large" color="#F43F5E" />
      </View>
      <Text style={loadingStyles.loadingText}>
        {isLeaving ? 'Leaving game...' : 'Connecting to authoritative game state...'}
      </Text>
    </View>
  );
};

const loadingStyles = StyleSheet.create({
  loadingContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#09090B',
    padding: 24,
    gap: 16,
  },
  spinnerBox: {
    width: 64,
    height: 64,
    borderRadius: 20,
    backgroundColor: '#1A1A1A',
    alignItems: 'center',
    justifyContent: 'center',
  },
  loadingText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#9CA3AF',
    textAlign: 'center',
  },
});