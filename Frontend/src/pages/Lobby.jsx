import React, { useEffect, useState, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  Copy, Check, Play, UserX, Settings, Layers, Clock, ShieldAlert,
  Users, ArrowLeft, AlertCircle, Share2
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useSocket } from '../context/SocketContext';
import { PlayerAvatar } from '../components/PlayerAvatar';
import { CategorySelector } from '../components/CategorySelector';
import { KickConfirmModal } from '../components/KickConfirmModal';
import { DisconnectedBanner } from '../components/DisconnectedBanner';
import { RejoinApprovalModal } from '../components/RejoinApprovalModal';
import { sounds } from '../utils/sound';

export function Lobby() {
  const { roomCode } = useParams();
  const navigate = useNavigate();
  const { player } = useAuth();
  const {
    roomState,
    disconnectAlert,
    kickedNotice,
    pendingRejoinRequest,
    approveRejoin,
    denyRejoin,
    updateSettings,
    updateRoomCategories,
    updatePlayerCategories,
    kickPlayer,
    startGame,
    joinRoom,
    leaveRoom
  } = useSocket();

  const [copied, setCopied] = useState(false);
  const [showCategorySelector, setShowCategorySelector] = useState(false);
  const [playerToKick, setPlayerToKick] = useState(null);
  const [startError, setStartError] = useState('');

  const normalizedCode = (roomCode || '').toUpperCase();

  // If player was kicked, redirect immediately to Home and do NOT auto-join!
  useEffect(() => {
    if (kickedNotice) {
      navigate('/', { replace: true });
    }
  }, [kickedNotice, navigate]);

  // If roomState is not loaded or reconnected, auto-join socket room (unless kicked)
  useEffect(() => {
    if (kickedNotice) return;
    if (player && (!roomState || roomState.code !== normalizedCode)) {
      joinRoom(normalizedCode, player);
    }
  }, [normalizedCode, player, roomState, kickedNotice, joinRoom]);

  // Navigate to Game view when room status changes away from WAITING
  useEffect(() => {
    if (roomState && roomState.status && roomState.status !== 'WAITING') {
      navigate(`/game/${normalizedCode}`);
    }
  }, [roomState?.status, normalizedCode]);

  // Leave room cleanly when clicking Leave or navigating to Home
  const handleLeaveRoom = useCallback(async () => {
    sounds.playClick();
    if (player?.id) {
      await leaveRoom(normalizedCode, player.id);
    }
    navigate('/');
  }, [leaveRoom, normalizedCode, player?.id, navigate]);

  const isHost = roomState?.hostId === player?.id;
  const players = roomState?.players || [];
  const settings = roomState?.settings || {
    impostersCount: 1,
    turnDurationSeconds: 30,
    votingDurationSeconds: 45,
    lobbyDisconnectTimeout: 5
  };

  // Shared room category selection across ALL players in this room
  const sharedCategorySlugs = roomState?.settings?.categorySlugs || roomState?.settings?.selectedCategories || ['fruits'];
  const sharedCategoryNames = roomState?.settings?.categoryNames || ['Fruits'];

  // Check start readiness
  const hasDisconnected = players.some(p => !p.isConnected) || !!disconnectAlert;
  const minPlayersMet = players.length >= 3;
  const hasCategories = Array.isArray(sharedCategorySlugs) && sharedCategorySlugs.length > 0;
  const canStart = isHost && minPlayersMet && !hasDisconnected && hasCategories;

  const copyRoomLink = () => {
    sounds.playClick();
    navigator.clipboard.writeText(window.location.href);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleStartGame = () => {
    setStartError('');
    if (!canStart) {
      if (!minPlayersMet) {
        setStartError('Need at least 3 players to start the game.');
      } else if (hasDisconnected) {
        setStartError('Cannot start while a player is temporarily disconnected.');
      } else if (!hasCategories) {
        setStartError('At least one word category must be selected for the room.');
      }
      return;
    }
    sounds.playClick();
    startGame(normalizedCode, player.id);
  };

  const handleKickConfirm = (targetId) => {
    sounds.playClick();
    kickPlayer(normalizedCode, player.id, targetId);
    setPlayerToKick(null);
  };

  return (
    <div className="max-w-6xl mx-auto px-4 py-4 sm:py-8">
      {/* Top Header */}
      <div className="flex items-center justify-between gap-4 mb-6">
        <button
          onClick={handleLeaveRoom}
          className="flex items-center gap-2 text-xs font-bold text-slate-400 hover:text-white px-3.5 py-2.5 rounded-xl bg-dark-900 border border-slate-800 hover:border-slate-700 transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Leave Room</span>
        </button>

        {/* Room Code Badge */}
        <div className="flex items-center gap-3 bg-dark-900 border border-slate-800 px-4 sm:px-5 py-2 rounded-2xl shadow-xl">
          <div className="text-right">
            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block">Room Code</span>
            <span className="font-display font-black text-xl sm:text-2xl tracking-widest text-cyan-400 font-mono">
              {normalizedCode}
            </span>
          </div>

          <button
            onClick={copyRoomLink}
            className="p-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 transition-colors active:scale-95"
            title="Copy Invite Link"
          >
            {copied ? <Check className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4" />}
          </button>
        </div>
      </div>

      {/* Disconnected Player Countdown Banner */}
      <DisconnectedBanner alertData={disconnectAlert} />

      {startError && (
        <div className="mb-4 p-3.5 rounded-2xl bg-rose-500/10 border border-rose-500/30 text-rose-400 text-xs font-bold text-center">
          {startError}
        </div>
      )}

      {/* Main Grid: Left = Players, Right = Room Settings */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column: Player List */}
        <div className="lg:col-span-2 glass-card p-6 flex flex-col justify-between min-h-[450px]">
          <div>
            <div className="flex items-center justify-between mb-5">
              <div className="flex items-center gap-2">
                <Users className="w-5 h-5 text-cyan-400" />
                <h2 className="font-display font-bold text-lg text-white">
                  Players in Lobby ({players.length})
                </h2>
              </div>
              <span className="text-xs font-semibold px-2.5 py-1 rounded-full bg-slate-800 text-slate-300">
                Min 3 • Max 50
              </span>
            </div>

            {/* Players Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-6">
              {players.map((p) => {
                const isSelf = p.id === player?.id;
                return (
                  <div
                    key={p.id}
                    className={`flex items-center justify-between p-3 rounded-2xl border transition-all ${
                      isSelf
                        ? 'bg-cyan-950/20 border-cyan-500/30 shadow-md'
                        : !p.isConnected
                        ? 'bg-rose-950/20 border-rose-500/40 opacity-75'
                        : 'bg-dark-800/60 border-slate-800'
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <PlayerAvatar player={p} size="sm" />
                      <div>
                        <div className="text-sm font-bold text-slate-100 flex items-center gap-1.5">
                          <span>{p.username}</span>
                          {isSelf && (
                            <span className="text-[10px] font-bold text-cyan-400 bg-cyan-500/10 px-1.5 py-0.2 rounded">
                              YOU
                            </span>
                          )}
                        </div>
                        <div className="text-[11px] text-slate-400 flex items-center gap-2 mt-0.5">
                          {p.isHost ? (
                            <span className="text-amber-400 font-semibold">Room Host</span>
                          ) : !p.isConnected ? (
                            <span className="text-rose-400 font-semibold animate-pulse">Reconnecting...</span>
                          ) : (
                            <span className="text-emerald-400 font-medium">Ready</span>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Host Kick Option */}
                    {isHost && !isSelf && (
                      <button
                        onClick={() => setPlayerToKick(p)}
                        className="p-2 rounded-xl text-slate-400 hover:text-rose-400 hover:bg-rose-500/10 transition-colors"
                        title={`Remove ${p.username}`}
                      >
                        <UserX className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          {/* Start Game Action Footer */}
          <div className="pt-4 border-t border-slate-800/80 flex items-center justify-between gap-4 flex-wrap">
            <div className="text-xs text-slate-400">
              {!minPlayersMet ? (
                <span className="text-amber-400 font-medium">⚠️ Waiting for {3 - players.length} more players to join</span>
              ) : hasDisconnected ? (
                <span className="text-rose-400 font-medium">⚠️ Start Game is locked while a player is disconnected</span>
              ) : !hasCategories ? (
                <span className="text-amber-400 font-medium">⚠️ At least one word category must be selected</span>
              ) : (
                <span className="text-emerald-400 font-medium">✅ Lobby is ready to start!</span>
              )}
            </div>

            {isHost ? (
              <button
                onClick={handleStartGame}
                disabled={!canStart}
                className="btn-primary flex items-center gap-2 px-8 py-3.5 shadow-xl disabled:opacity-40 disabled:cursor-not-allowed"
              >
                <Play className="w-5 h-5 fill-current" />
                <span className="font-bold">Start Match</span>
              </button>
            ) : (
              <div className="text-xs font-semibold px-4 py-2.5 rounded-xl bg-slate-800 text-slate-400 border border-slate-700">
                Waiting for Host to start...
              </div>
            )}
          </div>
        </div>

        {/* Right Column: Preferences & Host Settings */}
        <div className="glass-card p-6 flex flex-col justify-between">
          <div>
            {/* Section 1: Shared Word Category Selection (Available to ALL Players in Lobby) */}
            <div className="mb-6 p-4 rounded-2xl bg-cyan-950/20 border border-cyan-500/30">
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <Layers className="w-4 h-4 text-cyan-400" />
                  <span className="text-xs font-bold uppercase tracking-wider text-cyan-300">
                    Word Categories ({sharedCategorySlugs.length})
                  </span>
                </div>
                <span className="text-[10px] text-cyan-400 font-bold px-2 py-0.5 rounded-full bg-cyan-500/10 border border-cyan-500/20">
                  Shared Room
                </span>
              </div>
              <p className="text-xs text-slate-300 font-medium mb-3 truncate">
                {sharedCategoryNames.join(', ')}
              </p>
              <button
                type="button"
                onClick={() => setShowCategorySelector(true)}
                className="w-full flex items-center justify-center gap-2 py-2.5 px-3 rounded-xl bg-cyan-500 hover:bg-cyan-400 text-slate-950 text-xs font-bold transition-all shadow-md shadow-cyan-950/40"
              >
                <Layers className="w-4 h-4" />
                <span>Select / Change Categories</span>
              </button>
              <span className="text-[10px] text-slate-500 mt-2 block leading-relaxed">
                The match word pool is drawn from these categories. Any player in the lobby can select or change them.
              </span>
            </div>

            {/* Section 2: Global Game Settings */}
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <Settings className="w-5 h-5 text-rose-400" />
                <h2 className="font-display font-bold text-lg text-white">Game Settings</h2>
              </div>
              {isHost ? (
                <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-rose-500/10 text-rose-400 border border-rose-500/20">
                  Host Controls
                </span>
              ) : (
                <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-slate-800 text-slate-400 border border-slate-700">
                  Read Only
                </span>
              )}
            </div>

            {isHost ? (
              /* HOST VIEW: Interactive Global Controls */
              <div className="space-y-4">
                {/* Imposter Count */}
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-400 mb-1.5">
                    Number of Imposters
                  </label>
                  <div className="grid grid-cols-3 gap-2">
                    {[1, 2, 3].map((num) => {
                      const isSelected = settings.impostersCount === num;
                      return (
                        <button
                          key={num}
                          type="button"
                          onClick={() => updateSettings(normalizedCode, player.id, { impostersCount: num })}
                          className={`py-2 rounded-xl text-xs font-bold border transition-all ${
                            isSelected
                              ? 'bg-rose-500/20 border-rose-500 text-rose-300 ring-1 ring-rose-500'
                              : 'bg-dark-950 border-slate-800 text-slate-400 hover:text-white'
                          }`}
                        >
                          {num} {num === 1 ? 'Imposter' : 'Imposters'}
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Turn Duration */}
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-400 mb-1.5">
                    Turn Clue Timer
                  </label>
                  <div className="grid grid-cols-4 gap-1.5">
                    {[15, 30, 45, 60].map((sec) => (
                      <button
                        key={sec}
                        type="button"
                        onClick={() => updateSettings(normalizedCode, player.id, { turnDurationSeconds: sec })}
                        className={`py-2 rounded-xl text-xs font-bold border transition-all ${
                          settings.turnDurationSeconds === sec
                            ? 'bg-cyan-500/20 border-cyan-500 text-cyan-300'
                            : 'bg-dark-950 border-slate-800 text-slate-400 hover:text-white'
                        }`}
                      >
                        {sec}s
                      </button>
                    ))}
                  </div>
                </div>

                {/* Voting Duration */}
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-400 mb-1.5">
                    Voting Timer
                  </label>
                  <div className="grid grid-cols-3 gap-2">
                    {[30, 45, 60].map((sec) => (
                      <button
                        key={sec}
                        type="button"
                        onClick={() => updateSettings(normalizedCode, player.id, { votingDurationSeconds: sec })}
                        className={`py-2 rounded-xl text-xs font-bold border transition-all ${
                          settings.votingDurationSeconds === sec
                            ? 'bg-cyan-500/20 border-cyan-500 text-cyan-300'
                            : 'bg-dark-950 border-slate-800 text-slate-400 hover:text-white'
                        }`}
                      >
                        {sec}s
                      </button>
                    ))}
                  </div>
                </div>

                {/* Lobby Disconnect Timeout */}
                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <label className="text-xs font-bold uppercase tracking-wider text-slate-400">
                      Lobby Disconnect Timeout
                    </label>
                    <span className="text-[10px] text-rose-400 font-semibold">Configurable</span>
                  </div>
                  <div className="grid grid-cols-5 gap-1.5">
                    {[3, 5, 10, 15, 30].map((sec) => (
                      <button
                        key={sec}
                        type="button"
                        onClick={() => updateSettings(normalizedCode, player.id, { lobbyDisconnectTimeout: sec })}
                        className={`py-2 rounded-xl text-xs font-bold border transition-all ${
                          (settings.lobbyDisconnectTimeout || 5) === sec
                            ? 'bg-rose-500/20 border-rose-500 text-rose-300 ring-1 ring-rose-500'
                            : 'bg-dark-950 border-slate-800 text-slate-400 hover:text-white'
                        }`}
                      >
                        {sec}s
                      </button>
                    ))}
                  </div>
                  <span className="text-[10px] text-slate-500 mt-1 block">
                    Grace period before a disconnected player slot is dropped from lobby.
                  </span>
                </div>

                {/* Game Disconnect Timeout */}
                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <label className="text-xs font-bold uppercase tracking-wider text-slate-400">
                      Game Disconnect Timeout
                    </label>
                    <span className="text-[10px] text-cyan-400 font-semibold">Configurable</span>
                  </div>
                  <div className="grid grid-cols-5 gap-1.5">
                    {[3, 5, 10, 15, 30].map((sec) => (
                      <button
                        key={sec}
                        type="button"
                        onClick={() => updateSettings(normalizedCode, player.id, { gameDisconnectTimeout: sec })}
                        className={`py-2 rounded-xl text-xs font-bold border transition-all ${
                          (settings.gameDisconnectTimeout || settings.gameDisconnectGracePeriod || 15) === sec
                            ? 'bg-cyan-500/20 border-cyan-500 text-cyan-300 ring-1 ring-cyan-500'
                            : 'bg-dark-950 border-slate-800 text-slate-400 hover:text-white'
                        }`}
                      >
                        {sec}s
                      </button>
                    ))}
                  </div>
                  <span className="text-[10px] text-slate-500 mt-1 block">
                    Grace period before a disconnected player is permanently removed from the active game.
                  </span>
                </div>
              </div>
            ) : (
              /* NORMAL PLAYER VIEW: Clean Read-Only Summary */
              <div className="space-y-3 p-4 rounded-2xl bg-dark-950 border border-slate-800">
                <div className="flex items-center justify-between py-2 border-b border-slate-800/60">
                  <span className="text-xs font-medium text-slate-400">Imposters</span>
                  <span className="text-xs font-bold text-white px-2.5 py-0.5 rounded-lg bg-slate-800 border border-slate-700">
                    {settings.impostersCount || 1} {settings.impostersCount === 1 ? 'Imposter' : 'Imposters'}
                  </span>
                </div>
                <div className="flex items-center justify-between py-2 border-b border-slate-800/60">
                  <span className="text-xs font-medium text-slate-400">Turn Clue Timer</span>
                  <span className="text-xs font-bold text-white px-2.5 py-0.5 rounded-lg bg-slate-800 border border-slate-700">
                    {settings.turnDurationSeconds || 30} seconds
                  </span>
                </div>
                <div className="flex items-center justify-between py-2 border-b border-slate-800/60">
                  <span className="text-xs font-medium text-slate-400">Voting Timer</span>
                  <span className="text-xs font-bold text-white px-2.5 py-0.5 rounded-lg bg-slate-800 border border-slate-700">
                    {settings.votingDurationSeconds || 45} seconds
                  </span>
                </div>
                <div className="flex items-center justify-between py-2 border-b border-slate-800/60">
                  <span className="text-xs font-medium text-slate-400">Lobby Disconnect Timeout</span>
                  <span className="text-xs font-bold text-white px-2.5 py-0.5 rounded-lg bg-slate-800 border border-slate-700">
                    {settings.lobbyDisconnectTimeout || 5} seconds
                  </span>
                </div>
                <div className="flex items-center justify-between py-2">
                  <span className="text-xs font-medium text-slate-400">Game Disconnect Timeout</span>
                  <span className="text-xs font-bold text-white px-2.5 py-0.5 rounded-lg bg-slate-800 border border-slate-700">
                    {settings.gameDisconnectTimeout || settings.gameDisconnectGracePeriod || 15} seconds
                  </span>
                </div>
                <div className="mt-3 pt-3 border-t border-slate-800/80 text-[11px] text-slate-400 flex items-center gap-1.5">
                  <span className="text-amber-400">🔒</span>
                  <span>Configured by the room host. Updates sync automatically.</span>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Multi-Category Picker Modal (Shared room categories) */}
      {showCategorySelector && (
        <CategorySelector
          selectedSlugs={sharedCategorySlugs}
          onSelect={(chosenCats) => {
            const updater = updateRoomCategories || updatePlayerCategories;
            updater(
              normalizedCode,
              player.id,
              chosenCats.map(c => c.slug),
              chosenCats.map(c => c.name)
            );
          }}
          onClose={() => setShowCategorySelector(false)}
        />
      )}

      {/* Kick Player Modal */}
      {playerToKick && (
        <KickConfirmModal
          player={playerToKick}
          onConfirm={handleKickConfirm}
          onCancel={() => setPlayerToKick(null)}
        />
      )}

      {/* Host Approval Modal for Kicked Player Rejoin Request */}
      {isHost && pendingRejoinRequest && (
        <RejoinApprovalModal
          request={pendingRejoinRequest}
          onApprove={() =>
            approveRejoin(
              pendingRejoinRequest.requestId,
              normalizedCode,
              player.id,
              pendingRejoinRequest.player.id
            )
          }
          onDeny={() =>
            denyRejoin(
              pendingRejoinRequest.requestId,
              normalizedCode,
              player.id,
              pendingRejoinRequest.player.id
            )
          }
        />
      )}
    </div>
  );
}

export default Lobby;
