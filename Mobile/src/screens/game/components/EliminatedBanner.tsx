import React from 'react';
import { View, Text } from 'react-native';
import { Skull } from 'lucide-react-native';
import { COLORS } from '../../../theme/colors';
import { gameStyles } from '../styles/gameStyles';
import { EliminatedBannerProps } from '../types/gameComponentTypes';

export const EliminatedBanner: React.FC<EliminatedBannerProps> = () => {
  return (
    <View style={gameStyles.spectatorBanner}>
      <View style={gameStyles.spectatorIconBox}>
        <Skull size={20} color={COLORS.imposter.default} />
      </View>
      <View style={gameStyles.spectatorTextCol}>
        <View style={gameStyles.spectatorHeaderRow}>
          <Text style={gameStyles.spectatorTitle}>YOU HAVE BEEN ELIMINATED</Text>
          <View style={gameStyles.spectatorTag}>
            <Text style={gameStyles.spectatorTagText}>Spectator Mode</Text>
          </View>
        </View>
        <Text style={gameStyles.spectatorDesc}>
          You can watch remaining rounds, but cannot submit clues or vote.
        </Text>
      </View>
    </View>
  );
};

