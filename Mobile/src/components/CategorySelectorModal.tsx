import React, { useEffect, useState, useMemo } from 'react';
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
} from 'react-native';
import { X, Search, Check, Layers, Sparkles } from 'lucide-react-native';
import { roomApi } from '../services/api/roomApi';
import { Category } from '../types';
import { COLORS } from '../theme/colors';
import { RADIUS, SPACING } from '../theme/spacing';
import { sounds } from '../utils/sound';

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
        if (next.size <= 1) return prev; // Keep at least one category selected
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

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <View style={styles.backdrop}>
        <View style={styles.cardContainer}>
          {/* Header */}
          <View style={styles.header}>
            <View style={styles.titleRow}>
              <View>
                <View style={styles.pillTag}>
                  <Layers size={12} color={COLORS.civilian.default} />
                  <Text style={styles.pillText}>Multi-Category Selection</Text>
                </View>
                <Text style={styles.mainTitle}>Choose Word Categories</Text>
                <Text style={styles.subTitle}>
                  Combine multiple categories into one shared word deck
                </Text>
              </View>

              <TouchableOpacity onPress={onClose} style={styles.closeBtn}>
                <X size={20} color={COLORS.slate[400]} />
              </TouchableOpacity>
            </View>

            {/* Search Bar */}
            <View style={styles.searchBar}>
              <Search size={16} color={COLORS.slate[500]} />
              <TextInput
                value={search}
                onChangeText={setSearch}
                placeholder="Search by topic, food, movie, animals..."
                placeholderTextColor={COLORS.slate[500]}
                style={styles.searchInput}
              />
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

            {/* Batch Controls */}
            <View style={styles.batchControls}>
              <Text style={styles.countText}>
                Showing <Text style={styles.countBold}>{filtered.length}</Text> categories
              </Text>
              <View style={styles.batchActions}>
                <TouchableOpacity onPress={handleSelectAllFiltered}>
                  <Text style={styles.actionTextCyan}>Select Shown</Text>
                </TouchableOpacity>
                <Text style={styles.dividerDot}>•</Text>
                <TouchableOpacity onPress={handleClearFiltered}>
                  <Text style={styles.actionTextSlate}>Deselect Shown</Text>
                </TouchableOpacity>
              </View>
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
              <Text style={styles.emptyTitle}>No categories found</Text>
              <Text style={styles.emptySub}>Try searching for another topic or reset filter.</Text>
            </View>
          ) : (
            <FlatList
              data={filtered}
              keyExtractor={(item) => item.slug}
              contentContainerStyle={styles.listContent}
              renderItem={({ item }) => {
                const isSelected = selected.has(item.slug);
                return (
                  <TouchableOpacity
                    onPress={() => toggleCategory(item.slug)}
                    activeOpacity={0.7}
                    style={[
                      styles.categoryCard,
                      isSelected ? styles.categoryCardSelected : styles.categoryCardUnselected,
                    ]}
                  >
                    <View style={styles.catHeader}>
                      <Text
                        style={[
                          styles.catName,
                          isSelected && styles.catNameSelected,
                        ]}
                      >
                        {item.name}
                      </Text>
                      <View
                        style={[
                          styles.checkbox,
                          isSelected ? styles.checkboxChecked : styles.checkboxUnchecked,
                        ]}
                      >
                        {isSelected && <Check size={12} color="#07090e" strokeWidth={3} />}
                      </View>
                    </View>

                    <Text style={styles.catDesc} numberOfLines={2}>
                      {item.description || 'Curated word pool designed for balanced multiplayer play.'}
                    </Text>

                    <View style={styles.catFooter}>
                      <View style={styles.groupBadge}>
                        <Text style={styles.groupBadgeText}>
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
                  </TouchableOpacity>
                );
              }}
            />
          )}

          {/* Footer Bar */}
          <View style={styles.footer}>
            <Text style={styles.footerCount}>
              <Text style={styles.footerCountBold}>{selected.size}</Text>{' '}
              {selected.size === 1 ? 'category' : 'categories'} selected
            </Text>

            <View style={styles.footerActions}>
              <TouchableOpacity onPress={onClose} style={styles.footerCancelBtn}>
                <Text style={styles.footerCancelText}>Cancel</Text>
              </TouchableOpacity>

              <TouchableOpacity onPress={handleConfirm} style={styles.footerApplyBtn}>
                <Check size={16} color="#07090e" strokeWidth={3} />
                <Text style={styles.footerApplyText}>Apply Selection</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(7, 9, 14, 0.85)',
    justifyContent: 'flex-end',
  },
  cardContainer: {
    backgroundColor: COLORS.dark[900],
    borderTopLeftRadius: RADIUS.xxl,
    borderTopRightRadius: RADIUS.xxl,
    borderWidth: 1,
    borderColor: COLORS.slate[800],
    maxHeight: '90%',
    flex: 1,
  },
  header: {
    padding: SPACING.lg,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.slate[800],
  },
  titleRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: SPACING.md,
  },
  pillTag: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(6, 182, 212, 0.12)',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: RADIUS.round,
    marginBottom: 6,
    alignSelf: 'flex-start',
  },
  pillText: {
    fontSize: 10,
    fontWeight: '700',
    color: COLORS.civilian.default,
  },
  mainTitle: {
    fontSize: 20,
    fontWeight: '800',
    color: COLORS.white,
  },
  subTitle: {
    fontSize: 11,
    color: COLORS.slate[400],
    marginTop: 2,
  },
  closeBtn: {
    padding: 6,
    borderRadius: RADIUS.md,
    backgroundColor: COLORS.dark[800],
  },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.dark[950],
    borderWidth: 1,
    borderColor: COLORS.slate[700],
    borderRadius: RADIUS.md,
    paddingHorizontal: SPACING.md,
    height: 42,
    gap: SPACING.sm,
    marginBottom: SPACING.sm,
  },
  searchInput: {
    flex: 1,
    color: COLORS.white,
    fontSize: 13,
  },
  groupsRow: {
    flexDirection: 'row',
    gap: SPACING.xs,
    paddingVertical: 4,
  },
  groupChip: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: RADIUS.sm,
  },
  groupChipInactive: {
    backgroundColor: COLORS.dark[800],
  },
  groupChipActive: {
    backgroundColor: COLORS.civilian.default,
  },
  groupChipText: {
    fontSize: 11,
    fontWeight: '600',
    color: COLORS.slate[400],
  },
  groupChipTextActive: {
    color: COLORS.dark[950],
    fontWeight: '800',
  },
  batchControls: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: SPACING.sm,
    paddingTop: SPACING.xs,
  },
  countText: {
    fontSize: 11,
    color: COLORS.slate[400],
  },
  countBold: {
    color: COLORS.slate[100],
    fontWeight: '700',
  },
  batchActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
  },
  actionTextCyan: {
    fontSize: 11,
    color: COLORS.civilian.default,
    fontWeight: '700',
  },
  dividerDot: {
    color: COLORS.slate[600],
  },
  actionTextSlate: {
    fontSize: 11,
    color: COLORS.slate[400],
    fontWeight: '600',
  },
  loaderContainer: {
    padding: 40,
    alignItems: 'center',
    justifyContent: 'center',
    gap: SPACING.sm,
  },
  loadingText: {
    fontSize: 12,
    color: COLORS.slate[400],
  },
  emptyContainer: {
    padding: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: COLORS.slate[300],
  },
  emptySub: {
    fontSize: 11,
    color: COLORS.slate[500],
    marginTop: 4,
  },
  listContent: {
    padding: SPACING.md,
    gap: SPACING.sm,
  },
  categoryCard: {
    borderRadius: RADIUS.lg,
    padding: SPACING.md,
    borderWidth: 1.5,
  },
  categoryCardUnselected: {
    backgroundColor: COLORS.dark[850],
    borderColor: COLORS.slate[800],
  },
  categoryCardSelected: {
    backgroundColor: 'rgba(6, 182, 212, 0.12)',
    borderColor: COLORS.civilian.default,
  },
  catHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  catName: {
    fontSize: 15,
    fontWeight: '800',
    color: COLORS.white,
  },
  catNameSelected: {
    color: '#38bdf8',
  },
  checkbox: {
    width: 20,
    height: 20,
    borderRadius: 6,
    borderWidth: 1.5,
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
    fontSize: 11,
    color: COLORS.slate[400],
    lineHeight: 16,
    marginBottom: SPACING.sm,
  },
  catFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  groupBadge: {
    backgroundColor: COLORS.dark[950],
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: RADIUS.sm,
    borderWidth: 1,
    borderColor: COLORS.slate[800],
  },
  groupBadgeText: {
    fontSize: 9,
    fontWeight: '700',
    color: COLORS.slate[400],
    textTransform: 'uppercase',
  },
  featuredBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(245, 158, 11, 0.15)',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: RADIUS.sm,
    gap: 3,
  },
  featuredText: {
    fontSize: 9,
    fontWeight: '700',
    color: '#fbbf24',
  },
  footer: {
    padding: SPACING.lg,
    borderTopWidth: 1,
    borderTopColor: COLORS.slate[800],
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: COLORS.dark[950],
  },
  footerCount: {
    fontSize: 12,
    color: COLORS.slate[400],
  },
  footerCountBold: {
    color: COLORS.civilian.default,
    fontWeight: '800',
  },
  footerActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
  },
  footerCancelBtn: {
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm,
  },
  footerCancelText: {
    color: COLORS.slate[400],
    fontWeight: '700',
    fontSize: 12,
  },
  footerApplyBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.civilian.default,
    paddingHorizontal: SPACING.lg,
    paddingVertical: 10,
    borderRadius: RADIUS.md,
    gap: 4,
  },
  footerApplyText: {
    color: COLORS.dark[950],
    fontWeight: '900',
    fontSize: 13,
  },
});

