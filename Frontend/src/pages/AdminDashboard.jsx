import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Layers, Plus, Trash2, Edit2, Database, History, FileText,
  LogOut, Check, X, Search, Sparkles, BookOpen, AlertCircle
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { adminApi } from '../api/adminApi';

export function AdminDashboard() {
  const navigate = useNavigate();
  const { adminUser, adminLogout, isAdminAuthenticated } = useAuth();

  const [activeTab, setActiveTab] = useState('CATEGORIES'); // CATEGORIES | HISTORY | AUDIT | STATS
  const [stats, setStats] = useState(null);
  const [categories, setCategories] = useState([]);
  const [selectedCategory, setSelectedCategory] = useState(null);
  const [historyLogs, setHistoryLogs] = useState([]);
  const [auditLogs, setAuditLogs] = useState([]);

  const [loading, setLoading] = useState(true);
  const [seedLoading, setSeedLoading] = useState(false);
  const [feedbackMsg, setFeedbackMsg] = useState('');

  // Add Word Modal state
  const [showAddWordModal, setShowAddWordModal] = useState(false);
  const [newWord, setNewWord] = useState('');
  const [newHint, setNewHint] = useState('');
  const [newDifficulty, setNewDifficulty] = useState('EASY');

  // Add Category Modal state
  const [showAddCategoryModal, setShowAddCategoryModal] = useState(false);
  const [newCatName, setNewCatName] = useState('');
  const [newCatSlug, setNewCatSlug] = useState('');
  const [newCatGroup, setNewCatGroup] = useState('FOOD_DRINK');
  const [newCatDesc, setNewCatDesc] = useState('');

  useEffect(() => {
    if (!isAdminAuthenticated) {
      navigate('/admin');
      return;
    }
    loadData();
  }, [isAdminAuthenticated]);

  async function loadData() {
    setLoading(true);
    try {
      const [statsRes, catRes] = await Promise.all([
        adminApi.getStats().catch(() => ({ success: false })),
        adminApi.getCategories().catch(() => ({ success: false }))
      ]);

      if (statsRes.success) setStats(statsRes.stats);
      if (catRes.success && catRes.categories) {
        setCategories(catRes.categories);
        if (catRes.categories.length > 0 && !selectedCategory) {
          setSelectedCategory(catRes.categories[0]);
        }
      }
    } catch (e) {
      console.error(e);
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

  const handleSeedDatabase = async () => {
    if (!window.confirm('Seed database with all configured word packs and categories into MongoDB?')) return;
    try {
      setSeedLoading(true);
      setFeedbackMsg('');
      const res = await adminApi.triggerSeed();
      if (res.success) {
        setFeedbackMsg('✅ Database successfully seeded with 90 word categories!');
        await loadData();
      }
    } catch (err) {
      setFeedbackMsg(`❌ Seeding failed: ${err.message}`);
    } finally {
      setSeedLoading(false);
    }
  };

  const handleAddWord = async (e) => {
    e.preventDefault();
    if (!selectedCategory || !newWord.trim() || !newHint.trim()) return;

    try {
      const res = await adminApi.addWord(selectedCategory.id, {
        word: newWord.trim(),
        hint: newHint.trim(),
        difficulty: newDifficulty
      });
      if (res.success && res.category) {
        setSelectedCategory(res.category);
        setCategories(prev => prev.map(c => (c.id === res.category.id ? res.category : c)));
        setShowAddWordModal(false);
        setNewWord('');
        setNewHint('');
      }
    } catch (err) {
      alert(err.message);
    }
  };

  const handleDeleteWord = async (wordText) => {
    if (!window.confirm(`Delete word "${wordText}"?`)) return;
    try {
      const res = await adminApi.deleteWord(selectedCategory.id, wordText);
      if (res.success && res.category) {
        setSelectedCategory(res.category);
        setCategories(prev => prev.map(c => (c.id === res.category.id ? res.category : c)));
      }
    } catch (err) {
      alert(err.message);
    }
  };

  const handleCreateCategory = async (e) => {
    e.preventDefault();
    try {
      const res = await adminApi.createCategory({
        name: newCatName.trim(),
        slug: newCatSlug.trim().toLowerCase(),
        group: newCatGroup,
        description: newCatDesc.trim(),
        words: []
      });
      if (res.success && res.category) {
        setCategories([...categories, res.category]);
        setSelectedCategory(res.category);
        setShowAddCategoryModal(false);
        setNewCatName('');
        setNewCatSlug('');
      }
    } catch (err) {
      alert(err.message);
    }
  };

  return (
    <div className="max-w-7xl mx-auto px-4 py-8">
      {/* Admin Top Navigation */}
      <div className="flex items-center justify-between gap-4 mb-8 pb-6 border-b border-slate-800 flex-wrap">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="badge-imposter">Admin Console</span>
            <span className="text-xs text-slate-500 font-mono">{adminUser?.email}</span>
          </div>
          <h1 className="font-display font-black text-2xl sm:text-3xl text-white">
            Imposter Game Management
          </h1>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={handleSeedDatabase}
            disabled={seedLoading}
            className="btn-cyan text-xs flex items-center gap-2 py-2.5 px-4"
            title="Populate MongoDB with all categories and words"
          >
            <Database className="w-4 h-4" />
            <span>{seedLoading ? 'Seeding MongoDB...' : 'Seed Categories into MongoDB'}</span>
          </button>

          <button
            onClick={() => {
              adminLogout();
              navigate('/admin');
            }}
            className="btn-secondary text-xs flex items-center gap-2 py-2.5 px-4"
          >
            <LogOut className="w-4 h-4" />
            <span>Logout</span>
          </button>
        </div>
      </div>

      {feedbackMsg && (
        <div className="p-4 mb-6 rounded-2xl bg-dark-900 border border-slate-700 text-sm font-semibold text-white">
          {feedbackMsg}
        </div>
      )}

      {/* Overview Stats Cards */}
      {stats && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-8">
          <div className="glass-card p-4">
            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block mb-1">Total Players</span>
            <span className="font-display font-black text-2xl text-white">{stats.totalPlayers}</span>
          </div>
          <div className="glass-card p-4">
            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block mb-1">Total Matches</span>
            <span className="font-display font-black text-2xl text-cyan-400">{stats.totalGames}</span>
          </div>
          <div className="glass-card p-4">
            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block mb-1">Categories</span>
            <span className="font-display font-black text-2xl text-purple-400">{stats.totalCategories}</span>
          </div>
          <div className="glass-card p-4">
            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block mb-1">Win Split</span>
            <span className="font-display font-bold text-sm text-slate-300">
              Civ: {stats.civilianWins} • Imp: {stats.imposterWins}
            </span>
          </div>
        </div>
      )}

      {/* Tabs */}
      <div className="flex items-center gap-2 border-b border-slate-800 mb-6">
        <button
          onClick={() => setActiveTab('CATEGORIES')}
          className={`px-4 py-3 text-sm font-bold border-b-2 flex items-center gap-2 transition-all ${
            activeTab === 'CATEGORIES'
              ? 'border-rose-500 text-rose-400'
              : 'border-transparent text-slate-400 hover:text-slate-200'
          }`}
        >
          <Layers className="w-4 h-4" />
          <span>Word Packs & Categories</span>
        </button>

        <button
          onClick={() => {
            setActiveTab('HISTORY');
            loadHistory();
          }}
          className={`px-4 py-3 text-sm font-bold border-b-2 flex items-center gap-2 transition-all ${
            activeTab === 'HISTORY'
              ? 'border-rose-500 text-rose-400'
              : 'border-transparent text-slate-400 hover:text-slate-200'
          }`}
        >
          <History className="w-4 h-4" />
          <span>Game Match History</span>
        </button>

        <button
          onClick={() => {
            setActiveTab('AUDIT');
            loadAudit();
          }}
          className={`px-4 py-3 text-sm font-bold border-b-2 flex items-center gap-2 transition-all ${
            activeTab === 'AUDIT'
              ? 'border-rose-500 text-rose-400'
              : 'border-transparent text-slate-400 hover:text-slate-200'
          }`}
        >
          <FileText className="w-4 h-4" />
          <span>Audit Logs</span>
        </button>
      </div>

      {/* TAB 1: CATEGORIES & WORDS */}
      {activeTab === 'CATEGORIES' && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {/* Left Category List */}
          <div className="glass-card p-4 flex flex-col max-h-[650px]">
            <div className="flex items-center justify-between mb-3 px-2">
              <span className="text-xs font-bold uppercase text-slate-400">Categories ({categories.length})</span>
              <button
                onClick={() => setShowAddCategoryModal(true)}
                className="p-1.5 rounded-lg bg-rose-500/20 text-rose-400 hover:bg-rose-500/30 text-xs font-semibold flex items-center gap-1"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>New</span>
              </button>
            </div>

            <div className="overflow-y-auto space-y-1.5 pr-1 flex-1">
              {categories.map((c) => (
                <button
                  key={c.id || c.slug}
                  onClick={() => setSelectedCategory(c)}
                  className={`w-full text-left p-3 rounded-xl border text-sm font-semibold transition-all flex items-center justify-between ${
                    selectedCategory?.id === c.id
                      ? 'bg-rose-950/40 border-rose-500/80 text-white shadow-md'
                      : 'bg-dark-950 border-slate-800 text-slate-300 hover:bg-slate-800/60'
                  }`}
                >
                  <span className="truncate">{c.name}</span>
                  <span className="text-[10px] text-slate-500 bg-slate-900 px-2 py-0.5 rounded">
                    {c.words?.length || 0} words
                  </span>
                </button>
              ))}
            </div>
          </div>

          {/* Right Words Viewer & Editor */}
          <div className="md:col-span-2 glass-card p-6 flex flex-col justify-between min-h-[500px]">
            {selectedCategory ? (
              <div>
                <div className="flex items-center justify-between gap-4 mb-4 pb-4 border-b border-slate-800 flex-wrap">
                  <div>
                    <h3 className="font-display font-black text-2xl text-white mb-1">
                      {selectedCategory.name}
                    </h3>
                    <p className="text-xs text-slate-400">{selectedCategory.description}</p>
                  </div>

                  <button
                    onClick={() => setShowAddWordModal(true)}
                    className="btn-cyan text-xs flex items-center gap-1.5 py-2 px-3.5"
                  >
                    <Plus className="w-4 h-4" />
                    <span>Add Word & Hint</span>
                  </button>
                </div>

                {/* Words Table */}
                <div className="overflow-y-auto max-h-[480px] space-y-2 pr-1">
                  {selectedCategory.words?.map((w, idx) => (
                    <div
                      key={idx}
                      className="p-3.5 rounded-xl bg-dark-950 border border-slate-800 flex items-center justify-between gap-3"
                    >
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-display font-bold text-white text-base">{w.word}</span>
                          <span className="text-[10px] uppercase font-bold px-2 py-0.5 rounded bg-slate-800 text-slate-400">
                            {w.difficulty || 'EASY'}
                          </span>
                        </div>
                        <p className="text-xs text-slate-400 mt-0.5">
                          Hint: <span className="text-slate-300 font-medium">{w.hint}</span>
                        </p>
                      </div>

                      <button
                        onClick={() => handleDeleteWord(w.word)}
                        className="p-2 text-slate-500 hover:text-rose-400 rounded-lg hover:bg-rose-500/10 transition-colors"
                        title="Delete Word"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              <div className="py-20 text-center text-slate-500">
                Select a category from the left to view and edit word items.
              </div>
            )}
          </div>
        </div>
      )}

      {/* TAB 2: MATCH HISTORY */}
      {activeTab === 'HISTORY' && (
        <div className="glass-card p-6">
          <h3 className="font-display font-bold text-lg text-white mb-4">Completed Game History</h3>
          {historyLogs.length === 0 ? (
            <div className="py-12 text-center text-slate-500 text-sm">No recorded match history yet.</div>
          ) : (
            <div className="space-y-3">
              {historyLogs.map((m) => (
                <div key={m._id} className="p-4 rounded-2xl bg-dark-950 border border-slate-800 flex items-center justify-between gap-4 flex-wrap">
                  <div>
                    <div className="flex items-center gap-2 mb-1">
                      <span className="font-mono font-bold text-sm text-cyan-400">{m.roomCode}</span>
                      <span className={m.winnerRole === 'IMPOSTER' ? 'badge-imposter text-xs' : 'badge-civilian text-xs'}>
                        {m.winnerRole} Won
                      </span>
                    </div>
                    <div className="text-xs text-slate-400">
                      Category: <strong>{m.categoryName}</strong> • Word: <strong className="text-white">{m.secretWord}</strong> • Hint: <em>"{m.hint}"</em>
                    </div>
                  </div>
                  <div className="text-right text-xs text-slate-500">
                    <div>{m.players?.length || 0} Players</div>
                    <div>{new Date(m.createdAt).toLocaleDateString()}</div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* TAB 3: AUDIT LOGS */}
      {activeTab === 'AUDIT' && (
        <div className="glass-card p-6">
          <h3 className="font-display font-bold text-lg text-white mb-4">Admin Audit Trail</h3>
          <div className="space-y-2">
            {auditLogs.map((log) => (
              <div key={log._id} className="p-3 rounded-xl bg-dark-950 border border-slate-800 flex items-center justify-between text-xs">
                <div>
                  <span className="font-bold text-rose-400 mr-2">{log.action}</span>
                  <span className="text-slate-300">{log.adminEmail}</span>
                  {log.target && <span className="text-slate-400 ml-2">({log.target})</span>}
                </div>
                <span className="text-slate-500 font-mono">
                  {new Date(log.timestamp).toLocaleString()}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Add Word Modal */}
      {showAddWordModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-dark-950/85 backdrop-blur-md">
          <div className="w-full max-w-md bg-dark-900 border border-slate-800 rounded-3xl p-6 shadow-2xl">
            <h3 className="font-display font-bold text-lg text-white mb-4">
              Add Word to {selectedCategory?.name}
            </h3>

            <form onSubmit={handleAddWord} className="space-y-4">
              <div>
                <label className="block text-xs font-bold uppercase text-slate-400 mb-1">Secret Word</label>
                <input
                  type="text"
                  value={newWord}
                  onChange={(e) => setNewWord(e.target.value)}
                  placeholder="e.g. Avocado"
                  required
                  className="w-full bg-dark-950 border border-slate-700 px-3.5 py-2.5 rounded-xl text-sm text-white outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-bold uppercase text-slate-400 mb-1">Imposter Hint</label>
                <input
                  type="text"
                  value={newHint}
                  onChange={(e) => setNewHint(e.target.value)}
                  placeholder="e.g. Creamy green fruit used for guacamole"
                  required
                  className="w-full bg-dark-950 border border-slate-700 px-3.5 py-2.5 rounded-xl text-sm text-white outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-bold uppercase text-slate-400 mb-1">Difficulty</label>
                <select
                  value={newDifficulty}
                  onChange={(e) => setNewDifficulty(e.target.value)}
                  className="w-full bg-dark-950 border border-slate-700 px-3.5 py-2.5 rounded-xl text-sm text-white outline-none"
                >
                  <option value="EASY">EASY</option>
                  <option value="MEDIUM">MEDIUM</option>
                  <option value="HARD">HARD</option>
                </select>
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowAddWordModal(false)}
                  className="btn-secondary text-xs px-4 py-2"
                >
                  Cancel
                </button>
                <button type="submit" className="btn-primary text-xs px-5 py-2">
                  Save Word
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Add Category Modal */}
      {showAddCategoryModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-dark-950/85 backdrop-blur-md">
          <div className="w-full max-w-md bg-dark-900 border border-slate-800 rounded-3xl p-6 shadow-2xl">
            <h3 className="font-display font-bold text-lg text-white mb-4">
              Create New Word Category
            </h3>

            <form onSubmit={handleCreateCategory} className="space-y-4">
              <div>
                <label className="block text-xs font-bold uppercase text-slate-400 mb-1">Category Name</label>
                <input
                  type="text"
                  value={newCatName}
                  onChange={(e) => {
                    setNewCatName(e.target.value);
                    if (!newCatSlug) {
                      setNewCatSlug(e.target.value.toLowerCase().replace(/[^a-z0-9]/g, '-'));
                    }
                  }}
                  placeholder="e.g. Superheroes"
                  required
                  className="w-full bg-dark-950 border border-slate-700 px-3.5 py-2.5 rounded-xl text-sm text-white outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-bold uppercase text-slate-400 mb-1">Slug Identifier</label>
                <input
                  type="text"
                  value={newCatSlug}
                  onChange={(e) => setNewCatSlug(e.target.value)}
                  placeholder="e.g. superheroes"
                  required
                  className="w-full bg-dark-950 border border-slate-700 px-3.5 py-2.5 rounded-xl text-sm text-white outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-bold uppercase text-slate-400 mb-1">Group</label>
                <select
                  value={newCatGroup}
                  onChange={(e) => setNewCatGroup(e.target.value)}
                  className="w-full bg-dark-950 border border-slate-700 px-3.5 py-2.5 rounded-xl text-sm text-white outline-none"
                >
                  <option value="FOOD_DRINK">FOOD_DRINK</option>
                  <option value="HOME_LIFE">HOME_LIFE</option>
                  <option value="ANIMALS_NATURE">ANIMALS_NATURE</option>
                  <option value="TRAVEL_PLACES">TRAVEL_PLACES</option>
                  <option value="SPORTS_RECREATION">SPORTS_RECREATION</option>
                  <option value="SCIENCE_TECH">SCIENCE_TECH</option>
                  <option value="ARTS_ENTERTAINMENT">ARTS_ENTERTAINMENT</option>
                  <option value="PEOPLE_SOCIETY">PEOPLE_SOCIETY</option>
                  <option value="CULTURE_HISTORY">CULTURE_HISTORY</option>
                  <option value="DIGITAL_EVERYDAY">DIGITAL_EVERYDAY</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold uppercase text-slate-400 mb-1">Description</label>
                <textarea
                  value={newCatDesc}
                  onChange={(e) => setNewCatDesc(e.target.value)}
                  placeholder="Brief summary of words in this pack..."
                  rows={2}
                  className="w-full bg-dark-950 border border-slate-700 px-3.5 py-2.5 rounded-xl text-sm text-white outline-none"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowAddCategoryModal(false)}
                  className="btn-secondary text-xs px-4 py-2"
                >
                  Cancel
                </button>
                <button type="submit" className="btn-primary text-xs px-5 py-2">
                  Create Category
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
