import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
  ActivityIndicator,
} from 'react-native';
import { Trophy, ArrowLeft } from 'lucide-react-native';
import { apiRequest } from '../services/api/client';
import { PlayerAvatar } from '../components/PlayerAvatar';
import { Card } from '../components/common/Card';
import { Badge } from '../components/common/Badge';
import { COLORS } from '../theme/colors';
import { RADIUS, SPACING } from '../theme/spacing';
import { sounds } from '../utils/sound';
import { Player } from '../types';

export const LeaderboardScreen: React.FC<{ navigation: any }> = ({ navigation }) => {
  const [leaders, setLeaders] = useState<Player[]>([]);
  const [loading, setLoading] = useState<boolean>(true);

  useEffect(() => {
    async function load() {
      try {
        const res = await apiRequest<{ success: boolean; leaderboard: Player[] }>('/stats/leaderboard');
        if (res.success && res.leaderboard) {
          setLeaders(res.leaderboard);
        }
      } catch (err) {
        console.warn('Could not fetch online leaderboard:', err);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  return (
    <View style={styles.container}>
      <View style={styles.topBar}>
        <TouchableOpacity
          onPress={() => {
            sounds.playClick();
            navigation.navigate('Home');
          }}
          style={styles.backBtn}
        >
          <ArrowLeft size={16} color={COLORS.slate[300]} />
          <Text style={styles.backBtnText}>Home</Text>
        </TouchableOpacity>

        <Badge label="Global Rankings" variant="civilian" icon={<Trophy size={12} color="#22d3ee" />} />
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        <View style={styles.headerTitleBox}>
          <Text style={styles.title}>Hall of Fame</Text>
          <Text style={styles.subtitle}>Top detectives and most cunning imposters</Text>
        </View>

        <Card style={styles.leaderboardCard}>
          {loading ? (
            <View style={styles.centerBox}>
              <ActivityIndicator size="large" color={COLORS.civilian.default} />
              <Text style={styles.loadingText}>Loading rankings...</Text>
            </View>
          ) : leaders.length === 0 ? (
            <View style={styles.centerBox}>
              <Text style={styles.emptyText}>
                No completed matches recorded yet. Play a match to climb the leaderboard!
              </Text>
            </View>
          ) : (
            <View style={styles.list}>
              {leaders.map((p, idx) => {
                const medal = idx === 0 ? '🥇' : idx === 1 ? '🥈' : idx === 2 ? '🥉' : `#${idx + 1}`;
                return (
                  <View
                    key={idx}
                    style={[
                      styles.rankRow,
                      idx === 0 && styles.rankRowGold,
                      idx === 1 && styles.rankRowSilver,
                      idx === 2 && styles.rankRowBronze,
                    ]}
                  >
                    <View style={styles.rankLeft}>
                      <Text style={styles.medalText}>{medal}</Text>
                      <PlayerAvatar player={p} size="sm" showStatus={false} />
                      <View>
                        <Text style={styles.rankUsername}>{p.username}</Text>
                        <Text style={styles.rankMatches}>
                          {p.stats?.gamesPlayed || 0} Matches Played
                        </Text>
                      </View>
                    </View>

                    <View style={styles.rankRight}>
                      <Text style={styles.rankWinsText}>{p.stats?.wins || 0} Wins</Text>
                      <Text style={styles.rankBreakdown}>
                        Civ: {p.stats?.civilianWins || 0} • Imp: {p.stats?.imposterWins || 0}
                      </Text>
                    </View>
                  </View>
                );
              })}
            </View>
          )}
        </Card>
      </ScrollView>
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
  },
  backBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: COLORS.dark[900],
    paddingHorizontal: SPACING.md,
    paddingVertical: 6,
    borderRadius: RADIUS.md,
    borderWidth: 1,
    borderColor: COLORS.slate[800],
  },
  backBtnText: {
    fontSize: 12,
    fontWeight: '700',
    color: COLORS.slate[300],
  },
  scrollContent: {
    padding: SPACING.md,
    paddingBottom: 40,
    gap: SPACING.lg,
  },
  headerTitleBox: {
    alignItems: 'center',
    gap: 4,
  },
  title: {
    fontSize: 26,
    fontWeight: '900',
    color: COLORS.white,
  },
  subtitle: {
    fontSize: 12,
    color: COLORS.slate[400],
  },
  leaderboardCard: {
    width: '100%',
  },
  centerBox: {
    padding: 30,
    alignItems: 'center',
    justifyContent: 'center',
    gap: SPACING.sm,
  },
  loadingText: {
    fontSize: 12,
    color: COLORS.slate[400],
  },
  emptyText: {
    fontSize: 13,
    color: COLORS.slate[500],
    textAlign: 'center',
    lineHeight: 18,
  },
  list: {
    gap: SPACING.sm,
  },
  rankRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: COLORS.dark[950],
    borderWidth: 1,
    borderColor: COLORS.slate[800],
    borderRadius: RADIUS.lg,
    padding: SPACING.md,
  },
  rankRowGold: {
    backgroundColor: 'rgba(245, 158, 11, 0.08)',
    borderColor: 'rgba(245, 158, 11, 0.3)',
  },
  rankRowSilver: {
    backgroundColor: 'rgba(203, 213, 225, 0.08)',
    borderColor: 'rgba(203, 213, 225, 0.25)',
  },
  rankRowBronze: {
    backgroundColor: 'rgba(234, 88, 12, 0.08)',
    borderColor: 'rgba(234, 88, 12, 0.25)',
  },
  rankLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.md,
    flex: 1,
  },
  medalText: {
    fontSize: 14,
    fontWeight: '800',
    minWidth: 26,
    color: COLORS.slate[400],
  },
  rankUsername: {
    fontSize: 14,
    fontWeight: '700',
    color: COLORS.white,
  },
  rankMatches: {
    fontSize: 10,
    color: COLORS.slate[400],
    marginTop: 1,
  },
  rankRight: {
    alignItems: 'flex-end',
  },
  rankWinsText: {
    fontSize: 15,
    fontWeight: '900',
    color: COLORS.civilian.default,
  },
  rankBreakdown: {
    fontSize: 9,
    fontWeight: '700',
    color: COLORS.slate[500],
    textTransform: 'uppercase',
    marginTop: 2,
  },
});

