import React, { useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { Shield, Sparkles, User, Users, Volume2, Settings, Trophy } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useSocket } from '../context/SocketContext';
import { PlayerAvatar } from './PlayerAvatar';
import { VoiceControls } from './VoiceControls';
import { EditUsernameModal } from './EditUsernameModal';

export function Navbar() {
  const { player, isAdminAuthenticated } = useAuth();
  const { roomState, leaveRoom } = useSocket();
  const [showEditName, setShowEditName] = useState(false);
  const location = useLocation();
  const navigate = useNavigate();

  const isLobbyOrGame = location.pathname.startsWith('/lobby') || location.pathname.startsWith('/game');

  const handleNavClick = async (e, to) => {
    if (isLobbyOrGame) {
      e.preventDefault();
      const pathCode = location.pathname.split('/')[2];
      const code = roomState?.code || pathCode;
      if (player?.id) {
        await leaveRoom(code, player.id);
      }
      navigate(to);
    }
  };

  return (
    <>
      <header className="sticky top-0 z-40 w-full border-b border-slate-800/80 bg-dark-950/80 backdrop-blur-xl">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between gap-4">
          {/* Logo & Brand */}
          <Link
            to="/"
            onClick={(e) => handleNavClick(e, '/')}
            className="flex items-center gap-2.5 group"
          >
            <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-rose-500 via-pink-500 to-purple-600 p-0.5 shadow-lg shadow-rose-500/20 group-hover:scale-105 transition-transform duration-200">
              <div className="w-full h-full bg-dark-950 rounded-[10px] flex items-center justify-center">
                <Shield className="w-5 h-5 text-rose-500 group-hover:rotate-12 transition-transform duration-200" />
              </div>
            </div>
            <div>
              <div className="flex items-center gap-1.5">
                <span className="font-display font-extrabold text-xl tracking-tight bg-gradient-to-r from-rose-400 via-pink-300 to-purple-400 bg-clip-text text-transparent">
                  IMPOSTER
                </span>
              </div>
            </div>
          </Link>

          {/* Center Navigation Links */}
          <nav className="hidden md:flex items-center gap-1">
            <Link
              to="/pass-and-play"
              onClick={(e) => handleNavClick(e, '/pass-and-play')}
              className={`px-3.5 py-1.5 rounded-lg text-sm font-semibold transition-all ${
                location.pathname === '/pass-and-play'
                  ? 'bg-purple-500/20 text-purple-300 border border-purple-500/30'
                  : 'text-slate-300 hover:text-white hover:bg-slate-800/60'
              }`}
            >
              Pass & Play
            </Link>
            <Link
              to="/leaderboard"
              onClick={(e) => handleNavClick(e, '/leaderboard')}
              className={`px-3.5 py-1.5 rounded-lg text-sm font-semibold transition-all ${
                location.pathname === '/leaderboard'
                  ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                  : 'text-slate-300 hover:text-white hover:bg-slate-800/60'
              }`}
            >
              Leaderboard
            </Link>
            <Link
              to="/admin"
              onClick={(e) => handleNavClick(e, '/admin')}
              className={`px-3.5 py-1.5 rounded-lg text-sm font-semibold transition-all ${
                location.pathname.startsWith('/admin')
                  ? 'bg-rose-500/20 text-rose-300 border border-rose-500/30'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
              }`}
            >
              Admin Portal
            </Link>
          </nav>

          {/* Right Controls & Profile */}
          <div className="flex items-center gap-3">
            {/* Voice controls when in room */}
            {isLobbyOrGame && <VoiceControls compact />}

            {/* Player Profile & Username Editor */}
            {player && (
              <button
                onClick={() => setShowEditName(true)}
                title="Click to edit username or change avatar"
                className="flex items-center gap-2.5 bg-dark-900 border border-slate-800 hover:border-slate-700 p-1.5 pr-3 rounded-full transition-all group"
              >
                <PlayerAvatar player={player} size="sm" showStatus={false} />
                <div className="text-left hidden sm:block">
                  <div className="text-xs font-bold text-slate-200 group-hover:text-white flex items-center gap-1">
                    <span>{player.username}</span>
                  </div>
                  <div className="text-[10px] text-slate-500 font-medium">Edit Profile</div>
                </div>
              </button>
            )}
          </div>
        </div>
      </header>

      {/* Edit Username Modal */}
      {showEditName && (
        <EditUsernameModal onClose={() => setShowEditName(false)} />
      )}
    </>
  );
}

export default Navbar;
