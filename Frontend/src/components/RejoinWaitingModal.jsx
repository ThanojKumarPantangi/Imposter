import React, { useEffect, useState } from 'react';
import { Clock, ShieldAlert, ArrowLeft, Loader2, CheckCircle2, XCircle } from 'lucide-react';
import { sounds } from '../utils/sound';

export function RejoinWaitingModal({ rejoinState, onCancel, onReturnHome }) {
  const [timeLeft, setTimeLeft] = useState(rejoinState?.expiresInSeconds || 45);

  useEffect(() => {
    if (rejoinState?.status !== 'PENDING') return;

    const timer = setInterval(() => {
      setTimeLeft(prev => {
        if (prev <= 1) {
          clearInterval(timer);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [rejoinState?.status]);

  if (!rejoinState) return null;

  const isPending = rejoinState.status === 'PENDING' && timeLeft > 0;
  const isApproved = rejoinState.status === 'APPROVED';
  const isDenied = rejoinState.status === 'DENIED';
  const isExpired = (rejoinState.status === 'PENDING' && timeLeft === 0) || rejoinState.status === 'TIMEOUT';
  const isError = rejoinState.status === 'ERROR';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-dark-950/85 backdrop-blur-md animate-fade-in">
      <div className="w-full max-w-md bg-dark-900 border border-slate-700/80 rounded-3xl p-6 sm:p-7 shadow-2xl relative text-center">
        {/* Glow Top Accent */}
        <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-cyan-500 via-rose-500 to-purple-500 rounded-t-3xl" />

        {/* State Icon */}
        <div className="w-16 h-16 rounded-3xl mx-auto mb-4 flex items-center justify-center">
          {isPending && (
            <div className="w-16 h-16 rounded-3xl bg-cyan-500/10 border border-cyan-500/30 text-cyan-400 flex items-center justify-center">
              <Loader2 className="w-8 h-8 animate-spin" />
            </div>
          )}
          {isApproved && (
            <div className="w-16 h-16 rounded-3xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 flex items-center justify-center">
              <CheckCircle2 className="w-8 h-8" />
            </div>
          )}
          {isDenied && (
            <div className="w-16 h-16 rounded-3xl bg-rose-500/10 border border-rose-500/30 text-rose-400 flex items-center justify-center">
              <XCircle className="w-8 h-8" />
            </div>
          )}
          {(isExpired || isError) && (
            <div className="w-16 h-16 rounded-3xl bg-amber-500/10 border border-amber-500/30 text-amber-400 flex items-center justify-center">
              <ShieldAlert className="w-8 h-8" />
            </div>
          )}
        </div>

        {/* Header */}
        <h3 className="font-display font-black text-xl sm:text-2xl text-white mb-2">
          {isPending && 'Waiting for Host Approval'}
          {isApproved && 'Request Approved!'}
          {isDenied && 'Request Declined'}
          {isExpired && 'Request Expired'}
          {isError && 'Rejoin Error'}
        </h3>

        {/* Status Message */}
        <p className="text-sm text-slate-300 mb-6 leading-relaxed">
          {isPending && (
            <>
              You previously left or were removed from room <span className="font-mono text-cyan-400 font-bold">{rejoinState.roomCode}</span>.
              Waiting for the host to allow or deny your request.
            </>
          )}
          {isApproved && 'The host accepted your request. Entering the lobby now...'}
          {isDenied && (rejoinState.message || 'The host declined your request to join this room.')}
          {isExpired && 'The host did not respond before the request timed out. You cannot join this room at this time.'}
          {isError && (rejoinState.message || 'Could not send rejoin request.')}
        </p>

        {/* Timer Badge (if pending) */}
        {isPending && (
          <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-slate-800 text-slate-300 text-xs font-mono mb-6">
            <Clock className="w-3.5 h-3.5 text-cyan-400" />
            <span>Time remaining: {timeLeft}s</span>
          </div>
        )}

        {/* Action Buttons */}
        <div className="flex flex-col gap-2.5">
          {isPending && (
            <button
              type="button"
              onClick={() => {
                sounds.playClick();
                onCancel();
              }}
              className="w-full py-3 px-4 rounded-2xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-sm font-semibold transition-all"
            >
              Cancel Request
            </button>
          )}

          {!isPending && !isApproved && (
            <button
              type="button"
              onClick={() => {
                sounds.playClick();
                onReturnHome();
              }}
              className="w-full py-3 px-4 rounded-2xl bg-gradient-to-r from-rose-500 to-purple-600 hover:from-rose-600 hover:to-purple-700 text-white text-sm font-bold shadow-lg shadow-rose-500/25 transition-all flex items-center justify-center gap-2"
            >
              <ArrowLeft className="w-4 h-4" />
              <span>Return Home</span>
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
