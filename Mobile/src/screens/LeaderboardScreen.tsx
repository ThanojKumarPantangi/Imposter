import React, { useEffect, useState, useRef } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
  ActivityIndicator,
  Animated,
} from 'react-native';
import { Trophy, ArrowLeft, Crown, Award, Star } from 'lucide-react-native';
import { apiRequest } from '../services/api/client';
import { PlayerAvatar } from '../components/PlayerAvatar';
import { Card } from '../components/common/Card';
import { Badge } from '../components/common/Badge';
import { COLORS } from '../theme/colors';
import { RADIUS, SPACING } from '../theme/spacing';
import { sounds } from '../utils/sound';
import { Player } from '../types';

// Wrapper component to handle staggered entrance animations for each list item
const AnimatedListItem: React.FC<{ index: number; children: React.ReactNode }> = ({
  index,
  children,
}) => {
  const animValue = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.spring(animValue, {
      toValue: 1,
      delay: index * 80, // Stagger effect based on index
      tension: 60,
      friction: 8,
      useNativeDriver: true,
    }).start();
  }, [animValue, index]);

  return (
    <Animated.View
      style={{
        opacity: animValue,
        transform: [
          {
            translateY: animValue.interpolate({
              inputRange: [0, 1],
              outputRange: [30, 0], // Slide up from 30px
            }),
          },
          {
            scale: animValue.interpolate({
              inputRange: [0, 1],
              outputRange: [0.95, 1], // Subtle scale up
            }),
          },
        ],
      }}
    >
      {children}
    </Animated.View>
  );
};

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

  const renderRankIcon = (idx: number) => {
    switch (idx) {
      case 0:
        return <Crown size={18} color="#FBBF24" fill="#FBBF24" style={styles.rankIcon} />;
      case 1:
        return <Award size={18} color="#94A3B8" fill="#94A3B8" style={styles.rankIcon} />;
      case 2:
        return <Star size={18} color="#EA580C" fill="#EA580C" style={styles.rankIcon} />;
      default:
        return <Text style={styles.medalText}>#{idx + 1}</Text>;
    }
  };

  return (
    <View style={styles.container}>
      <View style={styles.topBar}>
        <TouchableOpacity
          onPress={() => {
            sounds.playClick();
            navigation.navigate('Home');
          }}
          style={styles.backBtn}
          activeOpacity={0.7}
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
              <Trophy size={48} color={COLORS.slate[700]} style={{ marginBottom: 12 }} />
              <Text style={styles.emptyText}>
                No completed matches recorded yet.{'\n'}Play a match to climb the leaderboard!
              </Text>
            </View>
          ) : (
            <View style={styles.list}>
              {leaders.map((p, idx) => (
                <AnimatedListItem key={p.id || idx} index={idx}>
                  <View
                    style={[
                      styles.rankRow,
                      idx === 0 && styles.rankRowGold,
                      idx === 1 && styles.rankRowSilver,
                      idx === 2 && styles.rankRowBronze,
                    ]}
                  >
                    <View style={styles.rankLeft}>
                      <View style={styles.rankBadgeContainer}>
                        {renderRankIcon(idx)}
                      </View>
                      <PlayerAvatar player={p} size="sm" showStatus={false} />
                      <View>
                        <Text style={[styles.rankUsername, idx < 3 && styles.topRankText]}>
                          {p.username}
                        </Text>
                        <Text style={styles.rankMatches}>
                          {p.stats?.gamesPlayed || 0} Matches Played
                        </Text>
                      </View>
                    </View>

                    <View style={styles.rankRight}>
                      <Text style={[
                        styles.rankWinsText,
                        idx === 0 && { color: '#FBBF24' },
                        idx === 1 && { color: '#CBD5E1' },
                        idx === 2 && { color: '#F97316' },
                      ]}>
                        {p.stats?.wins || 0} Wins
                      </Text>
                      <Text style={styles.rankBreakdown}>
                        Civ: {p.stats?.civilianWins || 0} • Imp: {p.stats?.imposterWins || 0}
                      </Text>
                    </View>
                  </View>
                </AnimatedListItem>
              ))}
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
    backgroundColor: COLORS.dark[950],
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
    gap: 6,
    marginTop: SPACING.sm,
    marginBottom: SPACING.xs,
  },
  title: {
    fontSize: 28,
    fontWeight: '900',
    color: COLORS.white,
    letterSpacing: 0.5,
  },
  subtitle: {
    fontSize: 13,
    color: COLORS.slate[400],
    fontWeight: '500',
  },
  leaderboardCard: {
    width: '100%',
    backgroundColor: COLORS.dark[900],
    borderColor: COLORS.slate[800],
    borderWidth: 1,
    borderRadius: RADIUS.xl,
    overflow: 'hidden',
  },
  centerBox: {
    padding: 40,
    alignItems: 'center',
    justifyContent: 'center',
    gap: SPACING.md,
  },
  loadingText: {
    fontSize: 14,
    fontWeight: '600',
    color: COLORS.slate[400],
  },
  emptyText: {
    fontSize: 14,
    color: COLORS.slate[400],
    textAlign: 'center',
    lineHeight: 22,
    fontWeight: '500',
  },
  list: {
    gap: SPACING.sm,
    padding: SPACING.sm,
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
    backgroundColor: 'rgba(245, 158, 11, 0.1)',
    borderColor: 'rgba(245, 158, 11, 0.4)',
    shadowColor: '#FBBF24',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 8,
    elevation: 3,
  },
  rankRowSilver: {
    backgroundColor: 'rgba(203, 213, 225, 0.08)',
    borderColor: 'rgba(203, 213, 225, 0.3)',
  },
  rankRowBronze: {
    backgroundColor: 'rgba(234, 88, 12, 0.08)',
    borderColor: 'rgba(234, 88, 12, 0.3)',
  },
  rankLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.md,
    flex: 1,
  },
  rankBadgeContainer: {
    width: 32,
    alignItems: 'center',
    justifyContent: 'center',
  },
  rankIcon: {
    opacity: 0.9,
  },
  medalText: {
    fontSize: 15,
    fontWeight: '800',
    color: COLORS.slate[500],
  },
  rankUsername: {
    fontSize: 15,
    fontWeight: '700',
    color: COLORS.white,
    marginBottom: 2,
  },
  topRankText: {
    fontSize: 16,
    fontWeight: '800',
  },
  rankMatches: {
    fontSize: 11,
    fontWeight: '600',
    color: COLORS.slate[500],
  },
  rankRight: {
    alignItems: 'flex-end',
    justifyContent: 'center',
  },
  rankWinsText: {
    fontSize: 16,
    fontWeight: '900',
    color: COLORS.civilian.default,
    marginBottom: 2,
  },
  rankBreakdown: {
    fontSize: 10,
    fontWeight: '700',
    color: COLORS.slate[400],
    textTransform: 'uppercase',
  },
});