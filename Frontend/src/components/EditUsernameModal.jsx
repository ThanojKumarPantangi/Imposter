import React, { useState } from 'react';
import { X, Check, User, Sparkles } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useSocket } from '../context/SocketContext';

const AVATARS = [
  'avatar-1', 'avatar-2', 'avatar-3', 'avatar-4',
  'avatar-5', 'avatar-6', 'avatar-7', 'avatar-8'
];

export function EditUsernameModal({ onClose }) {
  const { player, updateUsername, updateAvatar } = useAuth();
  const { roomState, updateLobbyUsername } = useSocket();
  const [username, setUsername] = useState(player?.username || '');
  const [selectedAvatar, setSelectedAvatar] = useState(player?.avatar || 'avatar-1');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSave = async (e) => {
    e.preventDefault();
    if (!username.trim() || username.trim().length < 2) {
      setError('Username must be at least 2 characters');
      return;
    }

    try {
      setLoading(true);
      setError('');
      await updateUsername(username.trim());
      updateAvatar(selectedAvatar);

      // If currently in a lobby, synchronize new username across the room!
      if (roomState && roomState.code) {
        updateLobbyUsername(roomState.code, player.id, username.trim());
      }

      onClose();
    } catch (err) {
      setError(err.message || 'Failed to update profile');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-dark-950/80 backdrop-blur-md animate-fade-in">
      <div className="relative w-full max-w-md bg-dark-900 border border-slate-800 rounded-3xl p-6 sm:p-8 shadow-2xl">
        <button
          onClick={onClose}
          className="absolute top-5 right-5 p-2 text-slate-400 hover:text-white rounded-xl hover:bg-slate-800/80 transition-colors"
        >
          <X className="w-5 h-5" />
        </button>

        <div className="flex items-center gap-3 mb-6">
          <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-cyan-500 to-blue-600 flex items-center justify-center text-white shadow-lg shadow-cyan-500/25">
            <User className="w-6 h-6" />
          </div>
          <div>
            <h3 className="font-display font-bold text-xl text-white">Edit Your Profile</h3>
            <p className="text-xs text-slate-400">Change your display name and game avatar anytime</p>
          </div>
        </div>

        {error && (
          <div className="mb-4 p-3 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-400 text-xs font-semibold">
            {error}
          </div>
        )}

        <form onSubmit={handleSave} className="space-y-5">
          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-slate-400 mb-2">
              Display Username
            </label>
            <input
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              maxLength={25}
              placeholder="Enter your name..."
              className="w-full bg-dark-950 border border-slate-700 focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500 px-4 py-3 rounded-xl text-white placeholder-slate-500 text-sm font-semibold outline-none transition-all"
            />
            <span className="text-[11px] text-slate-500 mt-1 block">
              Max 25 characters. Preserves your device game records.
            </span>
          </div>

          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-slate-400 mb-2">
              Select Avatar
            </label>
            <div className="grid grid-cols-4 gap-2.5">
              {AVATARS.map((av, idx) => (
                <button
                  key={av}
                  type="button"
                  onClick={() => setSelectedAvatar(av)}
                  className={`h-12 rounded-xl flex items-center justify-center font-bold text-sm transition-all ${
                    selectedAvatar === av
                      ? 'bg-gradient-to-tr from-cyan-500 to-blue-600 text-white shadow-md shadow-cyan-500/30 ring-2 ring-cyan-400'
                      : 'bg-dark-800 text-slate-400 hover:text-white hover:bg-slate-700/60'
                  }`}
                >
                  P{idx + 1}
                </button>
              ))}
            </div>
          </div>

          <div className="flex items-center justify-end gap-3 pt-3">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2.5 rounded-xl text-sm font-semibold text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              className="btn-cyan flex items-center gap-2 text-sm"
            >
              <Check className="w-4 h-4" />
              <span>{loading ? 'Saving...' : 'Save Profile'}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
