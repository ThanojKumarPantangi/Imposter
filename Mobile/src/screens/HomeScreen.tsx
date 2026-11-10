import React, { useState, useEffect, useRef } from 'react';
import { useIsFocused } from '@react-navigation/native';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
  Modal,
  Animated,
  Easing,
  Pressable,
} from 'react-native';
import {
  Play,
  Plus,
  BookOpen,
  Sparkles,
  ArrowRight,
  Trophy,
  Smartphone,
  X,
  Shield,
  Layers,
  ChevronRight,
} from 'lucide-react-native';
import { useAuth } from '../context/AuthContext';
import { useSocket } from '../context/SocketContext';
import { roomApi } from '../services/api/roomApi';
import { Card } from '../components/common/Card';
import { GradientButton } from '../components/common/GradientButton';
import { Header } from '../components/common/Header';
import { EditUsernameModal } from '../components/EditUsernameModal';
import { RejoinWaitingModal } from '../components/RejoinWaitingModal';
import { COLORS } from '../theme/colors';
import { RADIUS, SPACING } from '../theme/spacing';
import { sounds } from '../utils/sound';

interface HomeScreenProps {
  navigation: any;
}

// Helper component for interactive scaling cards
const AnimatedPressableCard = ({ onPress, children, style }: any) => {
  const scale = useRef(new Animated.Value(1)).current;

  return (
    <Pressable
      onPress={onPress}
      onPressIn={() => Animated.spring(scale, { toValue: 0.95, useNativeDriver: true }).start()}
      onPressOut={() => Animated.spring(scale, { toValue: 1, useNativeDriver: true }).start()}
    >
      <Animated.View style={[style, { transform: [{ scale }] }]}>
        {children}
      </Animated.View>
    </Pressable>
  );
};

export const HomeScreen: React.FC<HomeScreenProps> = ({ navigation }) => {
  const { player } = useAuth();
  const {
    joinRoom,
    leaveRoom,
    roomState,
    roomLifecycleState,
    rejoinState,
    requestRejoin,
    clearRejoinState,
  } = useSocket();

  const [roomCodeInput, setRoomCodeInput] = useState<string>('');
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string>('');
  const [showRules, setShowRules] = useState<boolean>(false);
  const [showEditProfile, setShowEditProfile] = useState<boolean>(false);
  const [isInputFocused, setIsInputFocused] = useState<boolean>(false);

  const isFocused = useIsFocused();

  // --- Animations ---
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(20)).current;
  const floatAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    // Screen entrance animation
    Animated.parallel([
      Animated.timing(fadeAnim, { toValue: 1, duration: 600, useNativeDriver: true, easing: Easing.out(Easing.ease) }),
      Animated.timing(slideAnim, { toValue: 0, duration: 600, useNativeDriver: true, easing: Easing.out(Easing.ease) })
    ]).start();

    // Floating hero badge animation
    Animated.loop(
      Animated.sequence([
        Animated.timing(floatAnim, { toValue: 1, duration: 2000, useNativeDriver: true, easing: Easing.inOut(Easing.ease) }),
        Animated.timing(floatAnim, { toValue: 0, duration: 2000, useNativeDriver: true, easing: Easing.inOut(Easing.ease) })
      ])
    ).start();
  }, []);

  const badgeTranslateY = floatAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [0, -6]
  });

  // --- Core Logic (Untouched) ---
  useEffect(() => {
    if (!isFocused) return;
    const lingeringCode = roomState?.code;
    if (lingeringCode && roomLifecycleState === 'ACTIVE_ROOM') {
      const targetScreen = roomState.status === 'WAITING' ? 'Lobby' : 'GameView';
      navigation.navigate(targetScreen, { roomCode: lingeringCode });
    }
  }, [roomState?.code, roomState?.status, roomLifecycleState, isFocused]);

  useEffect(() => {
    if (rejoinState && rejoinState.status === 'APPROVED' && rejoinState.roomCode) {
      const code = rejoinState.roomCode;
      clearRejoinState();
      joinRoom(code, player);
      navigation.navigate('Lobby', { roomCode: code });
    }
  }, [rejoinState, player]);

  useEffect(() => {
    if (!rejoinState || rejoinState.status !== 'PENDING' || !rejoinState.roomCode || !player?.id) {
      return;
    }
    const pollInterval = setInterval(async () => {
      try {
        const res = await roomApi.checkRejoinStatus(rejoinState.roomCode!, player.id);
        if (res?.success) {
          if (res.status === 'APPROVED') {
            clearInterval(pollInterval);
            sounds.playSuccess();
            const code = res.roomCode || rejoinState.roomCode!;
            clearRejoinState();
            joinRoom(code, player);
            navigation.navigate('Lobby', { roomCode: code });
          } else if (res.status === 'DENIED') {
            clearInterval(pollInterval);
            sounds.playClick();
            clearRejoinState();
            setError('Host declined your rejoin request.');
          }
        }
      } catch {
        // safe
      }
    }, 2000);
    return () => clearInterval(pollInterval);
  }, [rejoinState, player?.id]);

  const handleJoin = async () => {
    const cleanCode = roomCodeInput.trim().toUpperCase();
    if (!cleanCode || cleanCode.length < 3) {
      setError('Please enter a valid room code');
      return;
    }
    try {
      setLoading(true);
      setError('');
      sounds.playClick();
      const res = await roomApi.joinRoom(cleanCode, player!);
      if (res.success) {
        joinRoom(cleanCode, player);
        navigation.navigate('Lobby', { roomCode: cleanCode });
      }
    } catch (err: any) {
      if (err.requiresApproval || err.status === 403 || err.kicked || err.message?.includes('previously removed')) {
        requestRejoin(cleanCode, player!);
      } else {
        setError(err.message || 'Room not found or game in progress');
      }
    } finally {
      setLoading(false);
    }
  };

  const handleCreate = async () => {
    try {
      setLoading(true);
      setError('');
      sounds.playClick();
      const res = await roomApi.createRoom(player!, {
        categorySlug: 'fruits',
        categoryName: 'Fruits',
        categorySlugs: ['fruits'],
        categoryNames: ['Fruits'],
        impostersCount: 1,
        turnDurationSeconds: 30,
        votingDurationSeconds: 45,
        lobbyDisconnectTimeout: 5,
        gameDisconnectGracePeriod: 30,
      });

      if (res.success && res.room) {
        joinRoom(res.room.code, player);
        navigation.navigate('Lobby', { roomCode: res.room.code });
      }
    } catch (err: any) {
      setError(err.message || 'Failed to create room');
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={styles.container}>
      <Header
        onOpenProfile={() => setShowEditProfile(true)}
        onNavigateHome={() => { }}
      />

      <Animated.ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        style={{ opacity: fadeAnim, transform: [{ translateY: slideAnim }] }}
      >
        {/* Animated Hero Tag */}
        <Animated.View style={[styles.heroBadge, { transform: [{ translateY: badgeTranslateY }] }]}>
          <Sparkles size={14} color="#fb7185" />
          <Text style={styles.heroBadgeText}>Real-Time Social Deduction</Text>
        </Animated.View>

        {/* Hero Headline */}
        <Text style={styles.heroTitle}>
          Blend In. Deceive.{'\n'}
          <Text style={styles.heroHighlight}>Unmask The Imposter.</Text>
        </Text>

        <Text style={styles.heroSubtitle}>
          Civilians receive the secret word. Imposters get only a hint. Subtly drop clues, vote out the suspect, or guess the word to win!
        </Text>

        {error ? (
          <View style={styles.errorBox}>
            <Text style={styles.errorText}>{error}</Text>
          </View>
        ) : null}

        {/* Active Session Card */}
        {roomState?.code && (roomLifecycleState === 'ACTIVE_ROOM' || roomLifecycleState === 'TEMPORARILY_DISCONNECTED') ? (
          <Card variant="imposter" style={styles.activeSessionCard}>
            <View style={styles.cardHeader}>
              <View style={styles.iconBoxRose}>
                <Sparkles size={20} color={COLORS.imposter.default} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.cardTitle}>Active Room: {roomState.code}</Text>
                <Text style={styles.cardSub}>
                  {roomState.status === 'WAITING' ? 'Waiting in Lobby' : `Match in Progress (${roomState.status})`}
                </Text>
              </View>
            </View>
            <View style={styles.resumeBtnRow}>
              <GradientButton
                title="Resume Match"
                onPress={() => {
                  sounds.playClick();
                  navigation.navigate(roomState.status === 'WAITING' ? 'Lobby' : 'GameView', { roomCode: roomState.code });
                }}
                variant="primary"
                style={{ flex: 1 }}
              />
              <TouchableOpacity
                onPress={() => { if (player?.id) leaveRoom(roomState.code, player.id); }}
                style={styles.leaveActiveSessionBtn}
                activeOpacity={0.7}
              >
                <Text style={styles.leaveActiveSessionText}>Leave</Text>
              </TouchableOpacity>
            </View>
          </Card>
        ) : null}

        {/* Action Cards Section */}
        <View style={styles.cardsSection}>
          {/* Join Room Card */}
          <Card style={styles.actionCard}>
            <View style={styles.cardHeader}>
              <View style={styles.iconBoxCyan}>
                <Play size={20} color={COLORS.civilian.default} fill={COLORS.civilian.default} />
              </View>
              <View>
                <Text style={styles.cardTitle}>Join A Room</Text>
                <Text style={styles.cardSub}>Enter your friend's room code</Text>
              </View>
            </View>

            <View style={[styles.inputWrapper, isInputFocused && styles.inputWrapperFocused]}>
              <TextInput
                value={roomCodeInput}
                onChangeText={(text) => setRoomCodeInput(text.toUpperCase())}
                placeholder="e.g. ABCD"
                placeholderTextColor={COLORS.slate[600]}
                maxLength={6}
                autoCapitalize="characters"
                style={styles.roomCodeInput}
                onFocus={() => setIsInputFocused(true)}
                onBlur={() => setIsInputFocused(false)}
                selectionColor={COLORS.civilian.default}
              />
            </View>

            <GradientButton
              title="Join Game"
              onPress={handleJoin}
              variant="cyan"
              loading={loading}
              disabled={loading || !roomCodeInput.trim()}
              icon={<ArrowRight size={18} color={COLORS.dark[950]} />}
              style={styles.fullWidthBtn}
            />
          </Card>

          {/* Host Room Card */}
          <Card style={styles.actionCardDark}>
            <View style={styles.cardHeader}>
              <View style={styles.iconBoxRose}>
                <Plus size={22} color={COLORS.imposter.default} />
              </View>
              <View>
                <Text style={styles.cardTitle}>Host New Room</Text>
                <Text style={styles.cardSub}>Create a private lobby</Text>
              </View>
            </View>

            <Text style={styles.hostDesc}>
              Custom words, timers, and voice chat for 3 to 50 players.
            </Text>

            <GradientButton
              title="Create Lobby"
              onPress={handleCreate}
              variant="primary"
              loading={loading}
              disabled={loading}
              icon={<ArrowRight size={18} color={COLORS.white} />}
              style={styles.fullWidthBtn}
            />
          </Card>
        </View>

        {/* Quick Modes Section */}
        <View style={styles.quickModesGrid}>
          {/* Pass & Play */}
          <AnimatedPressableCard
            onPress={() => { sounds.playClick(); navigation.navigate('PassAndPlay'); }}
            style={styles.quickModeCard}
          >
            <View style={styles.iconBoxPurple}>
              <Smartphone size={20} color={COLORS.accent.purple} />
            </View>
            <View style={styles.quickModeContent}>
              <Text style={styles.quickModeTitle}>Pass & Play</Text>
              <Text style={styles.quickModeSub}>Single device party mode</Text>
            </View>
            <ChevronRight size={16} color={COLORS.slate[600]} />
          </AnimatedPressableCard>

          {/* Leaderboard */}
          <AnimatedPressableCard
            onPress={() => { sounds.playClick(); navigation.navigate('Leaderboard'); }}
            style={styles.quickModeCard}
          >
            <View style={styles.iconBoxAmber}>
              <Trophy size={20} color={COLORS.accent.amber} />
            </View>
            <View style={styles.quickModeContent}>
              <Text style={styles.quickModeTitle}>Leaderboards</Text>
              <Text style={styles.quickModeSub}>Top detectives & bluffers</Text>
            </View>
            <ChevronRight size={16} color={COLORS.slate[600]} />
          </AnimatedPressableCard>

          {/* How to Play */}
          <AnimatedPressableCard
            onPress={() => { sounds.playClick(); setShowRules(true); }}
            style={styles.quickModeCard}
          >
            <View style={styles.iconBoxEmerald}>
              <BookOpen size={20} color={COLORS.accent.emerald} />
            </View>
            <View style={styles.quickModeContent}>
              <Text style={styles.quickModeTitle}>How To Play</Text>
              <Text style={styles.quickModeSub}>Rules & winning strategies</Text>
            </View>
            <ChevronRight size={16} color={COLORS.slate[600]} />
          </AnimatedPressableCard>
        </View>
      </Animated.ScrollView>

      {/* Rules Modal */}
      <Modal visible={showRules} transparent animationType="slide" onRequestClose={() => setShowRules(false)}>
        <View style={styles.rulesBackdrop}>
          <View style={styles.rulesCard}>
            <View style={styles.rulesHeader}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                <View style={styles.iconBoxEmerald}>
                  <BookOpen size={18} color={COLORS.accent.emerald} />
                </View>
                <Text style={styles.rulesTitle}>Game Rules</Text>
              </View>
              <TouchableOpacity onPress={() => setShowRules(false)} style={styles.rulesCloseBtn}>
                <X size={20} color={COLORS.slate[400]} />
              </TouchableOpacity>
            </View>

            <ScrollView showsVerticalScrollIndicator={false} style={styles.rulesScroll}>
              <View style={styles.ruleBoxCiv}>
                <Text style={styles.ruleRoleCiv}>Civilian Role</Text>
                <Text style={styles.ruleDesc}>
                  Receives the actual secret word (e.g. "Apple"). Must submit a related word each turn and vote to eliminate the Imposter.
                </Text>
              </View>

              <View style={styles.ruleBoxImp}>
                <Text style={styles.ruleRoleImp}>Imposter Role</Text>
                <Text style={styles.ruleDesc}>
                  Does NOT receive the secret word! Receives only a persistent hint (e.g. "Crisp fruit, often red or green"). Must blend in by entering believable related words, or enter the exact secret word during their turn to win instantly!
                </Text>
              </View>

              <View style={styles.ruleBoxFlow}>
                <Text style={styles.ruleRoleFlow}>Gameplay Flow</Text>
                <Text style={styles.ruleStep}>1. <Text style={styles.boldWhite}>Role Reveal:</Text> Everyone privately sees their word or hint.</Text>
                <Text style={styles.ruleStep}>2. <Text style={styles.boldWhite}>Clue Rounds:</Text> Players take turns submitting 1 related clue.</Text>
                <Text style={styles.ruleStep}>3. <Text style={styles.boldWhite}>Voting:</Text> Living players vote on who they suspect is the Imposter.</Text>
                <Text style={styles.ruleStep}>4. <Text style={styles.boldWhite}>Elimination:</Text> Most voted player is eliminated!</Text>
                <Text style={styles.ruleStep}>5. <Text style={styles.boldWhite}>Victory Check:</Text> Civilians win if all Imposters are eliminated. Imposters win if they guess the word or reach parity!</Text>
              </View>
            </ScrollView>

            <GradientButton
              title="Got It, Let's Play!"
              onPress={() => setShowRules(false)}
              variant="secondary"
              style={styles.rulesUnderstoodBtn}
            />
          </View>
        </View>
      </Modal>

      <EditUsernameModal visible={showEditProfile} onClose={() => setShowEditProfile(false)} />
      {rejoinState && <RejoinWaitingModal rejoinState={rejoinState} onCancel={clearRejoinState} onReturnHome={clearRejoinState} />}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#030509', // Deeper, more premium dark background
  },
  scrollContent: {
    padding: SPACING.lg,
    alignItems: 'center',
    paddingBottom: 60,
  },
  heroBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: 'rgba(244, 63, 94, 0.1)',
    borderWidth: 1,
    borderColor: 'rgba(244, 63, 94, 0.25)',
    borderRadius: RADIUS.round,
    paddingHorizontal: SPACING.lg,
    paddingVertical: 6,
    marginBottom: SPACING.md,
    shadowColor: COLORS.imposter.default,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.3,
    shadowRadius: 10,
    elevation: 4,
  },
  heroBadgeText: {
    fontSize: 11,
    fontWeight: '800',
    color: '#fb7185',
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  heroTitle: {
    fontSize: 32,
    fontWeight: '900',
    color: COLORS.white,
    textAlign: 'center',
    lineHeight: 40,
    marginBottom: SPACING.sm,
    letterSpacing: 0.5,
  },
  heroHighlight: {
    color: COLORS.imposter.default,
  },
  heroSubtitle: {
    fontSize: 14,
    color: COLORS.slate[400],
    textAlign: 'center',
    lineHeight: 20,
    maxWidth: '90%',
    marginBottom: SPACING.xl,
  },
  errorBox: {
    width: '100%',
    backgroundColor: 'rgba(244, 63, 94, 0.1)',
    borderWidth: 1,
    borderColor: 'rgba(244, 63, 94, 0.4)',
    borderRadius: RADIUS.md,
    padding: SPACING.md,
    marginBottom: SPACING.lg,
  },
  errorText: {
    color: COLORS.imposter.default,
    fontSize: 13,
    fontWeight: '700',
    textAlign: 'center',
  },
  activeSessionCard: {
    width: '100%',
    marginBottom: SPACING.lg,
    borderWidth: 1.5,
    borderColor: 'rgba(244, 63, 94, 0.5)',
    backgroundColor: 'rgba(244, 63, 94, 0.1)',
  },
  resumeBtnRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.md,
    marginTop: SPACING.md,
  },
  leaveActiveSessionBtn: {
    paddingHorizontal: SPACING.xl,
    paddingVertical: 14,
    borderRadius: RADIUS.lg,
    backgroundColor: COLORS.dark[800],
    borderWidth: 1,
    borderColor: COLORS.slate[700],
  },
  leaveActiveSessionText: {
    color: COLORS.slate[300],
    fontSize: 14,
    fontWeight: '800',
  },
  cardsSection: {
    width: '100%',
    gap: SPACING.lg,
    marginBottom: SPACING.xl,
  },
  actionCard: {
    width: '100%',
    backgroundColor: COLORS.dark[900],
    borderColor: COLORS.slate[800],
    borderWidth: 1,
    borderRadius: RADIUS.xl,
  },
  actionCardDark: {
    width: '100%',
    backgroundColor: 'rgba(15, 20, 28, 0.6)',
    borderColor: COLORS.slate[800],
    borderWidth: 1,
    borderRadius: RADIUS.xl,
    padding: SPACING.lg,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.md,
    marginBottom: SPACING.lg,
  },
  iconBoxCyan: {
    width: 48,
    height: 48,
    borderRadius: RADIUS.lg,
    backgroundColor: 'rgba(6, 182, 212, 0.15)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconBoxRose: {
    width: 48,
    height: 48,
    borderRadius: RADIUS.lg,
    backgroundColor: 'rgba(244, 63, 94, 0.15)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  cardTitle: {
    fontSize: 20,
    fontWeight: '900',
    color: COLORS.white,
  },
  cardSub: {
    fontSize: 13,
    color: COLORS.slate[400],
    marginTop: 2,
  },
  inputWrapper: {
    backgroundColor: COLORS.dark[950],
    borderWidth: 2,
    borderColor: COLORS.slate[800],
    borderRadius: RADIUS.lg,
    marginBottom: SPACING.md,
    overflow: 'hidden',
  },
  inputWrapperFocused: {
    borderColor: COLORS.civilian.default,
    backgroundColor: 'rgba(6, 182, 212, 0.05)',
  },
  roomCodeInput: {
    paddingVertical: SPACING.md,
    paddingHorizontal: SPACING.lg,
    color: COLORS.white,
    fontFamily: 'monospace',
    fontSize: 24,
    fontWeight: '900',
    letterSpacing: 8,
    textAlign: 'center',
  },
  fullWidthBtn: {
    width: '100%',
  },
  hostDesc: {
    fontSize: 13,
    color: COLORS.slate[400],
    lineHeight: 20,
    marginBottom: SPACING.lg,
  },
  quickModesGrid: {
    width: '100%',
    gap: SPACING.md,
    marginBottom: SPACING.xl,
  },
  quickModeCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.dark[900],
    borderWidth: 1,
    borderColor: COLORS.slate[800],
    borderRadius: RADIUS.xl,
    padding: SPACING.md,
    gap: SPACING.md,
  },
  quickModeContent: {
    flex: 1,
  },
  iconBoxPurple: {
    width: 42,
    height: 42,
    borderRadius: RADIUS.md,
    backgroundColor: 'rgba(168, 85, 247, 0.15)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconBoxAmber: {
    width: 42,
    height: 42,
    borderRadius: RADIUS.md,
    backgroundColor: 'rgba(245, 158, 11, 0.15)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconBoxEmerald: {
    width: 42,
    height: 42,
    borderRadius: RADIUS.md,
    backgroundColor: 'rgba(16, 185, 129, 0.15)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  quickModeTitle: {
    fontSize: 15,
    fontWeight: '900',
    color: COLORS.white,
  },
  quickModeSub: {
    fontSize: 12,
    color: COLORS.slate[400],
    marginTop: 2,
  },
  rulesBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(3, 5, 9, 0.9)',
    justifyContent: 'flex-end',
  },
  rulesCard: {
    width: '100%',
    maxHeight: '90%',
    backgroundColor: COLORS.dark[900],
    borderTopLeftRadius: RADIUS.xxl,
    borderTopRightRadius: RADIUS.xxl,
    borderWidth: 1,
    borderColor: COLORS.slate[800],
    padding: SPACING.xl,
    paddingBottom: SPACING.xl * 2,
  },
  rulesHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: SPACING.lg,
  },
  rulesTitle: {
    fontSize: 22,
    fontWeight: '900',
    color: COLORS.white,
  },
  rulesCloseBtn: {
    padding: 8,
    borderRadius: RADIUS.round,
    backgroundColor: COLORS.dark[800],
  },
  rulesScroll: {
    marginVertical: SPACING.sm,
  },
  ruleBoxCiv: {
    backgroundColor: 'rgba(6, 182, 212, 0.08)',
    borderWidth: 1,
    borderColor: 'rgba(6, 182, 212, 0.3)',
    borderRadius: RADIUS.xl,
    padding: SPACING.lg,
    marginBottom: SPACING.md,
  },
  ruleRoleCiv: {
    fontSize: 15,
    fontWeight: '900',
    color: COLORS.civilian.default,
    marginBottom: 6,
  },
  ruleBoxImp: {
    backgroundColor: 'rgba(244, 63, 94, 0.08)',
    borderWidth: 1,
    borderColor: 'rgba(244, 63, 94, 0.3)',
    borderRadius: RADIUS.xl,
    padding: SPACING.lg,
    marginBottom: SPACING.md,
  },
  ruleRoleImp: {
    fontSize: 15,
    fontWeight: '900',
    color: COLORS.imposter.default,
    marginBottom: 6,
  },
  ruleBoxFlow: {
    backgroundColor: COLORS.dark[950],
    borderWidth: 1,
    borderColor: COLORS.slate[800],
    borderRadius: RADIUS.xl,
    padding: SPACING.lg,
    marginBottom: SPACING.xl,
  },
  ruleRoleFlow: {
    fontSize: 15,
    fontWeight: '900',
    color: COLORS.white,
    marginBottom: 10,
  },
  ruleStep: {
    fontSize: 13,
    color: COLORS.slate[400],
    lineHeight: 20,
    marginBottom: 8,
  },
  boldWhite: {
    color: COLORS.white,
    fontWeight: '800',
  },
  ruleDesc: {
    fontSize: 13,
    color: COLORS.slate[300],
    lineHeight: 20,
  },
  rulesUnderstoodBtn: {
    marginTop: SPACING.md,
    width: '100%',
  },
});