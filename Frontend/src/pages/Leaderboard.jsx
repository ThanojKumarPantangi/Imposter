import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Trophy, Medal, ArrowLeft, Star, ShieldCheck } from 'lucide-react';
import { apiRequest } from '../api/client';
import { PlayerAvatar } from '../components/PlayerAvatar';

export function Leaderboard() {
  const navigate = useNavigate();
  const [leaders, setLeaders] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      try {
        const res = await apiRequest('/stats/leaderboard');
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
    <div className="max-w-3xl mx-auto px-4 py-8">
      <div className="flex items-center justify-between mb-8">
        <button
          onClick={() => navigate('/')}
          className="text-xs font-bold text-slate-400 hover:text-white px-3 py-1.5 rounded-lg bg-dark-900 border border-slate-800"
        >
          ← Back to Home
        </button>
        <div className="inline-flex items-center gap-1.5 badge-civilian">
          <Trophy className="w-3.5 h-3.5" />
          <span>Global Rankings</span>
        </div>
      </div>

      <div className="text-center mb-8">
        <h1 className="font-display font-black text-3xl text-white mb-2">Hall of Fame</h1>
        <p className="text-xs text-slate-400">Top detectives and most cunning imposters</p>
      </div>

      <div className="glass-card p-6">
        {loading ? (
          <div className="py-12 text-center text-slate-400">Loading rankings...</div>
        ) : leaders.length === 0 ? (
          <div className="py-12 text-center text-slate-500 text-sm">
            No completed matches recorded yet. Play a match to climb the leaderboard!
          </div>
        ) : (
          <div className="space-y-3">
            {leaders.map((p, idx) => {
              const isTop3 = idx < 3;
              return (
                <div
                  key={idx}
                  className={`flex items-center justify-between p-3.5 rounded-2xl border transition-all ${
                    idx === 0
                      ? 'bg-amber-500/10 border-amber-500/30'
                      : idx === 1
                      ? 'bg-slate-300/10 border-slate-400/20'
                      : idx === 2
                      ? 'bg-orange-500/10 border-orange-500/20'
                      : 'bg-dark-950 border-slate-800/80'
                  }`}
                >
                  <div className="flex items-center gap-3.5">
                    <div className="w-7 text-center font-display font-black text-sm text-slate-400">
                      {idx === 0 ? '🥇' : idx === 1 ? '🥈' : idx === 2 ? '🥉' : `#${idx + 1}`}
                    </div>
                    <PlayerAvatar player={p} size="sm" showStatus={false} />
                    <div>
                      <div className="font-bold text-sm text-white">{p.username}</div>
                      <div className="text-[11px] text-slate-400">
                        {p.stats?.gamesPlayed || 0} Matches Played
                      </div>
                    </div>
                  </div>

                  <div className="text-right">
                    <span className="font-display font-black text-base text-cyan-400 block">
                      {p.stats?.wins || 0} Wins
                    </span>
                    <span className="text-[10px] text-slate-500 font-semibold uppercase">
                      Civ: {p.stats?.civilianWins || 0} • Imp: {p.stats?.imposterWins || 0}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
