import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Layers, Plus, Trash2, Edit2, Database, History, FileText,
  LogOut, Check, X, Search, Sparkles, BookOpen, AlertCircle,
  Sliders, Smartphone, ShieldCheck, Power, RefreshCw,
  ExternalLink, AlertTriangle, CheckCircle2, ArrowUpRight, Info
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

  // Edit Word Modal state
  const [showEditWordModal, setShowEditWordModal] = useState(false);
  const [originalWord, setOriginalWord] = useState('');
  const [editingWord, setEditingWord] = useState('');
  const [editHint, setEditHint] = useState('');
  const [editDifficulty, setEditDifficulty] = useState('EASY');
  const [editSaving, setEditSaving] = useState(false);

  // Add Category Modal state
  const [showAddCategoryModal, setShowAddCategoryModal] = useState(false);
  const [newCatName, setNewCatName] = useState('');
  const [newCatSlug, setNewCatSlug] = useState('');
  const [newCatGroup, setNewCatGroup] = useState('FOOD_DRINK');
  const [newCatDesc, setNewCatDesc] = useState('');

  // App Startup Configuration & Maintenance State
  const [configLoading, setConfigLoading] = useState(false);
  const [serverSaving, setServerSaving] = useState(false);
  const [updateSaving, setUpdateSaving] = useState(false);
  const [serverEnabled, setServerEnabled] = useState(true);
  const [serverMessage, setServerMessage] = useState("We're currently performing scheduled maintenance. We'll be back shortly. Stay tuned!");
  const [updateEnabled, setUpdateEnabled] = useState(true);
  const [latestVersionCode, setLatestVersionCode] = useState(1);
  const [updateUrl, setUpdateUrl] = useState('');
  const [updateTitle, setUpdateTitle] = useState('Critical Update Required');
  const [updateMessage, setUpdateMessage] = useState('A newer version of Imposter is available with new categories, chat, and bug fixes.');
  const [configVersion, setConfigVersion] = useState(1);

  useEffect(() => {
    if (!isAdminAuthenticated) {
      navigate('/login', { replace: true });
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

  async function loadAppConfig() {
    try {
      setConfigLoading(true);
      const res = await adminApi.getAppConfig();
      if (res.success && res.data) {
        const d = res.data;
        setServerEnabled(d.server?.enabled ?? true);
        setServerMessage(d.server?.message || '');
        setUpdateEnabled(d.appUpdate?.enabled ?? false);
        setLatestVersionCode(d.appUpdate?.latestVersionCode ?? 1);
        setUpdateUrl(d.appUpdate?.updateUrl || '');
        setUpdateTitle(d.appUpdate?.title || 'Critical Update Required');
        setUpdateMessage(d.appUpdate?.message || 'A newer version of Imposter is available with new categories, chat, and bug fixes.');
        setConfigVersion(d.version ?? 1);
      }
    } catch (e) {
      console.error(e);
      setFeedbackMsg('❌ Failed to fetch application configuration');
    } finally {
      setConfigLoading(false);
    }
  }

  const handleSaveServerStatus = async (e) => {
    e?.preventDefault();
    try {
      setServerSaving(true);
      setFeedbackMsg('');
      const res = await adminApi.updateServerStatus({
        server: {
          enabled: serverEnabled,
          message: serverMessage.trim()
        }
      });
      if (res.success) {
        setFeedbackMsg('✅ Server operational status updated successfully!');
        if (res.data?.version) setConfigVersion(res.data.version);
      }
    } catch (err) {
      setFeedbackMsg(`❌ Failed to update server status: ${err.message}`);
    } finally {
      setServerSaving(false);
    }
  };

  const handleSaveAppUpdate = async (e) => {
    e?.preventDefault();
    try {
      setUpdateSaving(true);
      setFeedbackMsg('');
      const res = await adminApi.updateAppUpdateStatus({
        appUpdate: {
          enabled: updateEnabled,
          latestVersionCode: Number(latestVersionCode),
          updateUrl: updateUrl.trim(),
          title: updateTitle.trim(),
          message: updateMessage.trim()
        }
      });
      if (res.success) {
        setFeedbackMsg('✅ Android app update policy updated successfully!');
        if (res.data?.version) setConfigVersion(res.data.version);
      }
    } catch (err) {
      setFeedbackMsg(`❌ Failed to update app update settings: ${err.message}`);
    } finally {
      setUpdateSaving(false);
    }
  };

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

  const handleOpenEditWord = (w) => {
    setOriginalWord(w.word);
    setEditingWord(w.word);
    setEditHint(w.hint || '');
    setEditDifficulty(w.difficulty || 'EASY');
    setShowEditWordModal(true);
  };

  const handleUpdateWord = async (e) => {
    e?.preventDefault();
    if (!selectedCategory || !originalWord.trim() || !editingWord.trim() || !editHint.trim()) return;

    try {
      setEditSaving(true);
      const res = await adminApi.updateWord(selectedCategory.id, originalWord, {
        word: editingWord.trim(),
        hint: editHint.trim(),
        difficulty: editDifficulty
      });
      if (res.success && res.category) {
        setSelectedCategory(res.category);
        setCategories(prev => prev.map(c => (c.id === res.category.id ? res.category : c)));
        setShowEditWordModal(false);
      }
    } catch (err) {
      alert(err.message);
    } finally {
      setEditSaving(false);
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
              navigate('/login', { replace: true });
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
          className={`px-4 py-3 text-sm font-bold border-b-2 flex items-center gap-2 transition-all ${activeTab === 'CATEGORIES'
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
          className={`px-4 py-3 text-sm font-bold border-b-2 flex items-center gap-2 transition-all ${activeTab === 'HISTORY'
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
          className={`px-4 py-3 text-sm font-bold border-b-2 flex items-center gap-2 transition-all ${activeTab === 'AUDIT'
            ? 'border-rose-500 text-rose-400'
            : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
        >
          <FileText className="w-4 h-4" />
          <span>Audit Logs</span>
        </button>

        <button
          onClick={() => {
            setActiveTab('CONFIG');
            loadAppConfig();
          }}
          className={`px-4 py-3 text-sm font-bold border-b-2 flex items-center gap-2 transition-all ${activeTab === 'CONFIG'
            ? 'border-rose-500 text-rose-400'
            : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
        >
          <Sliders className="w-4 h-4" />
          <span>App Config & Maintenance</span>
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
                  className={`w-full text-left p-3 rounded-xl border text-sm font-semibold transition-all flex items-center justify-between ${selectedCategory?.id === c.id
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

                      <div className="flex items-center gap-1">
                        <button
                          onClick={() => handleOpenEditWord(w)}
                          className="p-2 text-slate-400 hover:text-cyan-400 rounded-lg hover:bg-cyan-500/10 transition-colors"
                          title="Edit Hint & Difficulty"
                        >
                          <Edit2 className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => handleDeleteWord(w.word)}
                          className="p-2 text-slate-500 hover:text-rose-400 rounded-lg hover:bg-rose-500/10 transition-colors"
                          title="Delete Word"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
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

      {/* TAB 4: APP STARTUP CONFIG & MAINTENANCE */}
      {activeTab === 'CONFIG' && (
        <div className="space-y-6 max-w-6xl">
          {/* Header & Quick Summary */}
          <div className="glass-card p-6 border border-slate-800/80 bg-gradient-to-r from-dark-950 via-dark-900 to-dark-950">
            <div className="flex items-center justify-between flex-wrap gap-4">
              <div>
                <h3 className="font-display font-extrabold text-2xl text-white flex items-center gap-3">
                  <span className="p-2.5 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-400">
                    <Sliders className="w-6 h-6" />
                  </span>
                  <span>App Management & Operations</span>
                </h3>
                <p className="text-xs text-slate-400 mt-1 max-w-2xl leading-relaxed">
                  Centrally control game server availability, customize emergency maintenance notices, and enforce automated Android client updates.
                </p>
              </div>

              <div className="flex items-center gap-2.5 flex-wrap">
                {/* Live Server Indicator Pill */}
                <div className={`px-3 py-1.5 rounded-xl text-xs font-bold flex items-center gap-2 border shadow-sm ${serverEnabled
                  ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30'
                  : 'bg-rose-500/10 text-rose-400 border-rose-500/30 animate-pulse'
                  }`}>
                  <span className={`w-2 h-2 rounded-full ${serverEnabled ? 'bg-emerald-400 animate-pulse' : 'bg-rose-500'}`} />
                  <span>{serverEnabled ? 'SERVER ONLINE' : 'MAINTENANCE MODE'}</span>
                </div>

                {/* Live Update Policy Pill */}
                <div className={`px-3 py-1.5 rounded-xl text-xs font-bold flex items-center gap-1.5 border ${updateEnabled
                  ? 'bg-cyan-500/10 text-cyan-400 border-cyan-500/30'
                  : 'bg-slate-800 text-slate-400 border-slate-700'
                  }`}>
                  <Smartphone className="w-3.5 h-3.5" />
                  <span>{updateEnabled ? `ENFORCING v${latestVersionCode}+` : 'UPDATE POLICY OFF'}</span>
                </div>

                {/* Database Sequence Badge */}
                <div className="px-3 py-1.5 rounded-xl text-xs font-mono font-bold bg-dark-800/80 text-slate-300 border border-slate-700">
                  Seq: v{configVersion}
                </div>

                {/* Reload Button */}
                <button
                  onClick={loadAppConfig}
                  disabled={configLoading}
                  className="btn-secondary text-xs flex items-center gap-1.5 py-2 px-3.5 ml-1"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${configLoading ? 'animate-spin text-rose-400' : ''}`} />
                  <span>Reload</span>
                </button>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            {/* 1. Server Operational Status (Left / Full Width) */}
            <div className="lg:col-span-12">
              <form onSubmit={handleSaveServerStatus} className="glass-card p-6 border border-slate-800/80 bg-dark-950/80 space-y-5">
                <div className="flex items-center justify-between flex-wrap gap-4 pb-4 border-b border-slate-800/60">
                  <div className="flex items-center gap-3">
                    <div className={`p-2.5 rounded-xl border ${serverEnabled ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400' : 'bg-rose-500/10 border-rose-500/20 text-rose-400'}`}>
                      <Power className="w-5 h-5" />
                    </div>
                    <div>
                      <span className="text-base font-bold text-white flex items-center gap-2">
                        Game Server Traffic Gate
                      </span>
                      <span className="text-xs text-slate-400 block mt-0.5">
                        Controls whether player devices can access matchmaking, rooms, and gameplay. Admin routes remain unblocked.
                      </span>
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={() => setServerEnabled(!serverEnabled)}
                    className={`px-5 py-2.5 rounded-xl text-xs font-extrabold transition-all flex items-center gap-2.5 border shadow-lg ${serverEnabled
                      ? 'bg-emerald-500/15 text-emerald-300 border-emerald-500/40 hover:bg-emerald-500/25 shadow-emerald-950/40'
                      : 'bg-rose-500/20 text-rose-300 border-rose-500/40 hover:bg-rose-500/30 shadow-rose-950/50'
                      }`}
                  >
                    <span className={`w-2.5 h-2.5 rounded-full ${serverEnabled ? 'bg-emerald-400 animate-ping' : 'bg-rose-500'}`} />
                    <span>{serverEnabled ? 'ONLINE · CLICK TO DISABLE' : 'OFFLINE · CLICK TO ACTIVATE'}</span>
                  </button>
                </div>

                <div>
                  <div className="flex items-center justify-between mb-2">
                    <label className="text-xs font-bold uppercase tracking-wider text-slate-300 flex items-center gap-1.5">
                      <AlertTriangle className="w-3.5 h-3.5 text-amber-400" />
                      Maintenance Announcement Message
                    </label>
                    <div className="flex items-center gap-1.5">
                      <span className="text-[10px] text-slate-500 uppercase font-semibold mr-1">Quick Presets:</span>
                      <button
                        type="button"
                        onClick={() => setServerMessage("We're currently performing scheduled maintenance. We'll be back shortly. Stay tuned!")}
                        className="text-[10px] px-2 py-0.5 rounded bg-dark-900 border border-slate-800 text-slate-400 hover:text-white transition-colors"
                      >
                        Scheduled
                      </button>
                      <button
                        type="button"
                        onClick={() => setServerMessage("Upgrading game servers for improved multiplayer speed and stability. Reopening shortly!")}
                        className="text-[10px] px-2 py-0.5 rounded bg-dark-900 border border-slate-800 text-slate-400 hover:text-white transition-colors"
                      >
                        Upgrade
                      </button>
                      <button
                        type="button"
                        onClick={() => setServerMessage("Investigating an unexpected network glitch. Matchmaking will be back online in minutes.")}
                        className="text-[10px] px-2 py-0.5 rounded bg-dark-900 border border-slate-800 text-slate-400 hover:text-white transition-colors"
                      >
                        Emergency
                      </button>
                    </div>
                  </div>
                  <textarea
                    value={serverMessage}
                    onChange={(e) => setServerMessage(e.target.value)}
                    rows={2}
                    placeholder="We're currently performing scheduled maintenance..."
                    className="w-full bg-dark-900 border border-slate-700/80 px-4 py-3 rounded-xl text-sm text-white placeholder-slate-500 outline-none focus:border-rose-500 focus:ring-1 focus:ring-rose-500/50 transition-all"
                  />
                  <div className="flex items-center justify-between mt-1 text-[11px] text-slate-500">
                    <span>This announcement will be delivered directly inside HTTP 503 responses to blocked mobile and web clients.</span>
                    <span>{serverMessage.length} characters</span>
                  </div>
                </div>

                <div className="flex justify-end pt-1">
                  <button
                    type="submit"
                    disabled={serverSaving}
                    className="btn-primary px-6 py-2.5 text-xs flex items-center gap-2 font-bold shadow-lg shadow-rose-950/40"
                  >
                    {serverSaving ? (
                      <>
                        <RefreshCw className="w-4 h-4 animate-spin" />
                        <span>Applying Server Changes...</span>
                      </>
                    ) : (
                      <>
                        <Check className="w-4 h-4" />
                        <span>Save & Deploy Server Status</span>
                      </>
                    )}
                  </button>
                </div>
              </form>
            </div>

            {/* 2. Android App Update Configuration (Left 7 cols on desktop) */}
            <div className="lg:col-span-7">
              <form onSubmit={handleSaveAppUpdate} className="glass-card p-6 border border-slate-800/80 bg-dark-950/80 space-y-5 h-full flex flex-col justify-between">
                <div className="space-y-5">
                  <div className="flex items-center justify-between flex-wrap gap-3 pb-4 border-b border-slate-800/60">
                    <div className="flex items-center gap-3">
                      <div className="p-2.5 rounded-xl bg-cyan-500/10 border border-cyan-500/20 text-cyan-400">
                        <Smartphone className="w-5 h-5" />
                      </div>
                      <div>
                        <span className="text-base font-bold text-white flex items-center gap-2">
                          Android App Update Policy
                        </span>
                        <span className="text-xs text-slate-400 block mt-0.5">
                          Enforces minimum client versionCode checks exclusively for Android APK installs.
                        </span>
                      </div>
                    </div>

                    <div className="flex items-center gap-3 bg-dark-900 border border-slate-800 px-3.5 py-1.5 rounded-xl">
                      <span className="text-xs font-bold text-slate-300">Enforcement</span>
                      <input
                        type="checkbox"
                        checked={updateEnabled}
                        onChange={(e) => setUpdateEnabled(e.target.checked)}
                        className="w-4 h-4 accent-cyan-500 rounded cursor-pointer"
                      />
                    </div>
                  </div>

                  {/* Automated Enforcement Rule Notice */}
                  <div className="p-3.5 rounded-xl bg-cyan-950/20 border border-cyan-500/30 flex items-start gap-3">
                    <Info className="w-4 h-4 text-cyan-400 shrink-0 mt-0.5" />
                    <div className="text-xs text-slate-300 leading-relaxed">
                      <strong className="text-cyan-300 font-bold block mb-0.5">Automated Version Enforcement:</strong>
                      When active, any Android client reporting a <code className="px-1.5 py-0.5 rounded bg-dark-900 text-cyan-400 font-mono font-bold">versionCode &lt; {latestVersionCode || 1}</code> is automatically locked with a full-screen Hard Update prompt.
                    </div>
                  </div>

                  {/* Version Code Input */}
                  <div>
                    <label className="block text-xs font-bold uppercase tracking-wider text-slate-400 mb-1.5">
                      Required Latest Android Version Code
                    </label>
                    <input
                      type="number"
                      value={latestVersionCode}
                      onChange={(e) => setLatestVersionCode(parseInt(e.target.value, 10) || 1)}
                      min="1"
                      required
                      className="w-full bg-dark-900 border border-slate-700/80 px-4 py-2.5 rounded-xl text-sm font-mono font-bold text-white outline-none focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500/50 transition-all"
                    />
                    <span className="text-[11px] text-slate-500 mt-1 block">
                      Matches the numeric <code className="text-slate-400">versionCode</code> inside your Android build.gradle (e.g. 1, 2, 4, 10).
                    </span>
                  </div>

                  {/* Update URL Input with Test Button */}
                  <div>
                    <div className="flex items-center justify-between mb-1.5">
                      <label className="text-xs font-bold uppercase tracking-wider text-slate-400">
                        APK Download or Store URL
                      </label>
                      {updateUrl && (
                        <a
                          href={updateUrl}
                          target="_blank"
                          rel="noreferrer"
                          className="text-[11px] text-cyan-400 hover:text-cyan-300 flex items-center gap-1 font-semibold transition-colors"
                        >
                          <span>Test URL</span>
                          <ArrowUpRight className="w-3 h-3" />
                        </a>
                      )}
                    </div>
                    <div className="relative">
                      <input
                        type="url"
                        value={updateUrl}
                        onChange={(e) => setUpdateUrl(e.target.value)}
                        placeholder="https://github.com/org/repo/releases/download/v1.0.0/app.apk"
                        required
                        className="w-full bg-dark-900 border border-slate-700/80 px-4 py-2.5 rounded-xl text-sm font-mono text-cyan-300 placeholder-slate-600 outline-none focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500/50 transition-all pr-10"
                      />
                      <ExternalLink className="w-4 h-4 text-slate-500 absolute right-3.5 top-3 pointer-events-none" />
                    </div>
                    <span className="text-[11px] text-slate-500 mt-1 block">
                      Must begin with <code className="text-slate-400">https://</code> or <code className="text-slate-400">http://</code>. Direct APK link or Google Play Store URL.
                    </span>
                  </div>

                  {/* Title and Message */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <div className="flex items-center justify-between mb-1.5">
                        <label className="text-xs font-bold uppercase tracking-wider text-slate-400">
                          Modal Heading
                        </label>
                        <button
                          type="button"
                          onClick={() => setUpdateTitle("Update Required")}
                          className="text-[10px] text-slate-500 hover:text-white"
                        >
                          Reset
                        </button>
                      </div>
                      <input
                        type="text"
                        value={updateTitle}
                        onChange={(e) => setUpdateTitle(e.target.value)}
                        placeholder="Critical Update Required"
                        required
                        className="w-full bg-dark-900 border border-slate-700/80 px-3.5 py-2.5 rounded-xl text-sm text-white outline-none focus:border-cyan-500"
                      />
                    </div>

                    <div>
                      <div className="flex items-center justify-between mb-1.5">
                        <label className="text-xs font-bold uppercase tracking-wider text-slate-400">
                          Modal Description
                        </label>
                        <button
                          type="button"
                          onClick={() => setUpdateMessage("A newer version of Imposter is available with new categories, chat, and bug fixes.")}
                          className="text-[10px] text-slate-500 hover:text-white"
                        >
                          Reset
                        </button>
                      </div>
                      <input
                        type="text"
                        value={updateMessage}
                        onChange={(e) => setUpdateMessage(e.target.value)}
                        placeholder="A newer version of Imposter is available..."
                        required
                        className="w-full bg-dark-900 border border-slate-700/80 px-3.5 py-2.5 rounded-xl text-sm text-white outline-none focus:border-cyan-500"
                      />
                    </div>
                  </div>
                </div>

                <div className="flex justify-end pt-4 border-t border-slate-800/60 mt-4">
                  <button
                    type="submit"
                    disabled={updateSaving}
                    className="btn-primary px-6 py-2.5 text-xs flex items-center gap-2 font-bold shadow-lg shadow-cyan-950/40"
                  >
                    {updateSaving ? (
                      <>
                        <RefreshCw className="w-4 h-4 animate-spin" />
                        <span>Deploying Policy...</span>
                      </>
                    ) : (
                      <>
                        <Check className="w-4 h-4" />
                        <span>Save & Deploy Update Policy</span>
                      </>
                    )}
                  </button>
                </div>
              </form>
            </div>

            {/* 3. Live Phone Preview (Right 5 cols on desktop) */}
            <div className="lg:col-span-5">
              <div className="glass-card p-6 border border-slate-800/80 bg-dark-950/80 flex flex-col items-center justify-center h-full">
                <div className="flex items-center justify-between w-full mb-4">
                  <span className="text-xs font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
                    <Smartphone className="w-4 h-4 text-cyan-400" />
                    Live Mobile Dialog Preview
                  </span>
                  <span className="text-[10px] px-2 py-0.5 rounded-full bg-cyan-500/10 text-cyan-400 border border-cyan-500/20 font-bold">
                    WYSIWYG
                  </span>
                </div>

                {/* Smartphone Mockup */}
                <div className="w-full max-w-[280px] bg-dark-900 border-[3px] border-slate-700 rounded-[32px] p-4 shadow-2xl shadow-cyan-950/30 relative flex flex-col justify-between aspect-[9/16]">
                  {/* Speaker Earphone & Camera notch */}
                  <div className="flex justify-center mb-3">
                    <div className="w-16 h-3 bg-slate-800 rounded-full flex items-center justify-center">
                      <div className="w-2 h-2 rounded-full bg-slate-900" />
                    </div>
                  </div>

                  {/* In-app Screen Content */}
                  <div className="flex-1 flex flex-col items-center justify-center text-center p-2">
                    <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-rose-600 to-amber-500 flex items-center justify-center text-xl shadow-lg shadow-rose-900/40 mb-3">
                      🎭
                    </div>

                    <span className="text-xs font-mono font-bold text-rose-400 uppercase tracking-widest mb-1">
                      IMPOSTER GAME
                    </span>

                    <h4 className="text-sm font-extrabold text-white leading-tight mb-2">
                      {updateTitle || 'Update Available'}
                    </h4>

                    <p className="text-[11px] text-slate-400 leading-relaxed mb-4 px-1 line-clamp-4">
                      {updateMessage || 'A newer version of Imposter is available.'}
                    </p>

                    <div className="w-full space-y-2">
                      <div className="w-full py-2 px-3 rounded-xl bg-gradient-to-r from-rose-600 to-rose-500 text-white font-bold text-xs flex items-center justify-center gap-1.5 shadow-md shadow-rose-950/60 cursor-default">
                        <ArrowUpRight className="w-3.5 h-3.5" />
                        <span>Update to v{latestVersionCode || 1}</span>
                      </div>
                      <span className="text-[9px] text-slate-500 block uppercase font-bold tracking-wider">
                        {updateEnabled ? '● Mandatory Update Required' : '○ Policy Currently Disabled'}
                      </span>
                    </div>
                  </div>

                  {/* Home Indicator */}
                  <div className="flex justify-center mt-2">
                    <div className="w-24 h-1 bg-slate-700 rounded-full" />
                  </div>
                </div>

                <span className="text-[11px] text-slate-500 text-center mt-3 max-w-xs">
                  This preview renders in real time matching the client modal layout displayed on Android.
                </span>
              </div>
            </div>
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

      {/* Edit Word & Hint Modal */}
      {showEditWordModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-dark-950/85 backdrop-blur-md">
          <div className="w-full max-w-md bg-dark-900 border border-slate-800 rounded-3xl p-6 shadow-2xl">
            <div className="flex items-center justify-between pb-3 mb-4 border-b border-slate-800">
              <div>
                <h3 className="font-display font-bold text-lg text-white">
                  Edit Secret Word & Hint
                </h3>
                <p className="text-xs text-slate-400 mt-0.5">Category: {selectedCategory?.name}</p>
              </div>
              <button
                onClick={() => setShowEditWordModal(false)}
                className="p-1 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleUpdateWord} className="space-y-4">
              <div>
                <label className="block text-xs font-bold uppercase text-slate-400 mb-1">Secret Word</label>
                <input
                  type="text"
                  value={editingWord}
                  onChange={(e) => setEditingWord(e.target.value)}
                  placeholder="e.g. Avocado"
                  required
                  className="w-full bg-dark-950 border border-slate-700 px-3.5 py-2.5 rounded-xl text-sm text-white outline-none focus:border-cyan-500 font-semibold"
                />
              </div>

              <div>
                <label className="block text-xs font-bold uppercase text-slate-400 mb-1">Updated Hint</label>
                <textarea
                  value={editHint}
                  onChange={(e) => setEditHint(e.target.value)}
                  placeholder="Enter clear, informative hint for the imposter..."
                  required
                  rows={3}
                  className="w-full bg-dark-950 border border-slate-700 px-3.5 py-2.5 rounded-xl text-sm text-white outline-none focus:border-cyan-500"
                />
              </div>

              <div>
                <label className="block text-xs font-bold uppercase text-slate-400 mb-1">Difficulty</label>
                <select
                  value={editDifficulty}
                  onChange={(e) => setEditDifficulty(e.target.value)}
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
                  onClick={() => setShowEditWordModal(false)}
                  className="btn-secondary text-xs px-4 py-2"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={editSaving}
                  className="btn-cyan text-xs px-5 py-2 flex items-center gap-1.5"
                >
                  {editSaving ? 'Saving...' : 'Update Word'}
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
