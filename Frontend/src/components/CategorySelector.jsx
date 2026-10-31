import React, { useEffect, useState, useMemo } from 'react';
import { X, Search, Check, Layers, Sparkles, Loader2 } from 'lucide-react';
import { roomApi } from '../api/roomApi';

export function CategorySelector({
  selectedSlugs = [],
  selectedSlug,
  onSelect,
  onClose,
}) {
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [selectedGroup, setSelectedGroup] = useState('ALL');

  // Compute baseline selection
  const initialSlugs = useMemo(() => {
    if (Array.isArray(selectedSlugs) && selectedSlugs.length > 0) {
      return selectedSlugs;
    }
    return selectedSlug ? [selectedSlug] : ['fruits'];
  }, [selectedSlugs, selectedSlug]);

  const [selected, setSelected] = useState(() => new Set(initialSlugs));

  useEffect(() => {
    let isMounted = true;

    async function load() {
      try {
        const res = await roomApi.getCategories();
        if (isMounted && res?.success && Array.isArray(res.categories)) {
          setCategories(res.categories);
        }
      } catch (err) {
        console.warn('Failed to load categories from API, using fallback data:', err);
        if (isMounted) {
          setCategories([
            { slug: 'fruits', name: 'Fruits', group: 'FOOD_DRINK', description: 'Fresh fruits, berries, and tropical produce' },
            { slug: 'vegetables', name: 'Vegetables', group: 'FOOD_DRINK', description: 'Garden harvest, leafy greens, and root veg' },
            { slug: 'world-cuisines', name: 'World Cuisines', group: 'FOOD_DRINK', description: 'Global specialties, street food, and dishes', featured: true },
            { slug: 'animals', name: 'Animals & Pets', group: 'ANIMALS_NATURE', description: 'Wild mammals, marine life, and domestic companions' },
            { slug: 'movies', name: 'Movies & Cinema', group: 'ARTS_ENTERTAINMENT', description: 'Blockbusters, iconic directors, and film genres', featured: true },
            { slug: 'gaming', name: 'Video Games', group: 'ARTS_ENTERTAINMENT', description: 'Retro classics, esports titles, and game lore' },
            { slug: 'science', name: 'Science & Cosmos', group: 'ACADEMIC', description: 'Space exploration, elements, physics, and biology' },
          ]);
        }
      } finally {
        if (isMounted) setLoading(false);
      }
    }

    load();
    return () => {
      isMounted = false;
    };
  }, []);

  const toggleCategory = (slug) => {
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

  const handleSelectAllFiltered = () => {
    setSelected((prev) => {
      const next = new Set(prev);
      filtered.forEach((c) => next.add(c.slug));
      return next;
    });
  };

  const handleClearFiltered = () => {
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
    const chosenCategories = categories.filter((c) => selected.has(c.slug));
    if (onSelect) onSelect(chosenCategories);
    if (onClose) onClose();
  };

  const groups = useMemo(() => {
    return ['ALL', ...Array.from(new Set(categories.map((c) => c.group || 'GENERAL')))];
  }, [categories]);

  const filtered = useMemo(() => {
    const query = search.trim().toLowerCase();
    return categories.filter((c) => {
      const matchesSearch =
        !query ||
        c.name.toLowerCase().includes(query) ||
        (c.description && c.description.toLowerCase().includes(query));
      const matchesGroup = selectedGroup === 'ALL' || c.group === selectedGroup;
      return matchesSearch && matchesGroup;
    });
  }, [categories, search, selectedGroup]);

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-slate-950/80 backdrop-blur-md transition-opacity">
      <div className="relative w-full sm:max-w-3xl bg-slate-900 border-t sm:border border-slate-800 rounded-t-3xl sm:rounded-3xl shadow-2xl flex flex-col max-h-[92vh] sm:max-h-[85vh] overflow-hidden">

        {/* Header */}
        <div className="p-5 sm:p-6 pb-3 sm:pb-4 border-b border-slate-800/80 shrink-0">
          <div className="flex items-start justify-between gap-4">
            <div>
              <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-cyan-500/10 border border-cyan-500/20 text-[11px] font-semibold text-cyan-400 mb-2">
                <Layers className="w-3.5 h-3.5" />
                <span>Multi-Category Selection</span>
              </div>
              <h2 className="text-xl sm:text-2xl font-bold text-white tracking-tight">
                Choose Word Categories
              </h2>
              <p className="text-xs sm:text-sm text-slate-400 mt-1">
                Combine multiple categories into one shared word deck for your game.
              </p>
            </div>

            <button
              onClick={onClose}
              type="button"
              aria-label="Close"
              className="p-2 text-slate-400 hover:text-white rounded-xl bg-slate-800/40 hover:bg-slate-800 transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Search Bar */}
          <div className="relative mt-4">
            <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search by topic, food, movie, animals..."
              className="w-full bg-slate-950/70 border border-slate-800 focus:border-cyan-500 pl-10 pr-4 py-2 sm:py-2.5 rounded-xl text-xs sm:text-sm text-white placeholder-slate-500 outline-none transition-all ring-cyan-500/20 focus:ring-2"
            />
          </div>

          {/* Group Filter Chips */}
          <div className="flex items-center gap-1.5 overflow-x-auto pt-3 pb-1 -mb-1 scrollbar-none">
            {groups.map((g) => {
              const active = selectedGroup === g;
              return (
                <button
                  key={g}
                  type="button"
                  onClick={() => setSelectedGroup(g)}
                  className={`px-3 py-1 rounded-lg text-xs font-medium whitespace-nowrap transition-colors ${active
                      ? 'bg-cyan-500 text-slate-950 font-bold shadow-sm'
                      : 'bg-slate-800/70 text-slate-400 hover:text-slate-200 hover:bg-slate-800'
                    }`}
                >
                  {g.replace(/_/g, ' ')}
                </button>
              );
            })}
          </div>
        </div>

        {/* Quick Batch Controls */}
        <div className="px-5 sm:px-6 py-2 bg-slate-950/40 border-b border-slate-800/50 flex items-center justify-between text-xs text-slate-400 shrink-0">
          <span>
            Showing <strong className="text-slate-200">{filtered.length}</strong> categories
          </span>
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={handleSelectAllFiltered}
              className="text-cyan-400 hover:text-cyan-300 font-semibold transition-colors"
            >
              Select Shown
            </button>
            <span className="text-slate-700">•</span>
            <button
              type="button"
              onClick={handleClearFiltered}
              className="text-slate-400 hover:text-slate-300 transition-colors"
            >
              Deselect Shown
            </button>
          </div>
        </div>

        {/* Cards Grid */}
        <div className="p-4 sm:p-6 overflow-y-auto flex-1 overscroll-contain">
          {loading ? (
            <div className="h-48 flex flex-col items-center justify-center gap-3 text-slate-400">
              <Loader2 className="w-6 h-6 animate-spin text-cyan-400" />
              <span className="text-xs sm:text-sm">Fetching available categories...</span>
            </div>
          ) : filtered.length === 0 ? (
            <div className="h-48 flex flex-col items-center justify-center text-center p-6 border border-dashed border-slate-800 rounded-2xl bg-slate-950/20">
              <p className="text-sm font-medium text-slate-300">No categories found</p>
              <p className="text-xs text-slate-500 mt-1">
                No results matching "{search}". Try searching for another topic or resetting filters.
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {filtered.map((cat) => {
                const isSelected = selected.has(cat.slug);
                return (
                  <div
                    key={cat.slug || cat.id}
                    onClick={() => toggleCategory(cat.slug)}
                    role="button"
                    tabIndex={0}
                    onKeyDown={(e) => {
                      if (e.key === ' ' || e.key === 'Enter') {
                        e.preventDefault();
                        toggleCategory(cat.slug);
                      }
                    }}
                    className={`group relative select-none cursor-pointer rounded-2xl p-4 border transition-all text-left flex flex-col justify-between ${isSelected
                        ? 'bg-gradient-to-br from-cyan-950/40 to-slate-900 border-cyan-500 shadow-md shadow-cyan-950/30 ring-1 ring-cyan-500'
                        : 'bg-slate-800/40 border-slate-800 hover:border-slate-700 hover:bg-slate-800/70'
                      }`}
                  >
                    <div>
                      <div className="flex items-start justify-between gap-3 mb-2">
                        <span className="font-semibold text-sm sm:text-base text-slate-100 group-hover:text-cyan-200 transition-colors line-clamp-1">
                          {cat.name}
                        </span>
                        <div
                          className={`w-5 h-5 rounded-md flex items-center justify-center border shrink-0 transition-all ${isSelected
                              ? 'bg-cyan-500 border-cyan-400 text-slate-950'
                              : 'border-slate-700 bg-slate-900/80 group-hover:border-slate-600'
                            }`}
                        >
                          {isSelected && <Check className="w-3.5 h-3.5 stroke-[3]" />}
                        </div>
                      </div>

                      <p className="text-xs text-slate-400 line-clamp-2 leading-relaxed">
                        {cat.description || 'Curated word pool designed for balanced multiplayer play.'}
                      </p>
                    </div>

                    <div className="flex items-center gap-2 mt-3 pt-2.5 border-t border-slate-800/60 text-[10px] font-semibold tracking-wider">
                      <span className="px-2 py-0.5 rounded-md bg-slate-900 text-slate-400 border border-slate-800 uppercase">
                        {(cat.group || 'GENERAL').replace(/_/g, ' ')}
                      </span>
                      {cat.featured && (
                        <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md bg-amber-500/10 text-amber-400 border border-amber-500/20">
                          <Sparkles className="w-2.5 h-2.5" />
                          <span>Popular</span>
                        </span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 sm:p-5 border-t border-slate-800/80 bg-slate-950/60 flex items-center justify-between gap-3 shrink-0">
          <div className="text-xs text-slate-400">
            <span className="text-cyan-400 font-bold text-sm">{selected.size}</span>{' '}
            {selected.size === 1 ? 'category' : 'categories'} selected
          </div>

          <div className="flex items-center gap-2 sm:gap-3">
            <button
              type="button"
              onClick={onClose}
              className="px-3.5 sm:px-4 py-2 sm:py-2.5 rounded-xl text-xs sm:text-sm font-semibold text-slate-400 hover:text-white hover:bg-slate-800/60 transition-colors"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleConfirm}
              className="px-5 sm:px-6 py-2 sm:py-2.5 rounded-xl text-xs sm:text-sm font-bold bg-cyan-500 hover:bg-cyan-400 active:bg-cyan-600 text-slate-950 shadow-md shadow-cyan-500/20 flex items-center gap-2 transition-all"
            >
              <Check className="w-4 h-4 stroke-[2.5]" />
              <span>Apply Selection</span>
            </button>
          </div>
        </div>

      </div>
    </div>
  );
}

export default CategorySelector;