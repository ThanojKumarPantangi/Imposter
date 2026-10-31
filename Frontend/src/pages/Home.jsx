import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Shield, Users, Play, Plus, BookOpen, Sparkles, ArrowRight, Trophy, Smartphone } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useSocket } from '../context/SocketContext';
import { roomApi } from '../api/roomApi';
import { PlayerAvatar } from '../components/PlayerAvatar';
import { sounds } from '../utils/sound';

export function Home() {
  const navigate = useNavigate();
  const { player } = useAuth();
  const { joinRoom } = useSocket();

  const [roomCodeInput, setRoomCodeInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [showRules, setShowRules] = useState(false);

  // Handle Join Room
  const handleJoin = async (e) => {
    e.preventDefault();
    const cleanCode = roomCodeInput.trim().toUpperCase();
    if (!cleanCode || cleanCode.length < 3) {
      setError('Please enter a valid room code');
      return;
    }

    try {
      setLoading(true);
      setError('');
      sounds.playClick();
      const res = await roomApi.joinRoom(cleanCode, player);
      if (res.success) {
        joinRoom(cleanCode, player);
        navigate(`/lobby/${cleanCode}`);
      }
    } catch (err) {
      setError(err.message || 'Room not found or game in progress');
    } finally {
      setLoading(false);
    }
  };

  // Handle Create Room
  const handleCreate = async () => {
    try {
      setLoading(true);
      setError('');
      sounds.playClick();
      const res = await roomApi.createRoom(player, {
        categorySlug: 'fruits',
        categoryName: 'Fruits',
        categorySlugs: ['fruits'],
        categoryNames: ['Fruits'],
        impostersCount: 1,
        turnDurationSeconds: 30,
        votingDurationSeconds: 45,
        lobbyDisconnectTimeout: 5,
        gameDisconnectGracePeriod: 30
      });

      if (res.success && res.room) {
        joinRoom(res.room.code, player);
        navigate(`/lobby/${res.room.code}`);
      }
    } catch (err) {
      setError(err.message || 'Failed to create room');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-5xl mx-auto px-4 py-8 sm:py-12 flex flex-col items-center">
      {/* Hero Badge */}
      <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-rose-500/10 border border-rose-500/20 text-rose-400 text-xs font-bold uppercase tracking-wider mb-6 animate-pulse">
        <Sparkles className="w-3.5 h-3.5" />
        <span>Real-Time Online Social Deduction</span>
      </div>

      {/* Main Title */}
      <h1 className="font-display font-black text-4xl sm:text-6xl text-center text-white tracking-tight mb-4 max-w-3xl">
        Blend In. Deceive. <br className="hidden sm:inline" />
        <span className="bg-gradient-to-r from-rose-500 via-pink-400 to-purple-500 bg-clip-text text-transparent">
          Unmask The Imposter.
        </span>
      </h1>

      <p className="text-slate-400 text-center text-base sm:text-lg max-w-xl mb-10">
        Civilians receive the secret word. Imposters get only a hint. Enter subtle clues, vote out the suspect, or guess the secret word to win instantly!
      </p>

      {/* Error Banner */}
      {error && (
        <div className="w-full max-w-md p-3.5 mb-6 rounded-2xl bg-rose-500/10 border border-rose-500/30 text-rose-400 text-sm font-semibold text-center animate-fade-in">
          {error}
        </div>
      )}

      {/* Action Cards Grid */}
      <div className="w-full max-w-3xl grid grid-cols-1 md:grid-cols-2 gap-5 mb-10">
        {/* Join Room Card */}
        <div className="glass-card p-6 sm:p-8 flex flex-col justify-between">
          <div>
            <div className="flex items-center gap-3 mb-4">
              <div className="p-3 rounded-2xl bg-cyan-500/20 text-cyan-400">
                <Play className="w-6 h-6 fill-current" />
              </div>
              <div>
                <h2 className="font-display font-bold text-xl text-white">Join A Room</h2>
                <p className="text-xs text-slate-400">Enter your friend's room code to jump in</p>
              </div>
            </div>

            <form onSubmit={handleJoin} className="space-y-4">
              <div>
                <input
                  type="text"
                  value={roomCodeInput}
                  onChange={(e) => setRoomCodeInput(e.target.value.toUpperCase())}
                  placeholder="e.g. ABCD"
                  maxLength={6}
                  className="w-full bg-dark-950 border border-slate-700 focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500 px-4 py-3.5 rounded-xl text-center text-xl font-mono font-bold tracking-widest text-white placeholder-slate-600 outline-none uppercase"
                />
              </div>

              <button
                type="submit"
                disabled={loading || !roomCodeInput.trim()}
                className="w-full btn-cyan flex items-center justify-center gap-2 py-3.5"
              >
                <span>Join Game</span>
                <ArrowRight className="w-4 h-4" />
              </button>
            </form>
          </div>
        </div>

        {/* Create Room Card */}
        <div className="glass-card p-6 sm:p-8 flex flex-col justify-between border-rose-500/30 shadow-rose-950/20">
          <div>
            <div className="flex items-center gap-3 mb-4">
              <div className="p-3 rounded-2xl bg-rose-500/20 text-rose-400">
                <Plus className="w-6 h-6" />
              </div>
              <div>
                <h2 className="font-display font-bold text-xl text-white">Host New Room</h2>
                <p className="text-xs text-slate-400">Choose words, timers, and invite your crew</p>
              </div>
            </div>

            <p className="text-xs text-slate-300 leading-relaxed mb-6">
              Create a private lobby with custom word categories, voice chat, and 3 to 50 player capacity.
            </p>
          </div>

          <button
            onClick={handleCreate}
            disabled={loading}
            className="w-full btn-primary flex items-center justify-center gap-2 py-3.5"
          >
            <span>Create Private Lobby</span>
            <ArrowRight className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Quick Modes Section */}
      <div className="w-full max-w-3xl grid grid-cols-1 sm:grid-cols-3 gap-4 mb-12">
        <button
          onClick={() => navigate('/pass-and-play')}
          className="glass-card-interactive p-4 flex items-center gap-3.5 text-left group"
        >
          <div className="p-2.5 rounded-xl bg-purple-500/20 text-purple-400 group-hover:scale-110 transition-transform">
            <Smartphone className="w-5 h-5" />
          </div>
          <div>
            <div className="font-bold text-sm text-white">Pass & Play</div>
            <div className="text-[11px] text-slate-400">Single device party mode</div>
          </div>
        </button>

        <button
          onClick={() => navigate('/leaderboard')}
          className="glass-card-interactive p-4 flex items-center gap-3.5 text-left group"
        >
          <div className="p-2.5 rounded-xl bg-amber-500/20 text-amber-400 group-hover:scale-110 transition-transform">
            <Trophy className="w-5 h-5" />
          </div>
          <div>
            <div className="font-bold text-sm text-white">Leaderboard</div>
            <div className="text-[11px] text-slate-400">Top detectives & bluffers</div>
          </div>
        </button>

        <button
          onClick={() => setShowRules(true)}
          className="glass-card-interactive p-4 flex items-center gap-3.5 text-left group"
        >
          <div className="p-2.5 rounded-xl bg-emerald-500/20 text-emerald-400 group-hover:scale-110 transition-transform">
            <BookOpen className="w-5 h-5" />
          </div>
          <div>
            <div className="font-bold text-sm text-white">How To Play</div>
            <div className="text-[11px] text-slate-400">Rules & winning strategies</div>
          </div>
        </button>
      </div>

      {/* Rules Modal */}
      {showRules && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-dark-950/85 backdrop-blur-md">
          <div className="w-full max-w-lg bg-dark-900 border border-slate-800 rounded-3xl p-6 sm:p-8 shadow-2xl max-h-[85vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-display font-bold text-xl text-white">Game Rules & Roles</h3>
              <button
                onClick={() => setShowRules(false)}
                className="text-slate-400 hover:text-white p-1 rounded-lg"
              >
                ✕
              </button>
            </div>

            <div className="space-y-4 text-xs text-slate-300 leading-relaxed">
              <div className="p-3.5 rounded-2xl bg-cyan-950/30 border border-cyan-500/20">
                <div className="font-bold text-cyan-400 text-sm mb-1">Civilian</div>
                <p>Receives the actual secret word (e.g. "Apple"). Must submit a related word each turn and vote to eliminate the Imposter.</p>
              </div>

              <div className="p-3.5 rounded-2xl bg-rose-950/30 border border-rose-500/20">
                <div className="font-bold text-rose-400 text-sm mb-1">Imposter</div>
                <p>Does NOT receive the secret word! Receives only a persistent hint (e.g. "Crisp fruit, often red or green"). Must blend in by entering believable related words, or enter the exact secret word during their turn to win instantly!</p>
              </div>

              <div className="p-3.5 rounded-2xl bg-dark-800/60 border border-slate-700/50">
                <div className="font-bold text-slate-200 text-sm mb-1">Gameplay Flow</div>
                <ol className="list-decimal pl-4 space-y-1">
                  <li><strong>Role Reveal:</strong> Everyone privately sees their word or hint.</li>
                  <li><strong>Clue Rounds:</strong> Players take turns submitting 1 related clue.</li>
                  <li><strong>Voting:</strong> Living players vote on who they suspect is the Imposter.</li>
                  <li><strong>Elimination:</strong> Most voted player is eliminated!</li>
                  <li><strong>Victory Check:</strong> Civilians win if all Imposters are eliminated. Imposters win if they guess the word or reach parity!</li>
                </ol>
              </div>
            </div>

            <button
              onClick={() => setShowRules(false)}
              className="mt-6 w-full btn-secondary py-2.5 text-sm"
            >
              Got It, Let's Play!
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
