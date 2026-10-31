import React, { useEffect, useState } from 'react';
import { UserCheck, UserX, Clock, AlertCircle } from 'lucide-react';
import { PlayerAvatar } from './PlayerAvatar';
import { sounds } from '../utils/sound';

export function RejoinApprovalModal({ request, onApprove, onDeny }) {
  const [timeLeft, setTimeLeft] = useState(45);

  useEffect(() => {
    const timer = setInterval(() => {
      setTimeLeft(prev => {
        if (prev <= 1) {
          clearInterval(timer);
          onDeny();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [onDeny]);

  if (!request) return null;

  const player = request.player || {};

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-dark-950/80 backdrop-blur-md animate-fade-in">
      <div className="w-full max-w-md bg-dark-900 border border-slate-700/80 rounded-3xl p-6 sm:p-7 shadow-2xl relative overflow-hidden">
        {/* Glow Accent */}
        <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-cyan-500 via-rose-500 to-purple-500" />

        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2 text-rose-400 font-display font-bold text-sm uppercase tracking-wider">
            <AlertCircle className="w-4 h-4" />
            <span>Rejoin Request</span>
          </div>
          <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-slate-800 text-slate-300 text-xs font-mono">
            <Clock className="w-3.5 h-3.5 text-cyan-400" />
            <span>{timeLeft}s</span>
          </div>
        </div>

        <h3 className="font-display font-black text-xl sm:text-2xl text-white mb-2">
          Player wants to rejoin
        </h3>

        <div className="flex items-center gap-3.5 p-4 my-4 rounded-2xl bg-dark-950/70 border border-slate-800">
          <PlayerAvatar avatar={player.avatar || 'cat'} size="md" />
          <div className="flex-1 min-w-0">
            <p className="font-display font-bold text-base text-white truncate">
              {player.username || 'Player'}
            </p>
            <p className="text-xs text-slate-400">
              Wants to join your room again.
            </p>
          </div>
        </div>

        <p className="text-xs text-slate-400 mb-6 leading-relaxed">
          This player was previously removed from the room. As host, you can choose whether to allow them back into the lobby.
        </p>

        <div className="grid grid-cols-2 gap-3">
          <button
            type="button"
            onClick={() => {
              sounds.playClick();
              onDeny();
            }}
            className="flex items-center justify-center gap-2 py-3 px-4 rounded-2xl bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 border border-rose-500/30 text-sm font-bold transition-all active:scale-95"
          >
            <UserX className="w-4 h-4" />
            <span>Deny</span>
          </button>

          <button
            type="button"
            onClick={() => {
              sounds.playClick();
              onApprove();
            }}
            className="flex items-center justify-center gap-2 py-3 px-4 rounded-2xl bg-emerald-500 hover:bg-emerald-400 text-white font-bold text-sm shadow-lg shadow-emerald-500/25 transition-all active:scale-95"
          >
            <UserCheck className="w-4 h-4" />
            <span>Allow</span>
          </button>
        </div>
      </div>
    </div>
  );
}
