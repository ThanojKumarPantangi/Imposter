import React, { useEffect, useState } from 'react';
import { X, Search, Check, Layers, Sparkles } from 'lucide-react';
import { roomApi } from '../api/roomApi';

export function CategorySelector({ selectedSlug, onSelect, onClose }) {
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [selectedGroup, setSelectedGroup] = useState('ALL');

  useEffect(() => {
    async function load() {
      try {
        const res = await roomApi.getCategories();
        if (res.success && res.categories) {
          setCategories(res.categories);
        }
      } catch (err) {
        console.warn('Failed to load categories from API, using default list:', err);
        // Fallback default list
        setCategories([
          { slug: 'fruits', name: 'Fruits', group: 'FOOD_DRINK', description: 'Fresh fruits and tropical produce', words: new Array(30) },
          { slug: 'vegetables', name: 'Vegetables', group: 'FOOD_DRINK', description: 'Garden produce and greens', words: new Array(30) },
          { slug: 'world-cuisines', name: 'World Cuisines', group: 'FOOD_DRINK', description: 'Global culinary delights', words: new Array(30) },
          { slug: 'animals', name: 'Animals & Pets', group: 'ANIMALS_NATURE', description: 'Wild and domestic creatures', words: new Array(30) },
          { slug: 'movies', name: 'Movie & Cinema', group: 'ARTS_ENTERTAINMENT', description: 'Hollywood blockbusters and genres', words: new Array(30) }
        ]);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  const groups = ['ALL', ...Array.from(new Set(categories.map(c => c.group || 'GENERAL')))];

  const filtered = categories.filter(c => {
    const matchesSearch = c.name.toLowerCase().includes(search.toLowerCase()) ||
      (c.description && c.description.toLowerCase().includes(search.toLowerCase()));
    const matchesGroup = selectedGroup === 'ALL' || c.group === selectedGroup;
    return matchesSearch && matchesGroup;
  });

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-dark-950/85 backdrop-blur-md animate-fade-in">
      <div className="relative w-full max-w-2xl bg-dark-900 border border-slate-800 rounded-3xl p-6 sm:p-8 shadow-2xl flex flex-col max-h-[85vh]">
        <button
          onClick={onClose}
          className="absolute top-5 right-5 p-2 text-slate-400 hover:text-white rounded-xl hover:bg-slate-800/80 transition-colors"
        >
          <X className="w-5 h-5" />
        </button>

        <div className="mb-4">
          <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-cyan-400 mb-1">
            <Layers className="w-4 h-4" />
            <span>Select Word Category</span>
          </div>
          <h3 className="font-display font-black text-2xl text-white">Choose Category</h3>
        </div>

        {/* Search Bar */}
        <div className="relative mb-3">
          <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-3.5" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search categories (e.g. Fruits, Sports, Space)..."
            className="w-full bg-dark-950 border border-slate-700 focus:border-cyan-500 pl-10 pr-4 py-2.5 rounded-xl text-sm text-white placeholder-slate-500 outline-none"
          />
        </div>

        {/* Group Filter Tabs */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-2 mb-3 scrollbar-none">
          {groups.map(g => (
            <button
              key={g}
              onClick={() => setSelectedGroup(g)}
              className={`px-3 py-1 rounded-lg text-xs font-bold whitespace-nowrap transition-all ${
                selectedGroup === g
                  ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/40'
                  : 'bg-dark-800 text-slate-400 hover:text-slate-200'
              }`}
            >
              {g.replace(/_/g, ' ')}
            </button>
          ))}
        </div>

        {/* Category Grid */}
        <div className="overflow-y-auto flex-1 pr-1 grid grid-cols-1 sm:grid-cols-2 gap-3">
          {loading ? (
            <div className="col-span-full py-12 text-center text-slate-400">Loading categories...</div>
          ) : filtered.length === 0 ? (
            <div className="col-span-full py-12 text-center text-slate-500 text-sm">No categories matching "{search}"</div>
          ) : (
            filtered.map((cat) => {
              const isSelected = selectedSlug === cat.slug;
              return (
                <button
                  key={cat.slug || cat.id}
                  onClick={() => {
                    onSelect(cat);
                    onClose();
                  }}
                  className={`text-left p-4 rounded-2xl border transition-all duration-200 flex flex-col justify-between ${
                    isSelected
                      ? 'bg-cyan-950/40 border-cyan-500/80 shadow-lg shadow-cyan-500/10 ring-1 ring-cyan-500'
                      : 'bg-dark-800/60 border-slate-800 hover:border-slate-700 hover:bg-dark-800'
                  }`}
                >
                  <div className="flex items-start justify-between gap-2 mb-2">
                    <span className="font-bold text-slate-100 text-base">{cat.name}</span>
                    {isSelected && (
                      <span className="p-1 rounded-full bg-cyan-500 text-dark-950">
                        <Check className="w-3.5 h-3.5 stroke-[3]" />
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-slate-400 line-clamp-2 mb-3">
                    {cat.description || 'Curated word pack for party deduction rounds.'}
                  </p>
                  <div className="flex items-center gap-2 text-[10px] text-slate-500 font-semibold uppercase tracking-wider">
                    <span className="px-2 py-0.5 rounded bg-slate-900 border border-slate-800">
                      {cat.group || 'GENERAL'}
                    </span>
                    {cat.featured && (
                      <span className="px-2 py-0.5 rounded bg-amber-500/10 text-amber-400 border border-amber-500/20">
                        Featured
                      </span>
                    )}
                  </div>
                </button>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
}
