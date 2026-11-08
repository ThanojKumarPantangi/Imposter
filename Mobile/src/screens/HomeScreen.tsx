import React, { useState, useEffect } from 'react';
import { useIsFocused } from '@react-navigation/native';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
  Modal,
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

  const isFocused = useIsFocused();

  // If currently focused on Home while an active session exists, smoothly restore the player to their room
  useEffect(() => {
    if (!isFocused) return;
    const lingeringCode = roomState?.code;
    if (lingeringCode && roomLifecycleState === 'ACTIVE_ROOM') {
      const targetScreen = roomState.status === 'WAITING' ? 'Lobby' : 'GameView';
      navigation.navigate(targetScreen, { roomCode: lingeringCode });
    }
  }, [roomState?.code, roomState?.status, roomLifecycleState, isFocused]);

  // Watch for approval to auto-enter lobby
  useEffect(() => {
    if (rejoinState && rejoinState.status === 'APPROVED' && rejoinState.roomCode) {
      const code = rejoinState.roomCode;
      clearRejoinState();
      joinRoom(code, player);
      navigation.navigate('Lobby', { roomCode: code });
    }
  }, [rejoinState, player]);

  // Polling fallback while waiting for approval
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
      if (
        err.requiresApproval ||
        err.status === 403 ||
        err.kicked ||
        err.message?.includes('previously removed')
      ) {
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
        onNavigateHome={() => {}}
      />

      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Hero Tag */}
        <View style={styles.heroBadge}>
          <Sparkles size={12} color="#fb7185" />
          <Text style={styles.heroBadgeText}>Real-Time Online Social Deduction</Text>
        </View>

        {/* Hero Headline */}
        <Text style={styles.heroTitle}>
          Blend In. Deceive.{'\n'}
          <Text style={styles.heroHighlight}>Unmask The Imposter.</Text>
        </Text>

        <Text style={styles.heroSubtitle}>
          Civilians receive the secret word. Imposters get only a hint. Enter subtle clues, vote out the suspect, or guess the secret word to win instantly!
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
                onPress={() => {
                  if (player?.id) leaveRoom(roomState.code, player.id);
                }}
                style={styles.leaveActiveSessionBtn}
              >
                <Text style={styles.leaveActiveSessionText}>Leave</Text>
              </TouchableOpacity>
            </View>
          </Card>
        ) : null}

        {/* Action Cards */}
        <View style={styles.cardsSection}>
          {/* Join Room Card */}
          <Card style={styles.actionCard}>
            <View style={styles.cardHeader}>
              <View style={styles.iconBoxCyan}>
                <Play size={20} color={COLORS.civilian.default} fill={COLORS.civilian.default} />
              </View>
              <View>
                <Text style={styles.cardTitle}>Join A Room</Text>
                <Text style={styles.cardSub}>Enter your friend's room code to jump in</Text>
              </View>
            </View>

            <TextInput
              value={roomCodeInput}
              onChangeText={(text) => setRoomCodeInput(text.toUpperCase())}
              placeholder="e.g. ABCD"
              placeholderTextColor={COLORS.slate[600]}
              maxLength={6}
              autoCapitalize="characters"
              style={styles.roomCodeInput}
            />

            <GradientButton
              title="Join Game"
              onPress={handleJoin}
              variant="cyan"
              loading={loading}
              disabled={loading || !roomCodeInput.trim()}
              icon={<ArrowRight size={16} color={COLORS.white} />}
              style={styles.fullWidthBtn}
            />
          </Card>

          {/* Host Room Card */}
          <Card variant="imposter" style={styles.actionCard}>
            <View style={styles.cardHeader}>
              <View style={styles.iconBoxRose}>
                <Plus size={22} color={COLORS.imposter.default} />
              </View>
              <View>
                <Text style={styles.cardTitle}>Host New Room</Text>
                <Text style={styles.cardSub}>Choose words, timers, and invite your crew</Text>
              </View>
            </View>

            <Text style={styles.hostDesc}>
              Create a private lobby with custom word categories, voice chat, and 3 to 50 player capacity.
            </Text>

            <GradientButton
              title="Create Private Lobby"
              onPress={handleCreate}
              variant="primary"
              loading={loading}
              disabled={loading}
              icon={<ArrowRight size={16} color={COLORS.white} />}
              style={styles.fullWidthBtn}
            />
          </Card>
        </View>

        {/* Quick Modes Section */}
        <View style={styles.quickModesGrid}>
          {/* Pass & Play */}
          <TouchableOpacity
            onPress={() => {
              sounds.playClick();
              navigation.navigate('PassAndPlay');
            }}
            activeOpacity={0.8}
            style={styles.quickModeCard}
          >
            <View style={styles.iconBoxPurple}>
              <Smartphone size={18} color={COLORS.accent.purple} />
            </View>
            <View>
              <Text style={styles.quickModeTitle}>Pass & Play</Text>
              <Text style={styles.quickModeSub}>Single device party mode</Text>
            </View>
          </TouchableOpacity>

          {/* Leaderboard */}
          <TouchableOpacity
            onPress={() => {
              sounds.playClick();
              navigation.navigate('Leaderboard');
            }}
            activeOpacity={0.8}
            style={styles.quickModeCard}
          >
            <View style={styles.iconBoxAmber}>
              <Trophy size={18} color={COLORS.accent.amber} />
            </View>
            <View>
              <Text style={styles.quickModeTitle}>Leaderboard</Text>
              <Text style={styles.quickModeSub}>Top detectives & bluffers</Text>
            </View>
          </TouchableOpacity>

          {/* How to Play */}
          <TouchableOpacity
            onPress={() => {
              sounds.playClick();
              setShowRules(true);
            }}
            activeOpacity={0.8}
            style={styles.quickModeCard}
          >
            <View style={styles.iconBoxEmerald}>
              <BookOpen size={18} color={COLORS.accent.emerald} />
            </View>
            <View>
              <Text style={styles.quickModeTitle}>How To Play</Text>
              <Text style={styles.quickModeSub}>Rules & winning strategies</Text>
            </View>
          </TouchableOpacity>
        </View>

        {/* Admin Link */}
        <TouchableOpacity
          onPress={() => {
            sounds.playClick();
            navigation.navigate('AdminLogin');
          }}
          activeOpacity={0.7}
          style={styles.adminFooterLink}
        >
          <Shield size={14} color={COLORS.slate[500]} />
          <Text style={styles.adminFooterText}>Admin Portal</Text>
        </TouchableOpacity>
      </ScrollView>

      {/* Rules Modal */}
      <Modal visible={showRules} transparent animationType="fade" onRequestClose={() => setShowRules(false)}>
        <View style={styles.rulesBackdrop}>
          <View style={styles.rulesCard}>
            <View style={styles.rulesHeader}>
              <Text style={styles.rulesTitle}>Game Rules & Roles</Text>
              <TouchableOpacity onPress={() => setShowRules(false)} style={styles.rulesCloseBtn}>
                <X size={18} color={COLORS.slate[400]} />
              </TouchableOpacity>
            </View>

            <ScrollView showsVerticalScrollIndicator={false} style={styles.rulesScroll}>
              {/* Civilian */}
              <View style={styles.ruleBoxCiv}>
                <Text style={styles.ruleRoleCiv}>Civilian</Text>
                <Text style={styles.ruleDesc}>
                  Receives the actual secret word (e.g. "Apple"). Must submit a related word each turn and vote to eliminate the Imposter.
                </Text>
              </View>

              {/* Imposter */}
              <View style={styles.ruleBoxImp}>
                <Text style={styles.ruleRoleImp}>Imposter</Text>
                <Text style={styles.ruleDesc}>
                  Does NOT receive the secret word! Receives only a persistent hint (e.g. "Crisp fruit, often red or green"). Must blend in by entering believable related words, or enter the exact secret word during their turn to win instantly!
                </Text>
              </View>

              {/* Flow */}
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

      {/* Edit Profile Modal */}
      <EditUsernameModal
        visible={showEditProfile}
        onClose={() => setShowEditProfile(false)}
      />

      {/* Rejoin Waiting Modal */}
      {rejoinState && (
        <RejoinWaitingModal
          rejoinState={rejoinState}
          onCancel={clearRejoinState}
          onReturnHome={clearRejoinState}
        />
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.dark[950],
  },
  scrollContent: {
    padding: SPACING.lg,
    alignItems: 'center',
    paddingBottom: 40,
  },
  heroBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: 'rgba(244, 63, 94, 0.12)',
    borderWidth: 1,
    borderColor: 'rgba(244, 63, 94, 0.3)',
    borderRadius: RADIUS.round,
    paddingHorizontal: SPACING.md,
    paddingVertical: 5,
    marginBottom: SPACING.md,
  },
  heroBadgeText: {
    fontSize: 10,
    fontWeight: '800',
    color: '#fb7185',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  heroTitle: {
    fontSize: 28,
    fontWeight: '900',
    color: COLORS.white,
    textAlign: 'center',
    lineHeight: 34,
    marginBottom: SPACING.sm,
  },
  heroHighlight: {
    color: COLORS.imposter.default,
  },
  heroSubtitle: {
    fontSize: 13,
    color: COLORS.slate[400],
    textAlign: 'center',
    lineHeight: 19,
    maxWidth: 380,
    marginBottom: SPACING.xl,
  },
  errorBox: {
    width: '100%',
    backgroundColor: 'rgba(244, 63, 94, 0.12)',
    borderWidth: 1,
    borderColor: 'rgba(244, 63, 94, 0.35)',
    borderRadius: RADIUS.md,
    padding: SPACING.md,
    marginBottom: SPACING.md,
  },
  errorText: {
    color: COLORS.imposter.default,
    fontSize: 12,
    fontWeight: '700',
    textAlign: 'center',
  },
  activeSessionCard: {
    width: '100%',
    marginBottom: SPACING.lg,
    borderWidth: 1.5,
    borderColor: 'rgba(244, 63, 94, 0.4)',
    backgroundColor: 'rgba(244, 63, 94, 0.08)',
  },
  resumeBtnRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.md,
    marginTop: SPACING.md,
  },
  leaveActiveSessionBtn: {
    paddingHorizontal: SPACING.lg,
    paddingVertical: 12,
    borderRadius: RADIUS.md,
    backgroundColor: COLORS.dark[800],
    borderWidth: 1,
    borderColor: COLORS.slate[700],
  },
  leaveActiveSessionText: {
    color: COLORS.slate[300],
    fontSize: 13,
    fontWeight: '700',
  },
  cardsSection: {
    width: '100%',
    gap: SPACING.lg,
    marginBottom: SPACING.xl,
  },
  actionCard: {
    width: '100%',
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.md,
    marginBottom: SPACING.lg,
  },
  iconBoxCyan: {
    width: 44,
    height: 44,
    borderRadius: RADIUS.lg,
    backgroundColor: 'rgba(6, 182, 212, 0.15)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconBoxRose: {
    width: 44,
    height: 44,
    borderRadius: RADIUS.lg,
    backgroundColor: 'rgba(244, 63, 94, 0.15)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  cardTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: COLORS.white,
  },
  cardSub: {
    fontSize: 11,
    color: COLORS.slate[400],
    marginTop: 2,
  },
  roomCodeInput: {
    backgroundColor: COLORS.dark[950],
    borderWidth: 1.5,
    borderColor: COLORS.slate[700],
    borderRadius: RADIUS.md,
    paddingVertical: SPACING.md,
    paddingHorizontal: SPACING.lg,
    color: COLORS.white,
    fontFamily: 'monospace',
    fontSize: 22,
    fontWeight: '900',
    letterSpacing: 6,
    textAlign: 'center',
    marginBottom: SPACING.md,
  },
  fullWidthBtn: {
    width: '100%',
  },
  hostDesc: {
    fontSize: 12,
    color: COLORS.slate[300],
    lineHeight: 18,
    marginBottom: SPACING.lg,
  },
  quickModesGrid: {
    width: '100%',
    gap: SPACING.sm,
    marginBottom: SPACING.xl,
  },
  quickModeCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(13, 17, 23, 0.9)',
    borderWidth: 1,
    borderColor: COLORS.slate[800],
    borderRadius: RADIUS.xl,
    padding: SPACING.md,
    gap: SPACING.md,
  },
  iconBoxPurple: {
    width: 38,
    height: 38,
    borderRadius: RADIUS.md,
    backgroundColor: 'rgba(168, 85, 247, 0.15)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconBoxAmber: {
    width: 38,
    height: 38,
    borderRadius: RADIUS.md,
    backgroundColor: 'rgba(245, 158, 11, 0.15)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconBoxEmerald: {
    width: 38,
    height: 38,
    borderRadius: RADIUS.md,
    backgroundColor: 'rgba(16, 185, 129, 0.15)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  quickModeTitle: {
    fontSize: 14,
    fontWeight: '800',
    color: COLORS.white,
  },
  quickModeSub: {
    fontSize: 11,
    color: COLORS.slate[400],
    marginTop: 1,
  },
  adminFooterLink: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: SPACING.sm,
    paddingHorizontal: SPACING.md,
  },
  adminFooterText: {
    fontSize: 12,
    fontWeight: '600',
    color: COLORS.slate[500],
  },
  rulesBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(7, 9, 14, 0.85)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: SPACING.lg,
  },
  rulesCard: {
    width: '100%',
    maxWidth: 420,
    maxHeight: '80%',
    backgroundColor: COLORS.dark[900],
    borderWidth: 1,
    borderColor: COLORS.slate[800],
    borderRadius: RADIUS.xxl,
    padding: SPACING.xl,
  },
  rulesHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: SPACING.md,
  },
  rulesTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: COLORS.white,
  },
  rulesCloseBtn: {
    padding: 6,
    borderRadius: RADIUS.md,
    backgroundColor: COLORS.dark[800],
  },
  rulesScroll: {
    marginVertical: SPACING.sm,
  },
  ruleBoxCiv: {
    backgroundColor: 'rgba(6, 182, 212, 0.1)',
    borderWidth: 1,
    borderColor: 'rgba(6, 182, 212, 0.25)',
    borderRadius: RADIUS.lg,
    padding: SPACING.md,
    marginBottom: SPACING.sm,
  },
  ruleRoleCiv: {
    fontSize: 13,
    fontWeight: '800',
    color: COLORS.civilian.default,
    marginBottom: 4,
  },
  ruleBoxImp: {
    backgroundColor: 'rgba(244, 63, 94, 0.1)',
    borderWidth: 1,
    borderColor: 'rgba(244, 63, 94, 0.25)',
    borderRadius: RADIUS.lg,
    padding: SPACING.md,
    marginBottom: SPACING.sm,
  },
  ruleRoleImp: {
    fontSize: 13,
    fontWeight: '800',
    color: COLORS.imposter.default,
    marginBottom: 4,
  },
  ruleBoxFlow: {
    backgroundColor: COLORS.dark[800],
    borderWidth: 1,
    borderColor: COLORS.slate[700],
    borderRadius: RADIUS.lg,
    padding: SPACING.md,
    marginBottom: SPACING.sm,
  },
  ruleRoleFlow: {
    fontSize: 13,
    fontWeight: '800',
    color: COLORS.slate[200],
    marginBottom: 6,
  },
  ruleStep: {
    fontSize: 11,
    color: COLORS.slate[400],
    lineHeight: 16,
    marginBottom: 4,
  },
  boldWhite: {
    color: COLORS.white,
    fontWeight: '700',
  },
  ruleDesc: {
    fontSize: 11,
    color: COLORS.slate[300],
    lineHeight: 17,
  },
  rulesUnderstoodBtn: {
    marginTop: SPACING.sm,
    width: '100%',
  },
});

