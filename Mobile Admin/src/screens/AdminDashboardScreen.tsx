import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  TextInput,
  Modal,
  StyleSheet,
  ActivityIndicator,
  Alert,
} from 'react-native';
import {
  Layers,
  Plus,
  Trash2,
  Database,
  History,
  FileText,
  LogOut,
  X,
  Check,
  Search,
} from 'lucide-react-native';
import { useAuth } from '../context/AuthContext';
import { adminApi } from '../services/api/adminApi';
import { Card } from '../components/common/Card';
import { GradientButton } from '../components/common/GradientButton';
import { COLORS } from '../theme/colors';
import { RADIUS, SPACING } from '../theme/spacing';
import { sounds } from '../utils/sound';
import { Category, MatchHistoryEntry, AuditLogEntry } from '../types';

export const AdminDashboardScreen: React.FC<{ navigation: any }> = ({ navigation }) => {
  const { adminLogout, isAdminAuthenticated } = useAuth();

  const [activeTab, setActiveTab] = useState<'CATEGORIES' | 'HISTORY' | 'AUDIT' | 'STATS'>('CATEGORIES');
  const [stats, setStats] = useState<any>(null);
  const [categories, setCategories] = useState<Category[]>([]);
  const [selectedCategory, setSelectedCategory] = useState<Category | null>(null);
  const [historyLogs, setHistoryLogs] = useState<MatchHistoryEntry[]>([]);
  const [auditLogs, setAuditLogs] = useState<AuditLogEntry[]>([]);

  const [loading, setLoading] = useState<boolean>(true);
  const [seedLoading, setSeedLoading] = useState<boolean>(false);
  const [feedbackMsg, setFeedbackMsg] = useState<string>('');

  // Add Word Modal
  const [showAddWordModal, setShowAddWordModal] = useState<boolean>(false);
  const [newWord, setNewWord] = useState<string>('');
  const [newHint, setNewHint] = useState<string>('');
  const [newDifficulty, setNewDifficulty] = useState<'EASY' | 'MEDIUM' | 'HARD'>('EASY');

  // Add Category Modal
  const [showAddCategoryModal, setShowAddCategoryModal] = useState<boolean>(false);
  const [newCatName, setNewCatName] = useState<string>('');
  const [newCatSlug, setNewCatSlug] = useState<string>('');
  const [newCatGroup, setNewCatGroup] = useState<string>('FOOD_DRINK');
  const [newCatDesc, setNewCatDesc] = useState<string>('');

  useEffect(() => {
    if (!isAdminAuthenticated) {
      navigation.replace('AdminLogin');
      return;
    }
    loadData();
  }, [isAdminAuthenticated]);

  async function loadData() {
    setLoading(true);
    try {
      const [statsRes, catRes] = await Promise.all([
        adminApi.getStats().catch(() => ({ success: false, stats: null })),
        adminApi.getCategories().catch(() => ({ success: false, categories: [] })),
      ]);

      if (statsRes.success) setStats(statsRes.stats);
      if (catRes.success && catRes.categories) {
        setCategories(catRes.categories);
        if (catRes.categories.length > 0 && !selectedCategory) {
          setSelectedCategory(catRes.categories[0]);
        }
      }
    } finally {
      setLoading(false);
    }
  }

  async function loadHistory() {
    try {
      const res = await adminApi.getHistory();
      if (res.success) setHistoryLogs(res.history);
    } catch (e) {
      console.error(e);
    }
  }

  async function loadAudit() {
    try {
      const res = await adminApi.getAuditLogs();
      if (res.success) setAuditLogs(res.logs);
    } catch (e) {
      console.error(e);
    }
  }

  const handleTabChange = (tab: 'CATEGORIES' | 'HISTORY' | 'AUDIT' | 'STATS') => {
    sounds.playClick();
    setActiveTab(tab);
    if (tab === 'HISTORY') loadHistory();
    if (tab === 'AUDIT') loadAudit();
  };

  const handleSeedDatabase = () => {
    Alert.alert(
      'Seed MongoDB',
      'Seed database with all configured word packs and categories into MongoDB?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Seed Now',
          onPress: async () => {
            try {
              setSeedLoading(true);
              setFeedbackMsg('');
              const res = await adminApi.triggerSeed();
              if (res.success) {
                setFeedbackMsg('✅ Database successfully seeded with 90 word categories!');
                await loadData();
              }
            } catch (err: any) {
              setFeedbackMsg(`❌ Seeding failed: ${err.message}`);
            } finally {
              setSeedLoading(false);
            }
          },
        },
      ]
    );
  };

  const handleAddWord = async () => {
    if (!selectedCategory || !newWord.trim() || !newHint.trim()) return;

    try {
      const catId = selectedCategory.id || (selectedCategory as any)._id;
      const res = await adminApi.addWord(catId, {
        word: newWord.trim(),
        hint: newHint.trim(),
        difficulty: newDifficulty,
      });
      if (res.success && res.category) {
        setSelectedCategory(res.category);
        setCategories((prev) => prev.map((c) => (c.slug === res.category.slug ? res.category : c)));
        setShowAddWordModal(false);
        setNewWord('');
        setNewHint('');
      }
    } catch (err: any) {
      Alert.alert('Error', err.message);
    }
  };

  const handleDeleteWord = (wordText: string) => {
    if (!selectedCategory) return;
    const catId = selectedCategory.id || (selectedCategory as any)._id;

    Alert.alert('Delete Word', `Delete word "${wordText}"?`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          try {
            const res = await adminApi.deleteWord(catId, wordText);
            if (res.success && res.category) {
              setSelectedCategory(res.category);
              setCategories((prev) =>
                prev.map((c) => (c.slug === res.category.slug ? res.category : c))
              );
            }
          } catch (err: any) {
            Alert.alert('Error', err.message);
          }
        },
      },
    ]);
  };

  const handleCreateCategory = async () => {
    try {
      const res = await adminApi.createCategory({
        name: newCatName.trim(),
        slug: newCatSlug.trim().toLowerCase(),
        group: newCatGroup,
        description: newCatDesc.trim(),
        words: [],
      });
      if (res.success && res.category) {
        setCategories([...categories, res.category]);
        setSelectedCategory(res.category);
        setShowAddCategoryModal(false);
        setNewCatName('');
        setNewCatSlug('');
        setNewCatDesc('');
      }
    } catch (err: any) {
      Alert.alert('Error', err.message);
    }
  };

  const handleLogout = () => {
    sounds.playClick();
    adminLogout();
    navigation.replace('Home');
  };

  return (
    <View style={styles.container}>
      {/* Top Bar */}
      <View style={styles.topBar}>
        <View>
          <Text style={styles.topBarTitle}>Admin Console</Text>
          <Text style={styles.topBarSub}>Imposter Word Decks & Audits</Text>
        </View>

        <TouchableOpacity onPress={handleLogout} style={styles.logoutBtn}>
          <LogOut size={16} color={COLORS.imposter.default} />
        </TouchableOpacity>
      </View>

      {/* Tabs */}
      <View style={styles.tabsRow}>
        <TouchableOpacity
          onPress={() => handleTabChange('CATEGORIES')}
          style={[styles.tabBtn, activeTab === 'CATEGORIES' && styles.tabBtnActive]}
        >
          <Layers size={14} color={activeTab === 'CATEGORIES' ? COLORS.white : COLORS.slate[400]} />
          <Text style={[styles.tabText, activeTab === 'CATEGORIES' && styles.tabTextActive]}>
            Categories
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          onPress={() => handleTabChange('HISTORY')}
          style={[styles.tabBtn, activeTab === 'HISTORY' && styles.tabBtnActive]}
        >
          <History size={14} color={activeTab === 'HISTORY' ? COLORS.white : COLORS.slate[400]} />
          <Text style={[styles.tabText, activeTab === 'HISTORY' && styles.tabTextActive]}>
            History
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          onPress={() => handleTabChange('AUDIT')}
          style={[styles.tabBtn, activeTab === 'AUDIT' && styles.tabBtnActive]}
        >
          <FileText size={14} color={activeTab === 'AUDIT' ? COLORS.white : COLORS.slate[400]} />
          <Text style={[styles.tabText, activeTab === 'AUDIT' && styles.tabTextActive]}>
            Audit
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          onPress={() => handleTabChange('STATS')}
          style={[styles.tabBtn, activeTab === 'STATS' && styles.tabBtnActive]}
        >
          <Database size={14} color={activeTab === 'STATS' ? COLORS.white : COLORS.slate[400]} />
          <Text style={[styles.tabText, activeTab === 'STATS' && styles.tabTextActive]}>
            Stats
          </Text>
        </TouchableOpacity>
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        {feedbackMsg ? (
          <View style={styles.feedbackBanner}>
            <Text style={styles.feedbackText}>{feedbackMsg}</Text>
          </View>
        ) : null}

        {/* ========================================================== */}
        {/* TAB 1: CATEGORIES & WORD PACKS */}
        {/* ========================================================== */}
        {activeTab === 'CATEGORIES' && (
          <View style={styles.tabContent}>
            {/* Quick Actions Row */}
            <View style={styles.categoryActionsRow}>
              <TouchableOpacity
                onPress={handleSeedDatabase}
                disabled={seedLoading}
                style={styles.seedBtn}
              >
                <Database size={14} color={COLORS.accent.emerald} />
                <Text style={styles.seedBtnText}>
                  {seedLoading ? 'Seeding...' : 'Seed DB (MongoDB)'}
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                onPress={() => {
                  sounds.playClick();
                  setShowAddCategoryModal(true);
                }}
                style={styles.addCategoryBtn}
              >
                <Plus size={14} color={COLORS.white} />
                <Text style={styles.addCategoryBtnText}>New Category</Text>
              </TouchableOpacity>
            </View>

            {/* Category Selector Horizontal Scroll */}
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.catsHScroll}>
              {categories.map((c) => {
                const isSelected = selectedCategory?.slug === c.slug;
                return (
                  <TouchableOpacity
                    key={c.slug}
                    onPress={() => {
                      sounds.playClick();
                      setSelectedCategory(c);
                    }}
                    style={[styles.catChip, isSelected && styles.catChipActive]}
                  >
                    <Text style={[styles.catChipText, isSelected && styles.catChipTextActive]}>
                      {c.name} ({c.words?.length || 0})
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </ScrollView>

            {/* Selected Category Details */}
            {selectedCategory && (
              <Card style={styles.categoryDetailCard}>
                <View style={styles.catHeader}>
                  <View>
                    <Text style={styles.catTitle}>{selectedCategory.name}</Text>
                    <Text style={styles.catSlug}>slug: {selectedCategory.slug}</Text>
                  </View>

                  <TouchableOpacity
                    onPress={() => {
                      sounds.playClick();
                      setShowAddWordModal(true);
                    }}
                    style={styles.addWordBtn}
                  >
                    <Plus size={14} color={COLORS.dark[950]} />
                    <Text style={styles.addWordBtnText}>Add Word</Text>
                  </TouchableOpacity>
                </View>

                {/* Words List */}
                <View style={styles.wordsList}>
                  {(!selectedCategory.words || selectedCategory.words.length === 0) ? (
                    <Text style={styles.noWordsText}>No words in this category yet.</Text>
                  ) : (
                    selectedCategory.words.map((w, idx) => (
                      <View key={idx} style={styles.wordRow}>
                        <View style={styles.wordInfo}>
                          <Text style={styles.wordTitle}>{w.word}</Text>
                          <Text style={styles.wordHint}>Hint: {w.hint}</Text>
                        </View>

                        <TouchableOpacity
                          onPress={() => handleDeleteWord(w.word)}
                          style={styles.deleteWordBtn}
                        >
                          <Trash2 size={16} color={COLORS.imposter.default} />
                        </TouchableOpacity>
                      </View>
                    ))
                  )}
                </View>
              </Card>
            )}
          </View>
        )}

        {/* ========================================================== */}
        {/* TAB 2: HISTORY */}
        {/* ========================================================== */}
        {activeTab === 'HISTORY' && (
          <View style={styles.tabContent}>
            <Text style={styles.sectionHeading}>Match History Logs</Text>
            {historyLogs.length === 0 ? (
              <Card style={styles.emptyCard}>
                <Text style={styles.emptyCardText}>No completed match history records found.</Text>
              </Card>
            ) : (
              historyLogs.map((log) => (
                <Card key={log.id} style={styles.logCard}>
                  <View style={styles.logHeader}>
                    <Text style={styles.logRoomCode}>{log.roomCode}</Text>
                    <Text
                      style={[
                        styles.logWinner,
                        log.winnerRole === 'IMPOSTER' ? styles.winnerImposter : styles.winnerCivilian,
                      ]}
                    >
                      {log.winnerRole}S WON
                    </Text>
                  </View>
                  <Text style={styles.logWord}>
                    Word: <Text style={styles.boldWhite}>{log.secretWord}</Text>
                  </Text>
                  <Text style={styles.logDate}>
                    {new Date(log.createdAt).toLocaleString()} • {log.playerCount} players • {log.durationSeconds}s
                  </Text>
                </Card>
              ))
            )}
          </View>
        )}

        {/* ========================================================== */}
        {/* TAB 3: AUDIT */}
        {/* ========================================================== */}
        {activeTab === 'AUDIT' && (
          <View style={styles.tabContent}>
            <Text style={styles.sectionHeading}>Administrative Audit Trail</Text>
            {auditLogs.length === 0 ? (
              <Card style={styles.emptyCard}>
                <Text style={styles.emptyCardText}>No audit trail entries recorded yet.</Text>
              </Card>
            ) : (
              auditLogs.map((log, i) => (
                <Card key={i} style={styles.logCard}>
                  <Text style={styles.auditAction}>{log.action}</Text>
                  <Text style={styles.auditDetails}>{log.details}</Text>
                  <Text style={styles.logDate}>
                    {log.adminEmail} • {new Date(log.createdAt).toLocaleString()}
                  </Text>
                </Card>
              ))
            )}
          </View>
        )}

        {/* ========================================================== */}
        {/* TAB 4: STATS */}
        {/* ========================================================== */}
        {activeTab === 'STATS' && (
          <View style={styles.tabContent}>
            <Text style={styles.sectionHeading}>System Statistics</Text>
            <View style={styles.statsGrid}>
              <Card style={styles.statBox}>
                <Text style={styles.statNumber}>{stats?.totalGames || 0}</Text>
                <Text style={styles.statLabel}>Total Matches</Text>
              </Card>
              <Card style={styles.statBox}>
                <Text style={styles.statNumber}>{stats?.activeRooms || 0}</Text>
                <Text style={styles.statLabel}>Active Rooms</Text>
              </Card>
              <Card style={styles.statBox}>
                <Text style={styles.statNumber}>{categories.length}</Text>
                <Text style={styles.statLabel}>Categories</Text>
              </Card>
            </View>
          </View>
        )}
      </ScrollView>

      {/* Add Word Modal */}
      <Modal visible={showAddWordModal} transparent animationType="fade" onRequestClose={() => setShowAddWordModal(false)}>
        <View style={styles.modalBackdrop}>
          <View style={styles.modalCard}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Add Word to {selectedCategory?.name}</Text>
              <TouchableOpacity onPress={() => setShowAddWordModal(false)}>
                <X size={18} color={COLORS.slate[400]} />
              </TouchableOpacity>
            </View>

            <TextInput
              value={newWord}
              onChangeText={setNewWord}
              placeholder="Word (e.g. Pineapple)"
              placeholderTextColor={COLORS.slate[500]}
              style={styles.modalInput}
            />

            <TextInput
              value={newHint}
              onChangeText={setNewHint}
              placeholder="Hint (e.g. Spiky tropical fruit)"
              placeholderTextColor={COLORS.slate[500]}
              style={styles.modalInput}
            />

            <GradientButton
              title="Add Word"
              onPress={handleAddWord}
              variant="cyan"
              style={styles.fullWidth}
            />
          </View>
        </View>
      </Modal>

      {/* Add Category Modal */}
      <Modal visible={showAddCategoryModal} transparent animationType="fade" onRequestClose={() => setShowAddCategoryModal(false)}>
        <View style={styles.modalBackdrop}>
          <View style={styles.modalCard}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Create New Category</Text>
              <TouchableOpacity onPress={() => setShowAddCategoryModal(false)}>
                <X size={18} color={COLORS.slate[400]} />
              </TouchableOpacity>
            </View>

            <TextInput
              value={newCatName}
              onChangeText={setNewCatName}
              placeholder="Category Name (e.g. Desserts)"
              placeholderTextColor={COLORS.slate[500]}
              style={styles.modalInput}
            />

            <TextInput
              value={newCatSlug}
              onChangeText={setNewCatSlug}
              placeholder="Slug (e.g. desserts)"
              placeholderTextColor={COLORS.slate[500]}
              autoCapitalize="none"
              style={styles.modalInput}
            />

            <TextInput
              value={newCatDesc}
              onChangeText={setNewCatDesc}
              placeholder="Description"
              placeholderTextColor={COLORS.slate[500]}
              style={styles.modalInput}
            />

            <GradientButton
              title="Create Category"
              onPress={handleCreateCategory}
              variant="primary"
              style={styles.fullWidth}
            />
          </View>
        </View>
      </Modal>
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
    backgroundColor: COLORS.dark[900],
    borderBottomWidth: 1,
    borderBottomColor: COLORS.slate[800],
  },
  topBarTitle: {
    fontSize: 18,
    fontWeight: '900',
    color: COLORS.white,
  },
  topBarSub: {
    fontSize: 11,
    color: COLORS.slate[400],
    marginTop: 1,
  },
  logoutBtn: {
    padding: SPACING.sm,
    borderRadius: RADIUS.md,
    backgroundColor: 'rgba(244, 63, 94, 0.15)',
  },
  tabsRow: {
    flexDirection: 'row',
    backgroundColor: COLORS.dark[900],
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm,
    gap: 6,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.slate[800],
  },
  tabBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 8,
    borderRadius: RADIUS.md,
    gap: 4,
  },
  tabBtnActive: {
    backgroundColor: COLORS.dark[700],
  },
  tabText: {
    fontSize: 11,
    fontWeight: '700',
    color: COLORS.slate[400],
  },
  tabTextActive: {
    color: COLORS.white,
  },
  scrollContent: {
    padding: SPACING.md,
    paddingBottom: 40,
  },
  feedbackBanner: {
    backgroundColor: 'rgba(16, 185, 129, 0.15)',
    borderWidth: 1,
    borderColor: 'rgba(16, 185, 129, 0.3)',
    borderRadius: RADIUS.md,
    padding: SPACING.md,
    marginBottom: SPACING.md,
  },
  feedbackText: {
    fontSize: 12,
    fontWeight: '700',
    color: COLORS.accent.emerald,
    textAlign: 'center',
  },
  tabContent: {
    gap: SPACING.md,
  },
  categoryActionsRow: {
    flexDirection: 'row',
    gap: SPACING.sm,
  },
  seedBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(16, 185, 129, 0.15)',
    borderWidth: 1,
    borderColor: 'rgba(16, 185, 129, 0.3)',
    borderRadius: RADIUS.md,
    paddingVertical: 10,
    gap: 6,
  },
  seedBtnText: {
    fontSize: 12,
    fontWeight: '800',
    color: COLORS.accent.emerald,
  },
  addCategoryBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: COLORS.imposter.default,
    borderRadius: RADIUS.md,
    paddingVertical: 10,
    gap: 6,
  },
  addCategoryBtnText: {
    fontSize: 12,
    fontWeight: '800',
    color: COLORS.white,
  },
  catsHScroll: {
    marginVertical: SPACING.xs,
  },
  catChip: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: RADIUS.sm,
    backgroundColor: COLORS.dark[850],
    borderWidth: 1,
    borderColor: COLORS.slate[800],
    marginRight: 6,
  },
  catChipActive: {
    backgroundColor: COLORS.civilian.default,
    borderColor: COLORS.civilian.default,
  },
  catChipText: {
    fontSize: 11,
    fontWeight: '700',
    color: COLORS.slate[400],
  },
  catChipTextActive: {
    color: COLORS.dark[950],
  },
  categoryDetailCard: {
    width: '100%',
    gap: SPACING.md,
  },
  catHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  catTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: COLORS.white,
  },
  catSlug: {
    fontSize: 10,
    color: COLORS.slate[500],
  },
  addWordBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.civilian.default,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: RADIUS.sm,
    gap: 4,
  },
  addWordBtnText: {
    fontSize: 11,
    fontWeight: '800',
    color: COLORS.dark[950],
  },
  wordsList: {
    gap: 6,
  },
  noWordsText: {
    fontSize: 12,
    color: COLORS.slate[500],
    fontStyle: 'italic',
  },
  wordRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: COLORS.dark[950],
    borderRadius: RADIUS.md,
    padding: SPACING.md,
    borderWidth: 1,
    borderColor: COLORS.slate[800],
  },
  wordInfo: {
    flex: 1,
  },
  wordTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: COLORS.white,
  },
  wordHint: {
    fontSize: 11,
    color: COLORS.slate[400],
    marginTop: 2,
  },
  deleteWordBtn: {
    padding: 6,
  },
  sectionHeading: {
    fontSize: 15,
    fontWeight: '800',
    color: COLORS.white,
  },
  emptyCard: {
    padding: SPACING.xl,
    alignItems: 'center',
  },
  emptyCardText: {
    fontSize: 12,
    color: COLORS.slate[500],
  },
  logCard: {
    width: '100%',
    gap: 4,
  },
  logHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  logRoomCode: {
    fontFamily: 'monospace',
    fontWeight: '900',
    color: COLORS.civilian.default,
    fontSize: 14,
  },
  logWinner: {
    fontSize: 11,
    fontWeight: '800',
  },
  winnerImposter: {
    color: COLORS.imposter.default,
  },
  winnerCivilian: {
    color: COLORS.civilian.default,
  },
  logWord: {
    fontSize: 12,
    color: COLORS.slate[300],
  },
  boldWhite: {
    color: COLORS.white,
    fontWeight: '700',
  },
  logDate: {
    fontSize: 10,
    color: COLORS.slate[500],
  },
  auditAction: {
    fontSize: 13,
    fontWeight: '700',
    color: COLORS.white,
  },
  auditDetails: {
    fontSize: 11,
    color: COLORS.slate[400],
  },
  statsGrid: {
    flexDirection: 'row',
    gap: SPACING.sm,
  },
  statBox: {
    flex: 1,
    alignItems: 'center',
    padding: SPACING.md,
  },
  statNumber: {
    fontSize: 22,
    fontWeight: '900',
    color: COLORS.civilian.default,
  },
  statLabel: {
    fontSize: 10,
    color: COLORS.slate[400],
    fontWeight: '700',
    marginTop: 2,
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(7, 9, 14, 0.85)',
    justifyContent: 'center',
    padding: SPACING.lg,
  },
  modalCard: {
    backgroundColor: COLORS.dark[900],
    borderWidth: 1,
    borderColor: COLORS.slate[800],
    borderRadius: RADIUS.xxl,
    padding: SPACING.xl,
    gap: SPACING.md,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  modalTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: COLORS.white,
  },
  modalInput: {
    backgroundColor: COLORS.dark[950],
    borderWidth: 1,
    borderColor: COLORS.slate[700],
    borderRadius: RADIUS.md,
    paddingHorizontal: SPACING.md,
    paddingVertical: 10,
    color: COLORS.white,
    fontSize: 13,
  },
  fullWidth: {
    width: '100%',
  },
});

