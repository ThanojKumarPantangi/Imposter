import React, { useEffect, useState, useCallback, useRef } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
  Alert,
  Animated,
  LayoutAnimation,
  Platform,
  UIManager,
  Pressable,
} from 'react-native';
import * as Clipboard from 'expo-clipboard';
import {
  Copy,
  Check,
  Play,
  UserX,
  Settings,
  Layers,
  Users,
  LogOut,
  Crown,
  WifiOff,
  Pencil,
} from 'lucide-react-native';
import { useAuth } from '../context/AuthContext';
import { useSocket } from '../context/SocketContext';
import { useVoiceChat } from '../context/VoiceChatContext';
import { PlayerAvatar } from '../components/PlayerAvatar';
import { CategorySelectorModal } from '../components/CategorySelectorModal';
import { KickConfirmModal } from '../components/KickConfirmModal';
import { DisconnectedBanner } from '../components/DisconnectedBanner';
import { RejoinApprovalModal } from '../components/RejoinApprovalModal';
import { EditUsernameModal } from '../components/EditUsernameModal';
import { VoiceControls } from '../components/VoiceControls';
import { Card } from '../components/common/Card';
import { GradientButton } from '../components/common/GradientButton';
import { COLORS } from '../theme/colors';
import { RADIUS, SPACING } from '../theme/spacing';
import { sounds } from '../utils/sound';
import { Player } from '../types';

// Enable LayoutAnimation for Android
if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

interface LobbyScreenProps {
  route: { params: { roomCode: string } };
  navigation: any;
}

export const LobbyScreen: React.FC<LobbyScreenProps> = ({ route, navigation }) => {
  const { roomCode } = route.params;
  const { player } = useAuth();
  const {
    roomState,
    disconnectAlert,
    kickedNotice,
    pendingRejoinRequest,
    approveRejoin,
    denyRejoin,
    updateSettings,
    updateRoomCategories,
    updatePlayerCategories,
    kickPlayer,
    startGame,
    joinRoom,
    leaveRoom,
    roomLifecycleState,
  } = useSocket();
  const { activeSpeakerIds } = useVoiceChat();

  const [copied, setCopied] = useState<boolean>(false);
  const [showCategorySelector, setShowCategorySelector] = useState<boolean>(false);
  const [showEditProfile, setShowEditProfile] = useState<boolean>(false);
  const [playerToKick, setPlayerToKick] = useState<Player | null>(null);
  const [startError, setStartError] = useState<string>('');
  const [isLeaving, setIsLeaving] = useState<boolean>(false);

  const normalizedCode = (roomCode || '').toUpperCase();

  // Animations
  const copyScaleAnim = useRef(new Animated.Value(1)).current;
  const pulseAnim = useRef(new Animated.Value(1)).current;

  // Pulse animation for the start button when ready
  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, {
          toValue: 1.03,
          duration: 1000,
          useNativeDriver: true,
        }),
        Animated.timing(pulseAnim, {
          toValue: 1,
          duration: 1000,
          useNativeDriver: true,
        }),
      ])
    ).start();
  }, [pulseAnim]);

  // If player was kicked, redirect to Home
  useEffect(() => {
    if (kickedNotice) {
      navigation.navigate('Home');
    }
  }, [kickedNotice]);

  // If roomState is not loaded, auto-join socket room
  useEffect(() => {
    if (kickedNotice) return;
    if (isLeaving || roomLifecycleState === 'INTENTIONAL_EXIT' || roomLifecycleState === 'NO_ROOM' || roomLifecycleState === 'TEMPORARILY_DISCONNECTED') return;
    if (player && (!roomState || roomState.code !== normalizedCode)) {
      joinRoom(normalizedCode, player);
    }
  }, [normalizedCode, player, roomState, kickedNotice, isLeaving, roomLifecycleState]);

  // Navigate to Game view when room status changes away from WAITING
  useEffect(() => {
    if (roomState && roomState.status && roomState.status !== 'WAITING') {
      navigation.replace('GameView', { roomCode: normalizedCode });
    }
  }, [roomState?.status, normalizedCode]);

  const handleLeaveRoom = useCallback(async () => {
    if (isLeaving) return;
    setIsLeaving(true);
    sounds.playClick();
    try {
      if (player?.id) {
        await leaveRoom(normalizedCode, player.id);
      }
    } finally {
      navigation.replace('Home');
    }
  }, [leaveRoom, normalizedCode, player?.id, isLeaving]);

  const isHost = roomState?.hostId === player?.id;
  const players = roomState?.players || [];

  // Animate layout when players join/leave
  useEffect(() => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
  }, [players.length]);

  const settings = roomState?.settings || {
    impostersCount: 1,
    turnDurationSeconds: 30,
    votingDurationSeconds: 45,
    lobbyDisconnectTimeout: 5,
  };

  const sharedCategorySlugs =
    roomState?.settings?.categorySlugs || roomState?.settings?.selectedCategories || ['fruits'];
  const sharedCategoryNames = roomState?.settings?.categoryNames || ['Fruits'];

  const hasDisconnected = players.some((p) => !p.isConnected) || !!disconnectAlert;
  const minPlayersMet = players.length >= 3;
  const hasCategories = Array.isArray(sharedCategorySlugs) && sharedCategorySlugs.length > 0;
  const canStart = isHost && minPlayersMet && !hasDisconnected && hasCategories;

  const copyRoomCode = async () => {
    sounds.playClick();
    await Clipboard.setStringAsync(normalizedCode);
    setCopied(true);

    // Pop animation
    Animated.sequence([
      Animated.timing(copyScaleAnim, { toValue: 1.25, duration: 150, useNativeDriver: true }),
      Animated.timing(copyScaleAnim, { toValue: 1, duration: 150, useNativeDriver: true })
    ]).start();

    setTimeout(() => setCopied(false), 2000);
  };

  const handleStartGame = () => {
    setStartError('');
    if (!canStart) {
      if (!minPlayersMet) {
        setStartError('Need at least 3 players to start the game.');
      } else if (hasDisconnected) {
        setStartError('Cannot start while a player is temporarily disconnected.');
      } else if (!hasCategories) {
        setStartError('At least one word category must be selected for the room.');
      }
      return;
    }
    sounds.playClick();
    if (player?.id) {
      startGame(normalizedCode, player.id);
    }
  };

  const handleKickConfirm = (targetId: string) => {
    sounds.playClick();
    if (player?.id) {
      kickPlayer(normalizedCode, player.id, targetId);
    }
    setPlayerToKick(null);
  };

  // Helper component for animated toggle buttons
  const AnimatedSegmentButton = ({ sec, isSelected, label, onSelect, activeColor }: any) => {
    const scale = useRef(new Animated.Value(1)).current;

    return (
      <Pressable
        onPressIn={() => Animated.spring(scale, { toValue: 0.9, useNativeDriver: true }).start()}
        onPressOut={() => Animated.spring(scale, { toValue: 1, useNativeDriver: true }).start()}
        onPress={onSelect}
        style={{ flex: 1 }}
      >
        <Animated.View
          style={[
            styles.segmentedBtn,
            isSelected ? [styles.segmentedBtnSelected, { borderColor: activeColor, backgroundColor: `${activeColor}20` }] : styles.segmentedBtnUnselected,
            { transform: [{ scale }] }
          ]}
        >
          <Text style={[styles.segmentedBtnText, isSelected && { color: activeColor }]}>
            {label}
          </Text>
        </Animated.View>
      </Pressable>
    );
  };

  return (
    <View style={styles.container}>
      {/* Top Header Bar */}
      <View style={styles.topBar}>
        <View style={styles.topBarLeft}>
          <TouchableOpacity
            onPress={handleLeaveRoom}
            disabled={isLeaving}
            style={styles.leaveBtn}
            activeOpacity={0.7}
          >
            <LogOut size={18} color={COLORS.slate[300]} />
          </TouchableOpacity>

          {/* Premium Room Code Badge */}
          <TouchableOpacity onPress={copyRoomCode} activeOpacity={0.8}>
            <Animated.View style={[styles.codeBadge, { transform: [{ scale: copyScaleAnim }] }]}>
              <Text style={styles.codeText}>{normalizedCode}</Text>
              <View style={styles.copyBtnInner}>
                {copied ? (
                  <Check size={18} color={COLORS.accent.emerald} strokeWidth={3} />
                ) : (
                  <Copy size={18} color={COLORS.civilian.default} />
                )}
              </View>
            </Animated.View>
          </TouchableOpacity>
        </View>

        <VoiceControls compact />
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        <DisconnectedBanner alertData={disconnectAlert} />

        {startError ? (
          <View style={styles.errorBox}>
            <Text style={styles.errorText}>{startError}</Text>
          </View>
        ) : null}

        {/* Players List Card */}
        <Card style={styles.sectionCard}>
          <View style={styles.sectionHeaderRow}>
            <View style={styles.rowAlign}>
              <View style={styles.iconContainerBlue}>
                <Users size={16} color={COLORS.civilian.default} />
              </View>
              <Text style={styles.sectionTitle}>Lobby Players</Text>
            </View>
            <View style={styles.playerCountTag}>
              <Text style={styles.playerCountText}>{players.length} / 50</Text>
            </View>
          </View>

          <View style={styles.playerList}>
            {players.map((p) => {
              const isSelf = p.id === player?.id;
              const isDisconnected = !p.isConnected;
              return (
                <View
                  key={p.id}
                  style={[
                    styles.playerItem,
                    isSelf && styles.playerItemSelf,
                    isDisconnected && styles.playerItemDisconnected,
                  ]}
                >
                  <View style={styles.playerItemLeft}>
                    <PlayerAvatar player={p} size="sm" isSpeaking={Boolean(activeSpeakerIds?.includes(p.id))} />
                    <View style={styles.playerNameColumn}>
                      <View style={styles.nameRow}>
                        <Text style={[styles.playerName, isDisconnected && styles.playerNameDimmed]}>
                          {p.username}
                        </Text>
                        {isSelf && (
                          <>
                            <View style={styles.youBadge}>
                              <Text style={styles.youBadgeText}>YOU</Text>
                            </View>
                            <TouchableOpacity
                              onPress={() => {
                                sounds.playClick();
                                setShowEditProfile(true);
                              }}
                              style={styles.renameButton}
                              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                              activeOpacity={0.7}
                            >
                              <Pencil size={12} color={COLORS.slate[400]} />
                            </TouchableOpacity>
                          </>
                        )}
                      </View>

                      {isDisconnected ? (
                        <View style={styles.statusRow}>
                          <WifiOff size={10} color={COLORS.imposter.default} />
                          <Text style={styles.reconnectingStatus}>Reconnecting...</Text>
                        </View>
                      ) : (
                        <Text style={styles.readyStatus}>Ready to play</Text>
                      )}
                    </View>
                  </View>

                  {isHost && !isSelf && (
                    <TouchableOpacity
                      onPress={() => {
                        sounds.playClick();
                        setPlayerToKick(p);
                      }}
                      style={styles.kickBtn}
                      activeOpacity={0.7}
                    >
                      <UserX size={16} color={COLORS.slate[400]} />
                    </TouchableOpacity>
                  )}
                </View>
              );
            })}
          </View>

          {/* Start Action Footer */}
          <View style={styles.startActionFooter}>
            <Text style={styles.statusHelperText}>
              {!minPlayersMet ? (
                <Text style={styles.warnAmber}>⚠️ Waiting for {3 - players.length} more players</Text>
              ) : hasDisconnected ? (
                <Text style={styles.warnRose}>⚠️ Start locked while a player is disconnected</Text>
              ) : !hasCategories ? (
                <Text style={styles.warnAmber}>⚠️ At least 1 word category required</Text>
              ) : (
                <Text style={styles.readyEmerald}>✨ All players ready!</Text>
              )}
            </Text>

            {isHost ? (
              <Animated.View style={canStart ? { transform: [{ scale: pulseAnim }] } : {}}>
                <GradientButton
                  title="Start Game"
                  onPress={handleStartGame}
                  disabled={!canStart}
                  icon={<Play size={18} color={COLORS.white} fill={COLORS.white} />}
                  iconPosition="left"
                  style={styles.startBtn}
                />
              </Animated.View>
            ) : (
              <View style={styles.waitingForHostBox}>
                <View style={styles.waitingDot} />
                <Text style={styles.waitingForHostText}>Waiting for Host to start</Text>
              </View>
            )}
          </View>
        </Card>

        {/* Word Categories Card */}
        <Card style={styles.sectionCard}>
          <View style={styles.categoryCardInner}>
            <View style={styles.categoryHeader}>
              <View style={styles.rowAlign}>
                <View style={styles.iconContainerBlue}>
                  <Layers size={16} color={COLORS.civilian.default} />
                </View>
                <Text style={styles.sectionTitle}>
                  Categories <Text style={styles.categoryCount}>({sharedCategorySlugs.length})</Text>
                </Text>
              </View>

              {/* Removed the isHost check here so anyone can edit */}
              <TouchableOpacity
                style={styles.editCategoriesBtn}
                onPress={() => setShowCategorySelector(true)}
                activeOpacity={0.7}
              >
                <Text style={styles.editCategoriesText}>Edit</Text>
              </TouchableOpacity>
            </View>

            <View style={styles.categoryPillContainer}>
              {sharedCategoryNames.map((name, index) => (
                <View key={index} style={styles.categoryPill}>
                  <Text style={styles.categoryPillText}>{name}</Text>
                </View>
              ))}
            </View>
          </View>
        </Card>

        {/* Game Settings Card */}
        <Card style={styles.sectionCard}>
          <View style={styles.sectionHeaderRow}>
            <View style={styles.rowAlign}>
              <View style={styles.iconContainerRed}>
                <Settings size={16} color={COLORS.imposter.default} />
              </View>
              <Text style={styles.sectionTitle}>Game Rules</Text>
            </View>
            <View style={isHost ? styles.hostSettingsTag : styles.readOnlyTag}>
              <Text style={isHost ? styles.hostSettingsTagText : styles.readOnlyTagText}>
                {isHost ? 'Host Controls' : 'Read Only'}
              </Text>
            </View>
          </View>

          {isHost ? (
            <View style={styles.hostControlsList}>
              <View style={styles.settingBlock}>
                <Text style={styles.settingLabel}>Number of Imposters</Text>
                <View style={styles.segmentedRow}>
                  {[1, 2, 3].map((num) => (
                    <AnimatedSegmentButton
                      key={num}
                      sec={num}
                      label={`${num}`}
                      isSelected={settings.impostersCount === num}
                      activeColor="#fb7185" // Rose
                      onSelect={() => {
                        sounds.playClick();
                        if (player?.id) updateSettings(normalizedCode, player.id, { impostersCount: num });
                      }}
                    />
                  ))}
                </View>
              </View>

              <View style={styles.settingBlock}>
                <Text style={styles.settingLabel}>Turn Clue Timer</Text>
                <View style={styles.segmentedRow}>
                  {[15, 30, 45, 60].map((sec) => (
                    <AnimatedSegmentButton
                      key={sec}
                      sec={sec}
                      label={`${sec}s`}
                      isSelected={settings.turnDurationSeconds === sec}
                      activeColor="#38bdf8" // Cyan
                      onSelect={() => {
                        sounds.playClick();
                        if (player?.id) updateSettings(normalizedCode, player.id, { turnDurationSeconds: sec });
                      }}
                    />
                  ))}
                </View>
              </View>

              <View style={styles.settingBlock}>
                <Text style={styles.settingLabel}>Voting Timer</Text>
                <View style={styles.segmentedRow}>
                  {[30, 45, 60].map((sec) => (
                    <AnimatedSegmentButton
                      key={sec}
                      sec={sec}
                      label={`${sec}s`}
                      isSelected={settings.votingDurationSeconds === sec}
                      activeColor="#38bdf8"
                      onSelect={() => {
                        sounds.playClick();
                        if (player?.id) updateSettings(normalizedCode, player.id, { votingDurationSeconds: sec });
                      }}
                    />
                  ))}
                </View>
              </View>

              <View style={styles.settingBlock}>
                <Text style={styles.settingLabel}>Disconnect Timeout</Text>
                <View style={styles.segmentedRow}>
                  {[3, 5, 10, 15, 30].map((sec) => (
                    <AnimatedSegmentButton
                      key={sec}
                      sec={sec}
                      label={`${sec}s`}
                      isSelected={(settings.lobbyDisconnectTimeout || 5) === sec}
                      activeColor="#fb7185"
                      onSelect={() => {
                        sounds.playClick();
                        if (player?.id) updateSettings(normalizedCode, player.id, { lobbyDisconnectTimeout: sec });
                      }}
                    />
                  ))}
                </View>
              </View>
            </View>
          ) : (
            <View style={styles.readOnlySummaryBox}>
              <View style={styles.summaryRow}>
                <Text style={styles.summaryLabel}>Imposters</Text>
                <Text style={styles.summaryValue}>
                  {settings.impostersCount || 1}
                </Text>
              </View>
              <View style={styles.summaryRow}>
                <Text style={styles.summaryLabel}>Turn Clue Timer</Text>
                <Text style={styles.summaryValue}>{settings.turnDurationSeconds || 30}s</Text>
              </View>
              <View style={styles.summaryRow}>
                <Text style={styles.summaryLabel}>Voting Timer</Text>
                <Text style={styles.summaryValue}>{settings.votingDurationSeconds || 45}s</Text>
              </View>
              <View style={[styles.summaryRow, { borderBottomWidth: 0 }]}>
                <Text style={styles.summaryLabel}>Disconnect Timeout</Text>
                <Text style={styles.summaryValue}>{settings.lobbyDisconnectTimeout || 5}s</Text>
              </View>
            </View>
          )}
        </Card>
      </ScrollView>

      {/* Modals remain exactly the same functionally */}
      <CategorySelectorModal
        visible={showCategorySelector}
        selectedSlugs={sharedCategorySlugs}
        onSelect={(chosenCats) => {
          const updater = updateRoomCategories || updatePlayerCategories;
          if (player?.id) {
            updater(
              normalizedCode,
              player.id,
              chosenCats.map((c) => c.slug),
              chosenCats.map((c) => c.name)
            );
          }
        }}
        onClose={() => setShowCategorySelector(false)}
      />

      {playerToKick && (
        <KickConfirmModal
          player={playerToKick}
          onConfirm={handleKickConfirm}
          onCancel={() => setPlayerToKick(null)}
        />
      )}

      {isHost && pendingRejoinRequest && (
        <RejoinApprovalModal
          request={pendingRejoinRequest}
          onApprove={() => {
            if (player?.id) {
              approveRejoin(
                pendingRejoinRequest.requestId,
                normalizedCode,
                player.id,
                pendingRejoinRequest.player.id
              );
            }
          }}
          onDeny={() => {
            if (player?.id) {
              denyRejoin(
                pendingRejoinRequest.requestId,
                normalizedCode,
                player.id,
                pendingRejoinRequest.player.id
              );
            }
          }}
        />
      )}

      <EditUsernameModal
        visible={showEditProfile}
        onClose={() => setShowEditProfile(false)}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#030509', // Deeper, more premium dark
  },
  topBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: SPACING.lg,
    paddingTop: SPACING.xl + 10, // Account for notch
    paddingBottom: SPACING.md,
    backgroundColor: 'rgba(5, 7, 12, 0.85)',
    borderBottomWidth: 1,
    borderBottomColor: COLORS.slate[800],
    zIndex: 10,
  },
  topBarLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.md,
  },
  leaveBtn: {
    padding: 10,
    borderRadius: RADIUS.round,
    backgroundColor: COLORS.dark[800],
    borderWidth: 1,
    borderColor: COLORS.slate[700],
  },
  codeBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(6, 182, 212, 0.1)',
    borderWidth: 1,
    borderColor: 'rgba(6, 182, 212, 0.3)',
    borderRadius: RADIUS.round,
    paddingHorizontal: SPACING.md,
    paddingVertical: 6,
    gap: SPACING.sm,
  },
  codeText: {
    fontFamily: 'monospace',
    fontSize: 16,
    fontWeight: '900',
    color: COLORS.white,
    letterSpacing: 2,
  },
  copyBtnInner: {
    padding: 2,
    justifyContent: 'center',
    alignItems: 'center',
  },
  scrollContent: {
    padding: SPACING.md,
    paddingBottom: 60,
    gap: SPACING.lg,
  },
  errorBox: {
    backgroundColor: 'rgba(244, 63, 94, 0.1)',
    borderWidth: 1,
    borderColor: 'rgba(244, 63, 94, 0.4)',
    borderRadius: RADIUS.md,
    padding: SPACING.md,
  },
  errorText: {
    color: COLORS.imposter.default,
    fontSize: 13,
    fontWeight: '700',
    textAlign: 'center',
  },
  sectionCard: {
    width: '100%',
    backgroundColor: COLORS.dark[900],
    borderColor: COLORS.slate[800],
    borderWidth: 1,
    borderRadius: RADIUS.xl,
    padding: SPACING.lg,
  },
  sectionHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: SPACING.lg,
  },
  rowAlign: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
  },
  iconContainerBlue: {
    padding: 6,
    backgroundColor: 'rgba(6, 182, 212, 0.15)',
    borderRadius: RADIUS.sm,
  },
  iconContainerRed: {
    padding: 6,
    backgroundColor: 'rgba(244, 63, 94, 0.15)',
    borderRadius: RADIUS.sm,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '900',
    color: COLORS.white,
    letterSpacing: 0.5,
  },
  playerCountTag: {
    backgroundColor: COLORS.dark[800],
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: RADIUS.round,
    borderWidth: 1,
    borderColor: COLORS.slate[700],
  },
  playerCountText: {
    fontSize: 11,
    color: COLORS.slate[300],
    fontWeight: '700',
  },
  playerList: {
    gap: SPACING.sm,
    marginBottom: SPACING.xl,
  },
  playerItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: SPACING.md,
    borderRadius: RADIUS.lg,
    backgroundColor: COLORS.dark[800],
    borderWidth: 1,
    borderColor: 'transparent',
  },
  playerItemSelf: {
    backgroundColor: 'rgba(6, 182, 212, 0.08)',
    borderColor: 'rgba(6, 182, 212, 0.3)',
  },
  playerItemDisconnected: {
    backgroundColor: 'rgba(244, 63, 94, 0.05)',
    borderColor: 'rgba(244, 63, 94, 0.2)',
    opacity: 0.8,
  },
  playerItemLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.md,
    flex: 1,
  },
  playerNameColumn: {
    flex: 1,
    justifyContent: 'center',
  },
  nameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  playerName: {
    fontSize: 15,
    fontWeight: '800',
    color: COLORS.white,
  },
  playerNameDimmed: {
    color: COLORS.slate[400],
  },
  youBadge: {
    backgroundColor: COLORS.civilian.default,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  youBadgeText: {
    fontSize: 9,
    fontWeight: '900',
    color: COLORS.dark[950],
  },
  renameButton: {
    padding: 3,
    borderRadius: 4,
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  statusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 4,
  },
  reconnectingStatus: {
    fontSize: 11,
    color: COLORS.imposter.default,
    fontWeight: '700',
  },
  readyStatus: {
    fontSize: 11,
    color: COLORS.slate[400],
    fontWeight: '600',
    marginTop: 2,
  },
  kickBtn: {
    padding: 8,
    borderRadius: RADIUS.round,
    backgroundColor: COLORS.dark[900],
    borderWidth: 1,
    borderColor: COLORS.slate[700],
  },
  startActionFooter: {
    borderTopWidth: 1,
    borderTopColor: COLORS.slate[800],
    paddingTop: SPACING.lg,
    gap: SPACING.md,
  },
  statusHelperText: {
    fontSize: 12,
    fontWeight: '700',
    textAlign: 'center',
  },
  warnAmber: {
    color: '#fbbf24',
  },
  warnRose: {
    color: COLORS.imposter.default,
  },
  readyEmerald: {
    color: COLORS.accent.emerald,
  },
  startBtn: {
    width: '100%',
    shadowColor: COLORS.civilian.default,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 10,
    elevation: 5,
  },
  waitingForHostBox: {
    flexDirection: 'row',
    backgroundColor: COLORS.dark[800],
    borderRadius: RADIUS.lg,
    paddingVertical: 14,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    borderWidth: 1,
    borderColor: COLORS.slate[700],
  },
  waitingDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#fbbf24',
  },
  waitingForHostText: {
    fontSize: 14,
    fontWeight: '700',
    color: COLORS.slate[300],
  },
  categoryCardInner: {
    gap: SPACING.md,
  },
  categoryHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  categoryCount: {
    color: COLORS.slate[500],
    fontSize: 16,
  },
  editCategoriesBtn: {
    backgroundColor: COLORS.dark[800],
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: RADIUS.round,
    borderWidth: 1,
    borderColor: COLORS.slate[700],
  },
  editCategoriesText: {
    color: COLORS.white,
    fontSize: 12,
    fontWeight: '700',
  },
  categoryPillContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: SPACING.sm,
  },
  categoryPill: {
    backgroundColor: 'rgba(6, 182, 212, 0.1)',
    borderWidth: 1,
    borderColor: 'rgba(6, 182, 212, 0.3)',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: RADIUS.round,
  },
  categoryPillText: {
    color: '#38bdf8',
    fontSize: 13,
    fontWeight: '700',
  },
  hostSettingsTag: {
    backgroundColor: 'rgba(244, 63, 94, 0.15)',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: RADIUS.round,
  },
  hostSettingsTagText: {
    fontSize: 10,
    fontWeight: '800',
    color: COLORS.imposter.default,
  },
  readOnlyTag: {
    backgroundColor: COLORS.dark[800],
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: RADIUS.round,
    borderWidth: 1,
    borderColor: COLORS.slate[700],
  },
  readOnlyTagText: {
    fontSize: 10,
    fontWeight: '700',
    color: COLORS.slate[400],
  },
  hostControlsList: {
    gap: SPACING.lg,
  },
  settingBlock: {
    gap: SPACING.sm,
  },
  settingLabel: {
    fontSize: 12,
    fontWeight: '800',
    color: COLORS.slate[400],
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  segmentedRow: {
    flexDirection: 'row',
    gap: 8,
  },
  segmentedBtn: {
    paddingVertical: 10,
    borderRadius: RADIUS.md,
    alignItems: 'center',
    borderWidth: 1,
  },
  segmentedBtnUnselected: {
    backgroundColor: COLORS.dark[800],
    borderColor: COLORS.slate[700],
  },
  segmentedBtnSelected: {
    // Dynamic styles applied inline based on activeColor
  },
  segmentedBtnText: {
    fontSize: 13,
    fontWeight: '800',
    color: COLORS.slate[400],
  },
  readOnlySummaryBox: {
    backgroundColor: COLORS.dark[800],
    borderRadius: RADIUS.lg,
    paddingHorizontal: SPACING.lg,
    paddingVertical: SPACING.md,
    borderWidth: 1,
    borderColor: COLORS.slate[700],
  },
  summaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.slate[700],
  },
  summaryLabel: {
    fontSize: 14,
    color: COLORS.slate[400],
    fontWeight: '600',
  },
  summaryValue: {
    fontSize: 14,
    fontWeight: '800',
    color: COLORS.white,
  },
});