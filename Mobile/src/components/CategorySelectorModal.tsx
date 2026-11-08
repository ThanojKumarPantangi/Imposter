import React, { useEffect, useState, useMemo, useRef } from 'react';
import {
  View,
  Text,
  Modal,
  TextInput,
  TouchableOpacity,
  ScrollView,
  FlatList,
  StyleSheet,
  ActivityIndicator,
  Animated,
  Dimensions,
  Easing,
  Pressable,
} from 'react-native';
import { X, Search, Check, Layers, Sparkles } from 'lucide-react-native';
import { roomApi } from '../services/api/roomApi';
import { Category } from '../types';
import { COLORS } from '../theme/colors';
import { RADIUS, SPACING } from '../theme/spacing';
import { sounds } from '../utils/sound';

const { height: SCREEN_HEIGHT } = Dimensions.get('window');

interface CategorySelectorModalProps {
  visible: boolean;
  selectedSlugs?: string[];
  onSelect: (selectedCategories: Category[]) => void;
  onClose: () => void;
}

export const CategorySelectorModal: React.FC<CategorySelectorModalProps> = ({
  visible,
  selectedSlugs = ['fruits'],
  onSelect,
  onClose,
}) => {
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [search, setSearch] = useState<string>('');
  const [selectedGroup, setSelectedGroup] = useState<string>('ALL');

  const [selected, setSelected] = useState<Set<string>>(
    () => new Set(selectedSlugs.length > 0 ? selectedSlugs : ['fruits'])
  );

  // --- ANIMATION VALUES ---
  const [internalVisible, setInternalVisible] = useState(false);
  const slideAnim = useRef(new Animated.Value(SCREEN_HEIGHT)).current;
  const fadeAnim = useRef(new Animated.Value(0)).current;

  // Mount/Unmount Animations
  useEffect(() => {
    if (visible) {
      setInternalVisible(true);
      Animated.parallel([
        Animated.timing(fadeAnim, {
          toValue: 1,
          duration: 250,
          useNativeDriver: true,
          easing: Easing.out(Easing.ease),
        }),
        Animated.spring(slideAnim, {
          toValue: 0,
          tension: 65,
          friction: 10,
          useNativeDriver: true,
        }),
      ]).start();
    } else {
      Animated.parallel([
        Animated.timing(fadeAnim, {
          toValue: 0,
          duration: 200,
          useNativeDriver: true,
        }),
        Animated.timing(slideAnim, {
          toValue: SCREEN_HEIGHT,
          duration: 250,
          useNativeDriver: true,
          easing: Easing.in(Easing.ease),
        }),
      ]).start(() => {
        setInternalVisible(false);
      });
    }
  }, [visible]);

  const handleClose = () => {
    sounds.playClick();
    onClose(); // Trigger parent state change, which will trigger the exit animation above
  };

  // Data Loading
  useEffect(() => {
    if (!visible) return;
    let isMounted = true;

    async function load() {
      try {
        setLoading(true);
        const list = await roomApi.getCategories();
        if (isMounted && list && list.length > 0) {
          setCategories(list);
        }
      } catch (err) {
        console.warn('Failed to load categories in mobile selector:', err);
      } finally {
        if (isMounted) setLoading(false);
      }
    }

    load();
    return () => {
      isMounted = false;
    };
  }, [visible]);

  useEffect(() => {
    setSelected(new Set(selectedSlugs.length > 0 ? selectedSlugs : ['fruits']));
  }, [selectedSlugs]);

  const toggleCategory = (slug: string) => {
    sounds.playClick();
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(slug)) {
        if (next.size <= 1) return prev;
        next.delete(slug);
      } else {
        next.add(slug);
      }
      return next;
    });
  };

  const groups = useMemo(() => {
    return ['ALL', ...Array.from(new Set(categories.map((c) => c.group || 'GENERAL')))];
  }, [categories]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return categories.filter((c) => {
      const matchesSearch =
        !q ||
        c.name.toLowerCase().includes(q) ||
        (c.description && c.description.toLowerCase().includes(q));
      const matchesGroup = selectedGroup === 'ALL' || c.group === selectedGroup;
      return matchesSearch && matchesGroup;
    });
  }, [categories, search, selectedGroup]);

  const handleSelectAllFiltered = () => {
    sounds.playClick();
    setSelected((prev) => {
      const next = new Set(prev);
      filtered.forEach((c) => next.add(c.slug));
      return next;
    });
  };

  const handleClearFiltered = () => {
    sounds.playClick();
    setSelected((prev) => {
      const next = new Set(prev);
      filtered.forEach((c) => {
        if (next.size > 1) {
          next.delete(c.slug);
        }
      });
      return next;
    });
  };

  const handleConfirm = () => {
    sounds.playClick();
    const chosen = categories.filter((c) => selected.has(c.slug));
    onSelect(chosen);
    onClose();
  };

  // Internal component for animated checkbox & card interactions
  const CategoryCard = ({ item, isSelected, onPress }: any) => {
    const scaleAnim = useRef(new Animated.Value(1)).current;
    const checkScale = useRef(new Animated.Value(isSelected ? 1 : 0)).current;

    useEffect(() => {
      Animated.spring(checkScale, {
        toValue: isSelected ? 1 : 0,
        tension: 100,
        friction: 8,
        useNativeDriver: true,
      }).start();
    }, [isSelected]);

    const handlePressIn = () => {
      Animated.spring(scaleAnim, {
        toValue: 0.97,
        useNativeDriver: true,
      }).start();
    };

    const handlePressOut = () => {
      Animated.spring(scaleAnim, {
        toValue: 1,
        useNativeDriver: true,
      }).start();
    };

    return (
      <Animated.View style={{ transform: [{ scale: scaleAnim }] }}>
        <Pressable
          onPress={onPress}
          onPressIn={handlePressIn}
          onPressOut={handlePressOut}
          style={[
            styles.categoryCard,
            isSelected ? styles.categoryCardSelected : styles.categoryCardUnselected,
          ]}
        >
          <View style={styles.catHeader}>
            <Text style={[styles.catName, isSelected && styles.catNameSelected]}>
              {item.name}
            </Text>
            <View style={[styles.checkbox, isSelected && styles.checkboxChecked]}>
              <Animated.View style={{ transform: [{ scale: checkScale }] }}>
                <Check size={14} color="#07090e" strokeWidth={3.5} />
              </Animated.View>
            </View>
          </View>

          <Text style={[styles.catDesc, isSelected && styles.catDescSelected]} numberOfLines={2}>
            {item.description || 'Curated word pool designed for balanced multiplayer play.'}
          </Text>

          <View style={styles.catFooter}>
            <View style={[styles.groupBadge, isSelected && styles.groupBadgeSelected]}>
              <Text style={[styles.groupBadgeText, isSelected && styles.groupBadgeTextSelected]}>
                {(item.group || 'GENERAL').replace(/_/g, ' ')}
              </Text>
            </View>
            {item.featured && (
              <View style={styles.featuredBadge}>
                <Sparkles size={10} color="#fbbf24" />
                <Text style={styles.featuredText}>Popular</Text>
              </View>
            )}
          </View>
        </Pressable>
      </Animated.View>
    );
  };

  return (
    <Modal visible={internalVisible} transparent onRequestClose={handleClose} animationType="none">
      <Animated.View style={[styles.backdrop, { opacity: fadeAnim }]}>
        <Pressable style={StyleSheet.absoluteFill} onPress={handleClose} />

        <Animated.View
          style={[
            styles.cardContainer,
            { transform: [{ translateY: slideAnim }] },
          ]}
        >
          {/* Top Drag Indicator */}
          <View style={styles.dragHandleContainer}>
            <View style={styles.dragHandle} />
          </View>

          {/* Header */}
          <View style={styles.header}>
            <View style={styles.titleRow}>
              <View style={styles.titleContent}>
                <View style={styles.pillTag}>
                  <Layers size={14} color={COLORS.civilian.default} />
                  <Text style={styles.pillText}>Deck Builder</Text>
                </View>
                <Text style={styles.mainTitle}>Choose Categories</Text>
                <Text style={styles.subTitle}>
                  Select multiple topics to combine into one game deck.
                </Text>
              </View>

              <TouchableOpacity onPress={handleClose} style={styles.closeBtn}>
                <X size={22} color={COLORS.slate[400]} />
              </TouchableOpacity>
            </View>

            {/* Search Bar */}
            <View style={styles.searchBar}>
              <Search size={18} color={COLORS.slate[500]} />
              <TextInput
                value={search}
                onChangeText={setSearch}
                placeholder="Search topics, movies, animals..."
                placeholderTextColor={COLORS.slate[500]}
                style={styles.searchInput}
                selectionColor={COLORS.civilian.default}
              />
              {search.length > 0 && (
                <TouchableOpacity onPress={() => setSearch('')}>
                  <X size={16} color={COLORS.slate[500]} />
                </TouchableOpacity>
              )}
            </View>

            {/* Category Groups Horizontal Scroll */}
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.groupsRow}
            >
              {groups.map((g) => {
                const isActive = selectedGroup === g;
                return (
                  <TouchableOpacity
                    key={g}
                    onPress={() => {
                      sounds.playClick();
                      setSelectedGroup(g);
                    }}
                    style={[
                      styles.groupChip,
                      isActive ? styles.groupChipActive : styles.groupChipInactive,
                    ]}
                  >
                    <Text
                      style={[
                        styles.groupChipText,
                        isActive && styles.groupChipTextActive,
                      ]}
                    >
                      {g.replace(/_/g, ' ')}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </ScrollView>
          </View>

          {/* Batch Controls */}
          <View style={styles.batchControls}>
            <Text style={styles.countText}>
              Showing <Text style={styles.countBold}>{filtered.length}</Text> results
            </Text>
            <View style={styles.batchActions}>
              <TouchableOpacity onPress={handleSelectAllFiltered}>
                <Text style={styles.actionTextCyan}>Select All</Text>
              </TouchableOpacity>
              <Text style={styles.dividerDot}>•</Text>
              <TouchableOpacity onPress={handleClearFiltered}>
                <Text style={styles.actionTextSlate}>Clear All</Text>
              </TouchableOpacity>
            </View>
          </View>

          {/* Cards List */}
          {loading ? (
            <View style={styles.loaderContainer}>
              <ActivityIndicator size="large" color={COLORS.civilian.default} />
              <Text style={styles.loadingText}>Fetching available categories...</Text>
            </View>
          ) : filtered.length === 0 ? (
            <View style={styles.emptyContainer}>
              <Layers size={48} color={COLORS.slate[700]} strokeWidth={1.5} />
              <Text style={styles.emptyTitle}>No categories found</Text>
              <Text style={styles.emptySub}>Try adjusting your search or filters.</Text>
            </View>
          ) : (
            <FlatList
              data={filtered}
              keyExtractor={(item) => item.slug}
              contentContainerStyle={styles.listContent}
              showsVerticalScrollIndicator={false}
              renderItem={({ item }) => (
                <CategoryCard
                  item={item}
                  isSelected={selected.has(item.slug)}
                  onPress={() => toggleCategory(item.slug)}
                />
              )}
            />
          )}

          {/* Footer Bar */}
          <View style={styles.footer}>
            <View style={styles.footerLeft}>
              <View style={styles.selectionBadge}>
                <Text style={styles.selectionBadgeText}>{selected.size}</Text>
              </View>
              <Text style={styles.footerCount}>Selected</Text>
            </View>

            <View style={styles.footerActions}>
              <TouchableOpacity onPress={handleConfirm} style={styles.footerApplyBtn}>
                <Text style={styles.footerApplyText}>Confirm Deck</Text>
                <Check size={18} color="#07090e" strokeWidth={3} />
              </TouchableOpacity>
            </View>
          </View>
        </Animated.View>
      </Animated.View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(3, 4, 7, 0.75)',
    justifyContent: 'flex-end',
  },
  cardContainer: {
    backgroundColor: COLORS.dark[900],
    borderTopLeftRadius: RADIUS.xxl,
    borderTopRightRadius: RADIUS.xxl,
    height: '92%', // Fixed slightly taller height for a true bottom sheet feel
    paddingBottom: SPACING.xl,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -10 },
    shadowOpacity: 0.3,
    shadowRadius: 20,
    elevation: 10,
  },
  dragHandleContainer: {
    alignItems: 'center',
    paddingVertical: SPACING.sm,
  },
  dragHandle: {
    width: 40,
    height: 5,
    borderRadius: RADIUS.round,
    backgroundColor: COLORS.slate[700],
  },
  header: {
    paddingHorizontal: SPACING.lg,
    paddingBottom: SPACING.md,
  },
  titleRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: SPACING.lg,
  },
  titleContent: {
    flex: 1,
    paddingRight: SPACING.md,
  },
  pillTag: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: 'rgba(6, 182, 212, 0.15)',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: RADIUS.round,
    marginBottom: 8,
    alignSelf: 'flex-start',
  },
  pillText: {
    fontSize: 12,
    fontWeight: '700',
    color: COLORS.civilian.default,
    letterSpacing: 0.5,
  },
  mainTitle: {
    fontSize: 24,
    fontWeight: '900',
    color: COLORS.white,
    marginBottom: 4,
  },
  subTitle: {
    fontSize: 13,
    color: COLORS.slate[400],
    lineHeight: 18,
  },
  closeBtn: {
    padding: 8,
    borderRadius: RADIUS.round,
    backgroundColor: COLORS.dark[800],
  },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.dark[950],
    borderWidth: 1,
    borderColor: COLORS.slate[800],
    borderRadius: RADIUS.lg,
    paddingHorizontal: SPACING.md,
    height: 48,
    gap: SPACING.sm,
    marginBottom: SPACING.md,
  },
  searchInput: {
    flex: 1,
    color: COLORS.white,
    fontSize: 15,
    height: '100%',
  },
  groupsRow: {
    flexDirection: 'row',
    gap: SPACING.sm,
    paddingBottom: SPACING.xs,
  },
  groupChip: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: RADIUS.round,
    borderWidth: 1,
  },
  groupChipInactive: {
    backgroundColor: COLORS.dark[800],
    borderColor: 'transparent',
  },
  groupChipActive: {
    backgroundColor: 'rgba(6, 182, 212, 0.1)',
    borderColor: COLORS.civilian.default,
  },
  groupChipText: {
    fontSize: 13,
    fontWeight: '600',
    color: COLORS.slate[400],
  },
  groupChipTextActive: {
    color: COLORS.civilian.default,
    fontWeight: '700',
  },
  batchControls: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: SPACING.lg,
    paddingVertical: SPACING.sm,
    backgroundColor: COLORS.dark[950],
    borderTopWidth: 1,
    borderBottomWidth: 1,
    borderColor: COLORS.slate[800],
  },
  countText: {
    fontSize: 13,
    color: COLORS.slate[400],
  },
  countBold: {
    color: COLORS.white,
    fontWeight: '700',
  },
  batchActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.md,
  },
  actionTextCyan: {
    fontSize: 13,
    color: COLORS.civilian.default,
    fontWeight: '700',
  },
  dividerDot: {
    color: COLORS.slate[600],
    fontSize: 16,
  },
  actionTextSlate: {
    fontSize: 13,
    color: COLORS.slate[400],
    fontWeight: '600',
  },
  loaderContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: SPACING.md,
  },
  loadingText: {
    fontSize: 14,
    color: COLORS.slate[400],
    fontWeight: '500',
  },
  emptyContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: SPACING.sm,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: COLORS.slate[300],
    marginTop: SPACING.sm,
  },
  emptySub: {
    fontSize: 13,
    color: COLORS.slate[500],
    textAlign: 'center',
  },
  listContent: {
    padding: SPACING.lg,
    gap: SPACING.md,
  },
  categoryCard: {
    borderRadius: RADIUS.xl,
    padding: SPACING.lg,
    borderWidth: 1.5,
  },
  categoryCardUnselected: {
    backgroundColor: COLORS.dark[850],
    borderColor: COLORS.slate[800],
  },
  categoryCardSelected: {
    backgroundColor: 'rgba(6, 182, 212, 0.08)',
    borderColor: COLORS.civilian.default,
  },
  catHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: SPACING.xs,
  },
  catName: {
    fontSize: 17,
    fontWeight: '800',
    color: COLORS.white,
    flex: 1,
    paddingRight: SPACING.sm,
  },
  catNameSelected: {
    color: COLORS.civilian.default,
  },
  checkbox: {
    width: 24,
    height: 24,
    borderRadius: 8,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkboxUnchecked: {
    borderColor: COLORS.slate[600],
    backgroundColor: COLORS.dark[900],
  },
  checkboxChecked: {
    borderColor: COLORS.civilian.default,
    backgroundColor: COLORS.civilian.default,
  },
  catDesc: {
    fontSize: 13,
    color: COLORS.slate[400],
    lineHeight: 18,
    marginBottom: SPACING.md,
  },
  catDescSelected: {
    color: COLORS.slate[300],
  },
  catFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  groupBadge: {
    backgroundColor: COLORS.dark[950],
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: RADIUS.sm,
    borderWidth: 1,
    borderColor: COLORS.slate[800],
  },
  groupBadgeSelected: {
    backgroundColor: 'rgba(6, 182, 212, 0.15)',
    borderColor: 'transparent',
  },
  groupBadgeText: {
    fontSize: 10,
    fontWeight: '800',
    color: COLORS.slate[400],
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  groupBadgeTextSelected: {
    color: COLORS.civilian.default,
  },
  featuredBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(245, 158, 11, 0.15)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: RADIUS.sm,
    gap: 4,
  },
  featuredText: {
    fontSize: 10,
    fontWeight: '800',
    color: '#fbbf24',
    letterSpacing: 0.5,
    textTransform: 'uppercase',
  },
  footer: {
    padding: SPACING.lg,
    paddingBottom: SPACING.xl + 20, // Extra padding for safe area
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: COLORS.dark[950],
    borderTopWidth: 1,
    borderTopColor: COLORS.slate[800],
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
  },
  footerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
  },
  selectionBadge: {
    backgroundColor: COLORS.civilian.default,
    width: 28,
    height: 28,
    borderRadius: RADIUS.round,
    alignItems: 'center',
    justifyContent: 'center',
  },
  selectionBadgeText: {
    color: COLORS.dark[950],
    fontSize: 13,
    fontWeight: '900',
  },
  footerCount: {
    fontSize: 14,
    fontWeight: '700',
    color: COLORS.white,
  },
  footerActions: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  footerApplyBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.civilian.default,
    paddingHorizontal: SPACING.xl,
    paddingVertical: 14,
    borderRadius: RADIUS.lg,
    gap: 8,
  },
  footerApplyText: {
    color: COLORS.dark[950],
    fontWeight: '900',
    fontSize: 15,
  },
});