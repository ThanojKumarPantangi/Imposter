import React from 'react';
import { UserX, AlertTriangle } from 'lucide-react';

export function KickConfirmModal({ player, onConfirm, onCancel }) {
  if (!player) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-dark-950/85 backdrop-blur-md">
      <div className="w-full max-w-sm bg-dark-900 border border-slate-800 rounded-3xl p-6 shadow-2xl text-center">
        <div className="w-14 h-14 rounded-2xl bg-rose-500/20 text-rose-500 flex items-center justify-center mx-auto mb-4 border border-rose-500/30">
          <UserX className="w-7 h-7" />
        </div>

        <h3 className="font-display font-bold text-lg text-white mb-1">
          Remove Player?
        </h3>
        <p className="text-sm text-slate-400 mb-6">
          Are you sure you want to remove <strong className="text-slate-200">{player.username}</strong> from this room?
        </p>

        <div className="flex items-center gap-3">
          <button
            onClick={onCancel}
            className="flex-1 py-2.5 rounded-xl text-sm font-semibold text-slate-300 bg-dark-800 hover:bg-dark-700 transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={() => onConfirm(player.id)}
            className="flex-1 py-2.5 rounded-xl text-sm font-semibold text-white bg-rose-600 hover:bg-rose-700 shadow-lg shadow-rose-600/30 transition-all"
          >
            Yes, Remove
          </button>
        </div>
      </div>
    </div>
  );
}
