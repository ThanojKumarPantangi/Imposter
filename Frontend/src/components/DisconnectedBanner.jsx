import React, { useEffect, useState } from 'react';
import { WifiOff, AlertTriangle } from 'lucide-react';

export function DisconnectedBanner({ alertData }) {
  if (!alertData) return null;

  const { username, deadline, timeoutSeconds } = alertData;
  const [secondsRemaining, setSecondsRemaining] = useState(timeoutSeconds || 5);

  useEffect(() => {
    function tick() {
      if (deadline) {
        const left = Math.max(0, Math.ceil((deadline - Date.now()) / 1000));
        setSecondsRemaining(left);
      }
    }

    tick();
    const interval = setInterval(tick, 500);
    return () => clearInterval(interval);
  }, [deadline]);

  return (
    <div className="w-full bg-rose-950/40 border border-rose-500/40 rounded-2xl p-4 mb-4 backdrop-blur-md shadow-lg animate-pulse-slow">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-3">
          <div className="p-2.5 rounded-xl bg-rose-500/20 text-rose-400">
            <WifiOff className="w-5 h-5 animate-bounce" />
          </div>
          <div>
            <div className="text-sm font-bold text-rose-200">
              Player <span className="text-white underline">{username}</span> Disconnected
            </div>
            <div className="text-xs text-rose-300/80">
              Start Game is protected & disabled until everyone reconnects or timeout expires.
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2 bg-dark-900/90 border border-rose-500/30 px-3.5 py-1.5 rounded-xl">
          <span className="text-xs font-semibold text-slate-300">Timeout In:</span>
          <span className="font-display font-extrabold text-rose-400 text-lg">
            {secondsRemaining}s
          </span>
        </div>
      </div>
    </div>
  );
}
