import React, { useEffect, useState, useCallback } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
  Alert,
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
} from 'lucide-react-native';
import { useAuth } from '../context/AuthContext';
import { useSocket } from '../context/SocketContext';
import { PlayerAvatar } from '../components/PlayerAvatar';
import { CategorySelectorModal } from '../components/CategorySelectorModal';
import { KickConfirmModal } from '../components/KickConfirmModal';
import { DisconnectedBanner } from '../components/DisconnectedBanner';
import { RejoinApprovalModal } from '../components/RejoinApprovalModal';
import { VoiceControls } from '../components/VoiceControls';
import { Card } from '../components/common/Card';
import { GradientButton } from '../components/common/GradientButton';
import { COLORS } from '../theme/colors';
import { RADIUS, SPACING } from '../theme/spacing';
import { sounds } from '../utils/sound';
import { Player } from '../types';

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

  const [copied, setCopied] = useState<boolean>(false);
  const [showCategorySelector, setShowCategorySelector] = useState<boolean>(false);
  const [playerToKick, setPlayerToKick] = useState<Player | null>(null);
  const [startError, setStartError] = useState<string>('');
  const [isLeaving, setIsLeaving] = useState<boolean>(false);

  const normalizedCode = (roomCode || '').toUpperCase();

  // If player was kicked, redirect to Home
  useEffect(() => {
    if (kickedNotice) {
      navigation.navigate('Home');
    }
  }, [kickedNotice]);

  // If roomState is not loaded, auto-join socket room (avoid duplicate joins during reconnect/recovery)
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

  return (
    <View style={styles.container}>
      {/* Top Header Bar */}
      <View style={styles.topBar}>
        <View style={styles.topBarLeft}>
          <TouchableOpacity
            onPress={handleLeaveRoom}
            disabled={isLeaving}
            style={styles.leaveBtn}
          >
            <LogOut size={16} color={COLORS.slate[400]} />
          </TouchableOpacity>

          {/* Room Code Badge */}
          <View style={styles.codeBadge}>
            <Text style={styles.codeLabel}>ROOM CODE</Text>
            <Text style={styles.codeText}>{normalizedCode}</Text>
            <TouchableOpacity onPress={copyRoomCode} style={styles.copyBtn}>
              {copied ? (
                <Check size={14} color={COLORS.accent.emerald} />
              ) : (
                <Copy size={14} color={COLORS.slate[300]} />
              )}
            </TouchableOpacity>
          </View>
        </View>

        {/* Audio and Mic Voice Controls */}
        <VoiceControls compact />
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        {/* Disconnected Player Countdown Banner */}
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
              <Users size={18} color={COLORS.civilian.default} />
              <Text style={styles.sectionTitle}>Players in Lobby ({players.length})</Text>
            </View>
            <View style={styles.playerCountTag}>
              <Text style={styles.playerCountText}>Min 3 • Max 50</Text>
            </View>
          </View>

          {/* Players Grid / List */}
          <View style={styles.playerList}>
            {players.map((p) => {
              const isSelf = p.id === player?.id;
              return (
                <View
                  key={p.id}
                  style={[
                    styles.playerItem,
                    isSelf ? styles.playerItemSelf : styles.playerItemOther,
                    !p.isConnected && styles.playerItemDisconnected,
                  ]}
                >
                  <View style={styles.playerItemLeft}>
                    <PlayerAvatar player={p} size="sm" />
                    <View style={styles.playerNameColumn}>
                      <View style={styles.nameRow}>
                        <Text style={styles.playerName}>{p.username}</Text>
                        {isSelf && (
                          <View style={styles.youBadge}>
                            <Text style={styles.youBadgeText}>YOU</Text>
                          </View>
                        )}
                      </View>
                      <Text style={styles.playerStatusSub}>
                        {p.isHost ? (
                          <Text style={styles.hostStatus}>Room Host</Text>
                        ) : !p.isConnected ? (
                          <Text style={styles.reconnectingStatus}>Reconnecting...</Text>
                        ) : (
                          <Text style={styles.readyStatus}>Ready</Text>
                        )}
                      </Text>
                    </View>
                  </View>

                  {/* Host Kick Option */}
                  {isHost && !isSelf && (
                    <TouchableOpacity
                      onPress={() => {
                        sounds.playClick();
                        setPlayerToKick(p);
                      }}
                      style={styles.kickBtn}
                    >
                      <UserX size={16} color={COLORS.slate[500]} />
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
                <Text style={styles.warnRose}>⚠️ Start Game locked while player disconnected</Text>
              ) : !hasCategories ? (
                <Text style={styles.warnAmber}>⚠️ At least 1 word category required</Text>
              ) : (
                <Text style={styles.readyEmerald}>✅ Lobby Ready to Start!</Text>
              )}
            </Text>

            {isHost ? (
              <GradientButton
                title="Start Game"
                onPress={handleStartGame}
                disabled={!canStart}
                icon={<Play size={16} color={COLORS.white} fill={COLORS.white} />}
                iconPosition="left"
                style={styles.startBtn}
              />
            ) : (
              <View style={styles.waitingForHostBox}>
                <Text style={styles.waitingForHostText}>Waiting for Host to start...</Text>
              </View>
            )}
          </View>
        </Card>

        {/* Word Categories Card */}
        <Card style={styles.sectionCard}>
          <View style={styles.categoryCardInner}>
            <View style={styles.rowAlign}>
              <Layers size={16} color={COLORS.civilian.default} />
              <Text style={styles.categoryCardTitle}>
                Word Categories ({sharedCategorySlugs.length})
              </Text>
            </View>
            <Text style={styles.categoryCardNames} numberOfLines={2}>
              {sharedCategoryNames.join(', ')}
            </Text>
            <GradientButton
              title="Change Categories"
              onPress={() => setShowCategorySelector(true)}
              variant="cyan"
              size="sm"
              icon={<Layers size={14} color={COLORS.white} />}
              iconPosition="left"
            />
          </View>
        </Card>

        {/* Game Settings Card */}
        <Card style={styles.sectionCard}>
          <View style={styles.sectionHeaderRow}>
            <View style={styles.rowAlign}>
              <Settings size={18} color={COLORS.imposter.default} />
              <Text style={styles.sectionTitle}>Game Settings</Text>
            </View>
            <View style={isHost ? styles.hostSettingsTag : styles.readOnlyTag}>
              <Text style={isHost ? styles.hostSettingsTagText : styles.readOnlyTagText}>
                {isHost ? 'Host Controls' : 'Read Only'}
              </Text>
            </View>
          </View>

          {isHost ? (
            /* Interactive Host Controls */
            <View style={styles.hostControlsList}>
              {/* Imposter Count */}
              <View style={styles.settingBlock}>
                <Text style={styles.settingLabel}>Number of Imposters</Text>
                <View style={styles.segmentedRow}>
                  {[1, 2, 3].map((num) => {
                    const isSelected = settings.impostersCount === num;
                    return (
                      <TouchableOpacity
                        key={num}
                        onPress={() => {
                          sounds.playClick();
                          if (player?.id) {
                            updateSettings(normalizedCode, player.id, { impostersCount: num });
                          }
                        }}
                        style={[
                          styles.segmentedBtn,
                          isSelected ? styles.segmentedBtnSelectedRose : styles.segmentedBtnUnselected,
                        ]}
                      >
                        <Text
                          style={[
                            styles.segmentedBtnText,
                            isSelected && styles.segmentedBtnTextRose,
                          ]}
                        >
                          {num} {num === 1 ? 'Imposter' : 'Imposters'}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              </View>

              {/* Turn Duration */}
              <View style={styles.settingBlock}>
                <Text style={styles.settingLabel}>Turn Clue Timer</Text>
                <View style={styles.segmentedRow}>
                  {[15, 30, 45, 60].map((sec) => {
                    const isSelected = settings.turnDurationSeconds === sec;
                    return (
                      <TouchableOpacity
                        key={sec}
                        onPress={() => {
                          sounds.playClick();
                          if (player?.id) {
                            updateSettings(normalizedCode, player.id, { turnDurationSeconds: sec });
                          }
                        }}
                        style={[
                          styles.segmentedBtn,
                          isSelected ? styles.segmentedBtnSelectedCyan : styles.segmentedBtnUnselected,
                        ]}
                      >
                        <Text
                          style={[
                            styles.segmentedBtnText,
                            isSelected && styles.segmentedBtnTextCyan,
                          ]}
                        >
                          {sec}s
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              </View>

              {/* Voting Duration */}
              <View style={styles.settingBlock}>
                <Text style={styles.settingLabel}>Voting Timer</Text>
                <View style={styles.segmentedRow}>
                  {[30, 45, 60].map((sec) => {
                    const isSelected = settings.votingDurationSeconds === sec;
                    return (
                      <TouchableOpacity
                        key={sec}
                        onPress={() => {
                          sounds.playClick();
                          if (player?.id) {
                            updateSettings(normalizedCode, player.id, { votingDurationSeconds: sec });
                          }
                        }}
                        style={[
                          styles.segmentedBtn,
                          isSelected ? styles.segmentedBtnSelectedCyan : styles.segmentedBtnUnselected,
                        ]}
                      >
                        <Text
                          style={[
                            styles.segmentedBtnText,
                            isSelected && styles.segmentedBtnTextCyan,
                          ]}
                        >
                          {sec}s
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              </View>

              {/* Lobby Disconnect Timeout */}
              <View style={styles.settingBlock}>
                <Text style={styles.settingLabel}>Lobby Disconnect Timeout</Text>
                <View style={styles.segmentedRow}>
                  {[3, 5, 10, 15, 30].map((sec) => {
                    const isSelected = (settings.lobbyDisconnectTimeout || 5) === sec;
                    return (
                      <TouchableOpacity
                        key={sec}
                        onPress={() => {
                          sounds.playClick();
                          if (player?.id) {
                            updateSettings(normalizedCode, player.id, { lobbyDisconnectTimeout: sec });
                          }
                        }}
                        style={[
                          styles.segmentedBtn,
                          isSelected ? styles.segmentedBtnSelectedRose : styles.segmentedBtnUnselected,
                        ]}
                      >
                        <Text
                          style={[
                            styles.segmentedBtnText,
                            isSelected && styles.segmentedBtnTextRose,
                          ]}
                        >
                          {sec}s
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              </View>
            </View>
          ) : (
            /* Non-Host Read-Only Summary */
            <View style={styles.readOnlySummaryBox}>
              <View style={styles.summaryRow}>
                <Text style={styles.summaryLabel}>Imposters</Text>
                <Text style={styles.summaryValue}>
                  {settings.impostersCount || 1} {settings.impostersCount === 1 ? 'Imposter' : 'Imposters'}
                </Text>
              </View>
              <View style={styles.summaryRow}>
                <Text style={styles.summaryLabel}>Turn Clue Timer</Text>
                <Text style={styles.summaryValue}>{settings.turnDurationSeconds || 30} seconds</Text>
              </View>
              <View style={styles.summaryRow}>
                <Text style={styles.summaryLabel}>Voting Timer</Text>
                <Text style={styles.summaryValue}>{settings.votingDurationSeconds || 45} seconds</Text>
              </View>
              <View style={styles.summaryRow}>
                <Text style={styles.summaryLabel}>Disconnect Timeout</Text>
                <Text style={styles.summaryValue}>{settings.lobbyDisconnectTimeout || 5} seconds</Text>
              </View>
            </View>
          )}
        </Card>
      </ScrollView>

      {/* Multi-Category Picker Modal */}
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

      {/* Kick Player Modal */}
      {playerToKick && (
        <KickConfirmModal
          player={playerToKick}
          onConfirm={handleKickConfirm}
          onCancel={() => setPlayerToKick(null)}
        />
      )}

      {/* Host Approval Modal for Kicked Player Rejoin Request */}
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
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.dark[950],
  },
  topBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: SPACING.lg,
    paddingVertical: SPACING.md,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(30, 41, 59, 0.7)',
    backgroundColor: 'rgba(7, 9, 14, 0.95)',
  },
  topBarLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
  },
  leaveBtn: {
    padding: SPACING.sm,
    borderRadius: RADIUS.md,
    backgroundColor: COLORS.dark[900],
    borderWidth: 1,
    borderColor: COLORS.slate[800],
  },
  codeBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.dark[900],
    borderWidth: 1,
    borderColor: COLORS.slate[800],
    borderRadius: RADIUS.lg,
    paddingHorizontal: SPACING.md,
    paddingVertical: 6,
    gap: SPACING.sm,
  },
  codeLabel: {
    fontSize: 9,
    fontWeight: '800',
    color: COLORS.slate[400],
  },
  codeText: {
    fontFamily: 'monospace',
    fontSize: 18,
    fontWeight: '900',
    color: COLORS.civilian.default,
    letterSpacing: 2,
  },
  copyBtn: {
    padding: 5,
    borderRadius: RADIUS.sm,
    backgroundColor: COLORS.dark[800],
  },
  scrollContent: {
    padding: SPACING.md,
    paddingBottom: 40,
    gap: SPACING.md,
  },
  errorBox: {
    backgroundColor: 'rgba(244, 63, 94, 0.12)',
    borderWidth: 1,
    borderColor: 'rgba(244, 63, 94, 0.35)',
    borderRadius: RADIUS.md,
    padding: SPACING.md,
  },
  errorText: {
    color: COLORS.imposter.default,
    fontSize: 12,
    fontWeight: '700',
    textAlign: 'center',
  },
  sectionCard: {
    width: '100%',
  },
  sectionHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: SPACING.md,
  },
  rowAlign: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: COLORS.white,
  },
  playerCountTag: {
    backgroundColor: COLORS.dark[800],
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: RADIUS.round,
  },
  playerCountText: {
    fontSize: 10,
    color: COLORS.slate[400],
    fontWeight: '600',
  },
  playerList: {
    gap: SPACING.sm,
    marginBottom: SPACING.lg,
  },
  playerItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: SPACING.md,
    borderRadius: RADIUS.lg,
    borderWidth: 1,
  },
  playerItemOther: {
    backgroundColor: 'rgba(22, 30, 46, 0.6)',
    borderColor: COLORS.slate[800],
  },
  playerItemSelf: {
    backgroundColor: 'rgba(6, 182, 212, 0.1)',
    borderColor: 'rgba(6, 182, 212, 0.35)',
  },
  playerItemDisconnected: {
    backgroundColor: 'rgba(244, 63, 94, 0.1)',
    borderColor: 'rgba(244, 63, 94, 0.35)',
  },
  playerItemLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.md,
    flex: 1,
  },
  playerNameColumn: {
    flex: 1,
  },
  nameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  playerName: {
    fontSize: 14,
    fontWeight: '700',
    color: COLORS.white,
  },
  youBadge: {
    backgroundColor: 'rgba(6, 182, 212, 0.2)',
    paddingHorizontal: 5,
    paddingVertical: 1,
    borderRadius: 4,
  },
  youBadgeText: {
    fontSize: 9,
    fontWeight: '800',
    color: COLORS.civilian.default,
  },
  playerStatusSub: {
    fontSize: 11,
    marginTop: 2,
  },
  hostStatus: {
    color: '#fbbf24',
    fontWeight: '700',
  },
  reconnectingStatus: {
    color: COLORS.imposter.default,
    fontWeight: '700',
  },
  readyStatus: {
    color: COLORS.accent.emerald,
    fontWeight: '600',
  },
  kickBtn: {
    padding: 6,
    borderRadius: RADIUS.sm,
    backgroundColor: 'rgba(244, 63, 94, 0.1)',
  },
  startActionFooter: {
    borderTopWidth: 1,
    borderTopColor: COLORS.slate[800],
    paddingTop: SPACING.md,
    gap: SPACING.sm,
  },
  statusHelperText: {
    fontSize: 11,
    fontWeight: '600',
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
  },
  waitingForHostBox: {
    backgroundColor: COLORS.dark[800],
    borderRadius: RADIUS.lg,
    paddingVertical: 12,
    alignItems: 'center',
  },
  waitingForHostText: {
    fontSize: 12,
    fontWeight: '700',
    color: COLORS.slate[400],
  },
  categoryCardInner: {
    backgroundColor: 'rgba(6, 182, 212, 0.08)',
    borderWidth: 1,
    borderColor: 'rgba(6, 182, 212, 0.25)',
    borderRadius: RADIUS.lg,
    padding: SPACING.md,
    gap: SPACING.sm,
  },
  categoryCardTitle: {
    fontSize: 13,
    fontWeight: '800',
    color: '#38bdf8',
    textTransform: 'uppercase',
  },
  categoryCardNames: {
    fontSize: 12,
    color: COLORS.slate[300],
    fontWeight: '600',
  },
  hostSettingsTag: {
    backgroundColor: 'rgba(244, 63, 94, 0.15)',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: RADIUS.round,
  },
  hostSettingsTagText: {
    fontSize: 10,
    fontWeight: '800',
    color: COLORS.imposter.default,
  },
  readOnlyTag: {
    backgroundColor: COLORS.dark[800],
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: RADIUS.round,
  },
  readOnlyTagText: {
    fontSize: 10,
    fontWeight: '700',
    color: COLORS.slate[400],
  },
  hostControlsList: {
    gap: SPACING.md,
  },
  settingBlock: {
    gap: SPACING.xs,
  },
  settingLabel: {
    fontSize: 11,
    fontWeight: '800',
    color: COLORS.slate[400],
    textTransform: 'uppercase',
  },
  segmentedRow: {
    flexDirection: 'row',
    gap: 6,
  },
  segmentedBtn: {
    flex: 1,
    paddingVertical: 8,
    borderRadius: RADIUS.md,
    alignItems: 'center',
    borderWidth: 1,
  },
  segmentedBtnUnselected: {
    backgroundColor: COLORS.dark[950],
    borderColor: COLORS.slate[800],
  },
  segmentedBtnSelectedRose: {
    backgroundColor: 'rgba(244, 63, 94, 0.15)',
    borderColor: COLORS.imposter.default,
  },
  segmentedBtnSelectedCyan: {
    backgroundColor: 'rgba(6, 182, 212, 0.15)',
    borderColor: COLORS.civilian.default,
  },
  segmentedBtnText: {
    fontSize: 11,
    fontWeight: '700',
    color: COLORS.slate[400],
  },
  segmentedBtnTextRose: {
    color: '#fb7185',
  },
  segmentedBtnTextCyan: {
    color: '#38bdf8',
  },
  readOnlySummaryBox: {
    backgroundColor: COLORS.dark[950],
    borderRadius: RADIUS.lg,
    padding: SPACING.md,
    gap: SPACING.sm,
  },
  summaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 4,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.slate[800],
  },
  summaryLabel: {
    fontSize: 12,
    color: COLORS.slate[400],
  },
  summaryValue: {
    fontSize: 12,
    fontWeight: '700',
    color: COLORS.white,
  },
});

