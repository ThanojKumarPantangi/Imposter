import React from 'react';
import { Crown, Skull, WifiOff } from 'lucide-react';

const AVATAR_COLORS = [
  'from-rose-500 to-pink-600',
  'from-cyan-500 to-blue-600',
  'from-purple-500 to-indigo-600',
  'from-amber-500 to-orange-600',
  'from-emerald-500 to-teal-600',
  'from-fuchsia-500 to-rose-600',
  'from-sky-500 to-cyan-600',
  'from-violet-500 to-purple-600'
];

export function PlayerAvatar({
  player,
  size = 'md',
  isSpeaking = false,
  showRole = false,
  showStatus = true,
  className = ''
}) {
  const { username, isHost, isConnected = true, isAlive = true, role } = player || {};

  const sizeClasses = {
    sm: 'w-10 h-10 text-sm',
    md: 'w-14 h-14 text-lg',
    lg: 'w-20 h-20 text-2xl',
    xl: 'w-28 h-28 text-4xl'
  };

  // Derive color deterministically from username
  const nameHash = (username || 'P').split('').reduce((acc, c) => acc + c.charCodeAt(0), 0);
  const colorGrad = AVATAR_COLORS[nameHash % AVATAR_COLORS.length];
  const initial = (username || '?').charAt(0).toUpperCase();

  const isImposter = role === 'IMPOSTER';
  const isCivilian = role === 'CIVILIAN';

  return (
    <div className={`relative inline-flex items-center justify-center select-none ${className}`}>
      {/* Speaking Glow Animation */}
      {isSpeaking && (
        <span className="absolute -inset-1 rounded-full bg-emerald-500/40 animate-ping pointer-events-none" />
      )}

      {/* Main Avatar Circle */}
      <div
        className={`relative ${sizeClasses[size] || sizeClasses.md} rounded-full bg-gradient-to-tr ${colorGrad} text-white font-black flex items-center justify-center shadow-lg border-2 ${
          !isAlive
            ? 'border-slate-700 opacity-60 grayscale'
            : isImposter && showRole
            ? 'border-rose-500 shadow-rose-500/50'
            : isCivilian && showRole
            ? 'border-cyan-400 shadow-cyan-500/50'
            : isSpeaking
            ? 'border-emerald-400'
            : 'border-slate-800'
        } transition-all duration-300`}
      >
        {!isAlive ? <Skull className="w-1/2 h-1/2 text-slate-300" /> : initial}

        {/* Crown for Host */}
        {isHost && (
          <div className="absolute -top-2 -right-1 bg-amber-400 text-dark-950 p-1 rounded-full shadow-md">
            <Crown className="w-3.5 h-3.5 fill-current" />
          </div>
        )}
      </div>

      {/* Status Dot */}
      {showStatus && (
        <div className="absolute bottom-0 right-0">
          {!isConnected ? (
            <span className="flex items-center justify-center w-4 h-4 rounded-full bg-rose-600 text-white ring-2 ring-dark-950" title="Disconnected">
              <WifiOff className="w-2.5 h-2.5" />
            </span>
          ) : !isAlive ? (
            <span className="w-3.5 h-3.5 rounded-full bg-slate-600 ring-2 ring-dark-950" title="Eliminated" />
          ) : (
            <span className="w-3.5 h-3.5 rounded-full bg-emerald-500 ring-2 ring-dark-950" title="Online" />
          )}
        </div>
      )}
    </div>
  );
}
