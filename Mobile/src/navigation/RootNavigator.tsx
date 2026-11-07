import React from 'react';
import { View, Text, Modal, TouchableOpacity, StyleSheet } from 'react-native';
import { NavigationContainer, DefaultTheme } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { AlertCircle } from 'lucide-react-native';

import { RootStackParamList } from './types';
import { HomeScreen } from '../screens/HomeScreen';
import { LobbyScreen } from '../screens/LobbyScreen';
import { GameViewScreen } from '../screens/GameViewScreen';
import { PassAndPlayScreen } from '../screens/PassAndPlayScreen';
import { LeaderboardScreen } from '../screens/LeaderboardScreen';
import { AdminLoginScreen } from '../screens/AdminLoginScreen';
import { AdminDashboardScreen } from '../screens/AdminDashboardScreen';

import { useSocket } from '../context/SocketContext';
import { GradientButton } from '../components/common/GradientButton';
import { COLORS } from '../theme/colors';
import { RADIUS, SPACING } from '../theme/spacing';

const Stack = createNativeStackNavigator<RootStackParamList>();

const AppNavTheme = {
  ...DefaultTheme,
  colors: {
    ...DefaultTheme.colors,
    background: COLORS.dark[950],
    card: COLORS.dark[900],
    text: COLORS.white,
    border: COLORS.slate[800],
  },
};

export const RootNavigator: React.FC = () => {
  const { kickedNotice, clearKickedNotice, gameToast } = useSocket();

  return (
    <View style={styles.rootContainer}>
      <NavigationContainer theme={AppNavTheme}>
        <Stack.Navigator
          initialRouteName="Home"
          screenOptions={{
            headerShown: false,
            animation: 'slide_from_right',
            contentStyle: { backgroundColor: COLORS.dark[950] },
          }}
        >
          <Stack.Screen name="Home" component={HomeScreen} />
          <Stack.Screen name="Lobby" component={LobbyScreen} />
          <Stack.Screen name="GameView" component={GameViewScreen} />
          <Stack.Screen name="PassAndPlay" component={PassAndPlayScreen} />
          <Stack.Screen name="Leaderboard" component={LeaderboardScreen} />
          <Stack.Screen name="AdminLogin" component={AdminLoginScreen} />
          <Stack.Screen name="AdminDashboard" component={AdminDashboardScreen} />
        </Stack.Navigator>
      </NavigationContainer>

      {/* Global Kicked Alert Modal */}
      {kickedNotice && (
        <Modal visible transparent animationType="fade">
          <View style={styles.modalBackdrop}>
            <View style={styles.modalCard}>
              <View style={styles.alertIconBox}>
                <AlertCircle size={28} color={COLORS.imposter.default} />
              </View>
              <Text style={styles.modalTitle}>Room Notification</Text>
              <Text style={styles.modalDesc}>{kickedNotice}</Text>
              <GradientButton
                title="Understood"
                onPress={clearKickedNotice}
                variant="primary"
                style={styles.understoodBtn}
              />
            </View>
          </View>
        </Modal>
      )}

      {/* Global Floating Game Toast */}
      {gameToast && (
        <View style={styles.toastContainer} pointerEvents="none">
          <View style={styles.toastCard}>
            <Text style={styles.toastText}>{gameToast}</Text>
          </View>
        </View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  rootContainer: {
    flex: 1,
    backgroundColor: COLORS.dark[950],
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(7, 9, 14, 0.88)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: SPACING.lg,
  },
  modalCard: {
    width: '100%',
    maxWidth: 360,
    backgroundColor: COLORS.dark[900],
    borderWidth: 1.5,
    borderColor: 'rgba(244, 63, 94, 0.4)',
    borderRadius: RADIUS.xxl,
    padding: SPACING.xl,
    alignItems: 'center',
  },
  alertIconBox: {
    width: 52,
    height: 52,
    borderRadius: RADIUS.xl,
    backgroundColor: 'rgba(244, 63, 94, 0.15)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: SPACING.md,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: COLORS.white,
    marginBottom: SPACING.xs,
  },
  modalDesc: {
    fontSize: 13,
    color: COLORS.slate[300],
    textAlign: 'center',
    marginBottom: SPACING.xl,
    lineHeight: 18,
  },
  understoodBtn: {
    width: '100%',
  },
  toastContainer: {
    position: 'absolute',
    bottom: 24,
    left: 20,
    right: 20,
    alignItems: 'center',
    zIndex: 9999,
  },
  toastCard: {
    backgroundColor: COLORS.dark[850],
    borderWidth: 1,
    borderColor: COLORS.slate[700],
    paddingHorizontal: SPACING.lg,
    paddingVertical: SPACING.md,
    borderRadius: RADIUS.xl,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.5,
    shadowRadius: 10,
    elevation: 8,
  },
  toastText: {
    color: COLORS.white,
    fontWeight: '700',
    fontSize: 13,
    textAlign: 'center',
  },
});

