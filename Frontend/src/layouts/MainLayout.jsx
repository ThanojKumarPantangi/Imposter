import React from 'react';
import { Outlet } from 'react-router-dom';
import { Navbar } from '../components/Navbar';
import { useSocket } from '../context/SocketContext';
import { AlertCircle } from 'lucide-react';

export function MainLayout() {
  const { kickedNotice, clearKickedNotice, gameToast } = useSocket();

  return (
    <div className="min-h-screen flex flex-col bg-dark-950 text-slate-100 relative">
      <Navbar />

      {/* Kicked Alert Notification Modal */}
      {kickedNotice && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-dark-950/85 backdrop-blur-md">
          <div className="w-full max-w-sm bg-dark-900 border border-rose-500/50 rounded-3xl p-6 text-center shadow-2xl">
            <div className="w-12 h-12 rounded-2xl bg-rose-500/20 text-rose-500 flex items-center justify-center mx-auto mb-3">
              <AlertCircle className="w-6 h-6" />
            </div>
            <h3 className="font-display font-bold text-lg text-white mb-2">Room Notification</h3>
            <p className="text-sm text-slate-300 mb-6">{kickedNotice}</p>
            <button
              onClick={clearKickedNotice}
              className="w-full btn-primary py-2.5 text-sm font-semibold"
            >
              Understood
            </button>
          </div>
        </div>
      )}

      {/* Floating Game Toast */}
      {gameToast && (
        <div className="fixed bottom-6 right-6 z-50 max-w-md bg-dark-900 border border-slate-700 shadow-2xl px-4 py-3 rounded-2xl text-sm font-bold text-white flex items-center gap-2 animate-bounce">
          <span>{gameToast}</span>
        </div>
      )}

      <main className="flex-1 w-full">
        <Outlet />
      </main>

      <footer className="border-t border-slate-900 py-6 text-center text-xs text-slate-600">
        <p>Imposter Social Deduction Party Game • Real-time Multiplayer PWA</p>
      </footer>
    </div>
  );
}
