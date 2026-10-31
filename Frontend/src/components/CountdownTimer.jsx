import React, { useEffect, useState } from 'react';
import { Clock } from 'lucide-react';

export function CountdownTimer({ deadline, totalSeconds = 30, onExpire, label }) {
  const [timeLeft, setTimeLeft] = useState(0);

  useEffect(() => {
    if (!deadline) return;

    function update() {
      const remaining = Math.max(0, Math.ceil((deadline - Date.now()) / 1000));
      setTimeLeft(remaining);
      if (remaining <= 0 && onExpire) {
        onExpire();
      }
    }

    update();
    const interval = setInterval(update, 500);
    return () => clearInterval(interval);
  }, [deadline, onExpire]);

  const percentage = Math.min(100, Math.max(0, (timeLeft / (totalSeconds || 1)) * 100));
  const isUrgent = timeLeft <= 5 && timeLeft > 0;

  return (
    <div className="flex items-center gap-3 bg-dark-900/90 border border-slate-800 px-4 py-2 rounded-xl backdrop-blur-md shadow-lg">
      <div className={`p-2 rounded-lg ${isUrgent ? 'bg-rose-500/20 text-rose-400 animate-pulse' : 'bg-slate-800 text-slate-300'}`}>
        <Clock className="w-5 h-5" />
      </div>

      <div className="flex flex-col min-w-[70px]">
        {label && <span className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">{label}</span>}
        <div className="flex items-baseline gap-1">
          <span className={`text-2xl font-black font-display tracking-tight ${isUrgent ? 'text-rose-500' : 'text-slate-100'}`}>
            {timeLeft}s
          </span>
        </div>
      </div>

      {/* Mini Progress Bar */}
      <div className="w-16 h-2 bg-slate-800 rounded-full overflow-hidden hidden sm:block">
        <div
          className={`h-full transition-all duration-300 ${isUrgent ? 'bg-rose-500' : 'bg-cyan-500'}`}
          style={{ width: `${percentage}%` }}
        />
      </div>
    </div>
  );
}
