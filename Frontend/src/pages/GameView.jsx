import React, { useEffect, useState, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import confetti from 'canvas-confetti';
import {
  Shield, Send, Clock, Vote, Trophy, Skull,LogOut ,
  AlertCircle, Sparkles, Volume2, ArrowRight, RotateCcw, Home as HomeIcon, ArrowLeft, Eye
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useSocket } from '../context/SocketContext';
import { PlayerAvatar } from '../components/PlayerAvatar';
import { CountdownTimer } from '../components/CountdownTimer';
import { sounds } from '../utils/sound';

function DisconnectCountdownBadge({ deadline, timeout = 15, isGameOver = false }) {
  const [secondsLeft, setSecondsLeft] = useState(() => {
    if (isGameOver) return 0;
    if (!deadline) return timeout;
    return Math.max(0, Math.ceil((deadline - Date.now()) / 1000));
  });

  useEffect(() => {
    if (isGameOver) return;

    const tick = () => {
      if (!deadline) {
        setSecondsLeft(timeout);
        return;
      }
      const remaining = Math.max(0, Math.ceil((deadline - Date.now()) / 1000));
      setSecondsLeft(remaining);
    };

    tick();
    const timer = setInterval(tick, 500);
    return () => clearInterval(timer);
  }, [deadline, timeout, isGameOver]);

  if (isGameOver) return null;

  return (
    <div className="flex flex-col items-end text-right">
      <span className="inline-flex items-center gap-1 text-[10px] font-bold text-amber-400 bg-amber-500/10 px-2 py-0.5 rounded-full border border-amber-500/25">
        <span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-ping inline-block" />
        Disconnected · Reconnecting...
      </span>
      <span className="text-[10px] font-mono font-bold text-rose-400 mt-0.5">
        Removal in {secondsLeft}s
      </span>
    </div>
  );
}

export function GameView() {
  const { roomCode } = useParams();
  const navigate = useNavigate();
  const { player } = useAuth();
  const {
    roomState,
    kickedNotice,
    disconnectAlert,
    submitClue,
    submitVote,
    joinRoom,
    leaveRoom,
    returnToLobby,
    roomLifecycleState
  } = useSocket();

  const [clueInput, setClueInput] = useState('');
  const [selectedVoteTarget, setSelectedVoteTarget] = useState(null);
  const [hasVoted, setHasVoted] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [isLeaving, setIsLeaving] = useState(false);

  const normalizedCode = (roomCode || '').toUpperCase();

  // If player was kicked, redirect immediately to Home Screen
  useEffect(() => {
    if (kickedNotice) {
      navigate('/', { replace: true });
    }
  }, [kickedNotice, navigate]);

  // Reconnect / sync if needed (unless kicked, leaving, or intentionally exited)
  useEffect(() => {
    if (kickedNotice) return;
    if (isLeaving || roomLifecycleState === 'INTENTIONAL_EXIT' || roomLifecycleState === 'NO_ROOM') return;
    if (player && (!roomState || roomState.code !== normalizedCode)) {
      joinRoom(normalizedCode, player);
    }
  }, [normalizedCode, player, roomState, kickedNotice, joinRoom, isLeaving, roomLifecycleState]);

  // If room resets to WAITING (play again/return to lobby), automatically navigate to lobby!
  useEffect(() => {
    if (roomState && roomState.status === 'WAITING') {
      navigate(`/lobby/${normalizedCode}`);
    }
  }, [roomState?.status, normalizedCode, navigate]);

  // Trigger confetti on victory
  useEffect(() => {
    if (roomState && roomState.status === 'FINISHED') {
      confetti({
        particleCount: 120,
        spread: 80,
        origin: { y: 0.6 }
      });
    }
  }, [roomState?.status]);

  // Reset vote submission when entering a new voting round
  useEffect(() => {
    if (roomState?.status === 'VOTING') {
      setHasVoted(false);
      setSelectedVoteTarget(null);
    }
  }, [roomState?.status, roomState?.currentRound]);

  const handleLeaveGame = useCallback(async () => {
    if (isLeaving) return;
    setIsLeaving(true);
    sounds.playClick();
    try {
      if (player?.id) {
        await leaveRoom(normalizedCode, player.id);
      }
    } finally {
      navigate('/', { replace: true });
    }
  }, [leaveRoom, normalizedCode, player?.id, navigate, isLeaving]);

  const handleReturnToLobby = () => {
    sounds.playClick();
    returnToLobby(normalizedCode, player?.id);
  };

  if (!roomState) {
    return (
      <div className="max-w-xl mx-auto px-4 py-20 text-center">
        <div className="w-12 h-12 rounded-full border-4 border-rose-500 border-t-transparent animate-spin mx-auto mb-4" />
        <p className="text-slate-400 font-semibold text-sm">Connecting to authoritative game state...</p>
      </div>
    );
  }

  const me = roomState.players.find(p => p.id === player?.id) || {};
  const isAlive = me.isAlive !== false && !me.permanentlyDeparted;
  const isMyTurn = isAlive && roomState.status === 'CLUE_ROUND' && roomState.activeTurnPlayerId === player?.id;
  const isImposter = me.role === 'IMPOSTER';
  const isCivilian = me.role === 'CIVILIAN';

  const handleClueSubmit = (e) => {
    e.preventDefault();
    setErrorMessage('');
    if (!isAlive || !isMyTurn) return;
    if (!clueInput.trim()) return;

    try {
      submitClue(normalizedCode, player.id, clueInput.trim());
      setClueInput('');
    } catch (err) {
      setErrorMessage(err.message);
    }
  };

  const handleVoteSubmit = () => {
    setErrorMessage('');
    if (!isAlive) return;
    if (!selectedVoteTarget) {
      setErrorMessage('Please select a player to vote for.');
      return;
    }
    submitVote(normalizedCode, player.id, selectedVoteTarget);
    setHasVoted(true);
  };

  return (
    <div className="max-w-5xl mx-auto px-4 py-6 sm:py-8">
      {/* Top Game Bar */}
      <div className="flex items-center justify-between gap-4 mb-6">
        <div className="flex items-center gap-3 sm:gap-4 flex-wrap">
          <button
            onClick={handleLeaveGame}
            disabled={isLeaving}
            className="flex items-center justify-center text-slate-400 hover:text-white p-2.5 rounded-xl bg-dark-900 border border-slate-800 hover:border-slate-700 transition-colors disabled:opacity-50"
            title="Leave Match"
            aria-label="Leave Match"
          >
            <LogOut  className="w-4 h-4" />
          </button>

          <div className="h-6 w-px bg-slate-800 hidden sm:block" />

          <div className="flex items-center gap-2">
            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
              Round
            </span>
            <span className="font-display font-bold text-sm sm:text-base text-cyan-400">
              {roomState.currentRound || 1}
            </span>
          </div>
        </div>

        <div className="flex items-center justify-end gap-3">
          {/* Phase Countdown Timer */}
          {roomState.status === 'CLUE_ROUND' && roomState.turnDeadline && (
            <CountdownTimer
              deadline={roomState.turnDeadline}
              totalSeconds={roomState.settings?.turnDurationSeconds || 30}
              label="Turn Timer"
            />
          )}

          {roomState.status === 'VOTING' && roomState.votingDeadline && (
            <CountdownTimer
              deadline={roomState.votingDeadline}
              totalSeconds={roomState.settings?.votingDurationSeconds || 45}
              label="Voting Deadline"
            />
          )}
        </div>
      </div>

      {/* Persistent Spectator / Eliminated Banner */}
      {!isAlive && roomState.status !== 'FINISHED' && (
        <div className="mb-6 p-4 sm:p-5 rounded-2xl bg-gradient-to-r from-rose-950/40 via-purple-950/30 to-dark-900 border border-rose-500/40 shadow-xl shadow-rose-950/20 backdrop-blur-md animate-fade-in">
          <div className="flex items-center gap-3.5">
            <div className="p-3 rounded-2xl bg-rose-500/20 text-rose-400 border border-rose-500/30 flex-shrink-0">
              <Skull className="w-6 h-6 animate-pulse" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap mb-1">
                <span className="font-display font-black text-sm sm:text-base text-white tracking-wide">
                  YOU HAVE BEEN ELIMINATED
                </span>
                <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full bg-rose-500/20 text-rose-300 border border-rose-500/30">
                  Spectator Mode
                </span>
              </div>
              <p className="text-xs text-slate-300 leading-relaxed">
                You are now spectating this match. You can watch the remaining rounds, but you cannot submit clues or vote.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Secret Card Section (Private to the user) */}
      <div className="mb-6">
        <div
          className={`glass-card p-5 sm:p-6 border relative overflow-hidden transition-all ${isImposter
            ? 'border-rose-500/50 bg-rose-950/20 imposter-glow'
            : 'border-cyan-500/50 bg-cyan-950/20 civilian-glow'
            }`}
        >
          <div className="flex items-center gap-4">
            <div
              className={`p-3.5 rounded-2xl flex-shrink-0 ${isImposter ? 'bg-rose-500/20 text-rose-400' : 'bg-cyan-500/20 text-cyan-400'
                }`}
            >
              <Shield className="w-7 h-7" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap mb-2">
                <span className="text-xs font-bold uppercase tracking-wider text-slate-400">
                  Role:
                </span>
                <span className={isImposter ? 'badge-imposter' : 'badge-civilian'}>
                  {me.role || 'SPECTATOR'}
                </span>
                {!isAlive && (
                  <span className="text-[10px] font-bold uppercase px-2 py-0.5 rounded bg-slate-800 text-slate-400">
                    Spectating
                  </span>
                )}
              </div>

              <div>
                {isImposter ? (
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-xs text-rose-300 font-semibold">
                      Hint:
                    </span>
                    <span className="text-lg sm:text-xl font-black text-rose-200 break-words">
                      {roomState.myHint}
                    </span>
                  </div>
                ) : isCivilian ? (
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-xs text-cyan-300 font-semibold">
                      Secret Word:
                    </span>
                    <span className="text-xl sm:text-2xl font-black text-cyan-200 tracking-wide font-display break-words">
                      {roomState.myWord || '—'}
                    </span>
                  </div>
                ) : (
                  <span className="text-sm font-semibold text-slate-400">
                    Spectator Mode
                  </span>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Error Banner */}
      {errorMessage && (
        <div className="mb-4 p-3.5 rounded-2xl bg-rose-500/10 border border-rose-500/30 text-rose-400 text-xs font-bold text-center">
          {errorMessage}
        </div>
      )}

      {/* ========================================================== */}
      {/* PHASE 1: ROLE REVEAL */}
      {/* ========================================================== */}
      {roomState.status === 'ROLE_REVEAL' && (
        <div className="glass-card p-8 sm:p-12 text-center animate-fade-in">
          <div className="w-16 h-16 rounded-3xl bg-cyan-500/20 text-cyan-400 flex items-center justify-center mx-auto mb-4 border border-cyan-500/30 animate-pulse">
            <Sparkles className="w-8 h-8" />
          </div>
          <h2 className="font-display font-black text-2xl sm:text-3xl text-white mb-2">Secret Roles Distributed</h2>
          <p className="text-xs sm:text-sm text-slate-400 max-w-md mx-auto mb-6">
            Memorize your word or hint above! Clue rounds will begin in a moment.
          </p>
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-dark-950 border border-slate-800 text-xs sm:text-sm font-bold text-slate-300">
            <Clock className="w-4 h-4 text-cyan-400" />
            <span>Starting round 1 shortly...</span>
          </div>
        </div>
      )}

      {/* ========================================================== */}
      {/* PHASE 2: CLUE ROUND */}
      {/* ========================================================== */}
      {roomState.status === 'CLUE_ROUND' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Left: Clue Input & Active Player Banner */}
          <div className="lg:col-span-2 space-y-6">

            <div
              className={`glass-card p-5 sm:p-6 border ${isMyTurn
                ? 'border-cyan-500/60 bg-cyan-950/20 ring-1 ring-cyan-500'
                : 'border-slate-800'
                }`}
            >
              <div className="flex items-center justify-between gap-4 flex-wrap mb-4">
                <div className="flex items-center gap-3">
                  <div className={`p-2.5 rounded-xl ${isMyTurn ? 'bg-cyan-500/20 text-cyan-400' : 'bg-slate-800 text-slate-400'}`}>
                    <Clock className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="font-display font-bold text-base sm:text-lg text-white">
                      {isMyTurn ? '🌟 It is YOUR turn to submit a clue!' : `${roomState.players.find(p => p.id === roomState.activeTurnPlayerId)?.username || 'active player'}'s turn...`}
                    </h3>
                    <p className="text-xs text-slate-400">
                      {isImposter
                        ? 'Give a clue or guess the secret word to win!'
                        : 'Give a one-word clue without revealing the secret!'}
                    </p>
                  </div>
                </div>
              </div>

              {/* Clue Input Form */}
              {isMyTurn && isAlive && (
                <form onSubmit={handleClueSubmit} className="space-y-3">
                  <div className="flex flex-col sm:flex-row gap-2">
                    <input
                      type="text"
                      value={clueInput}
                      onChange={(e) => setClueInput(e.target.value)}
                      placeholder={isImposter ? 'Enter clue OR exact secret word guess...' : 'Enter your related clue...'}
                      autoFocus
                      maxLength={40}
                      className="flex-1 bg-dark-950 border border-slate-700 focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500 px-4 py-3 rounded-xl text-white placeholder-slate-500 text-sm font-semibold outline-none"
                    />
                    <button type="submit" className="btn-cyan flex items-center justify-center gap-2 px-6 py-3 sm:py-0 w-full sm:w-auto">
                      <Send className="w-4 h-4" />
                      <span>Submit</span>
                    </button>
                  </div>
                  {isImposter && (
                    <div className="text-[11px] text-rose-400 font-semibold bg-rose-500/10 p-2.5 rounded-xl border border-rose-500/20">
                      💡 <strong>Imposter Tip:</strong> Guess the secret word and enter it here to win instantly!
                    </div>
                  )}
                </form>
              )}
            </div>


            {/* Submitted Clues Table (Section 6 Requirement) */}
            <div className="glass-card p-5 sm:p-6">
              <div className="flex items-center justify-between mb-4">
                <h4 className="font-display font-bold text-base text-white flex items-center gap-2">
                  <span>Submitted Clues</span>
                  <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-slate-800 text-slate-400">
                    Round {roomState.currentRound || 1}
                  </span>
                </h4>
                <span className="text-[11px] text-slate-500">Live Turn Status</span>
              </div>

              {/* Responsive Clues Table */}
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="border-b border-slate-800/80 text-[11px] font-bold uppercase tracking-wider text-slate-400">
                      <th className="pb-3 pl-2">Player</th>
                      <th className="pb-3 px-2">Clue</th>
                      <th className="pb-3 pr-2 text-right">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/50">
                    {roomState.players.filter(p => p.isAlive && !p.permanentlyDeparted).map((p) => {
                      const entry = roomState.clueHistory?.find(
                        c => c.playerId === p.id && c.round === (roomState.currentRound || 1)
                      );
                      const isDisconnected = (!p.isConnected || p.connectionStatus === 'DISCONNECTED') && p.isAlive && !p.permanentlyDeparted;
                      const isSkipped = entry?.status === 'SKIPPED' || entry?.skipped;
                      const isSubmitted = entry && !isSkipped && (entry.status === 'SUBMITTED' || entry.clue);
                      const isActive = !entry && roomState.activeTurnPlayerId === p.id && !isDisconnected;
                      const isWaiting = !entry && !isActive && !isDisconnected;

                      return (
                        <tr key={p.id} className="hover:bg-dark-800/40 transition-colors">
                          <td className="py-3 pl-2">
                            <div className="flex items-center gap-2.5">
                              <PlayerAvatar player={p} size="sm" showStatus={false} />
                              <span className="text-xs font-bold text-slate-200 truncate max-w-[120px] sm:max-w-[160px]">
                                {p.username}
                                {p.id === player?.id && (
                                  <span className="ml-1 text-[10px] text-cyan-400 font-normal">(You)</span>
                                )}
                              </span>
                            </div>
                          </td>
                          <td className="py-3 px-2">
                            {isSubmitted ? (
                              <span className="font-display font-black text-sm text-cyan-200">
                                "{entry.clue}"
                              </span>
                            ) : (
                              <span className="text-xs text-slate-500">—</span>
                            )}
                          </td>
                          <td className="py-3 pr-2 text-right">
                            {isDisconnected && (
                              <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-rose-500/10 text-rose-400 border border-rose-500/20">
                                Disconnected
                              </span>
                            )}
                            {isSubmitted && (
                              <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                                Submitted
                              </span>
                            )}
                            {isSkipped && (
                              <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-amber-500/10 text-amber-400 border border-amber-500/20">
                                Skipped
                              </span>
                            )}
                            {isActive && (
                              <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-cyan-500/10 text-cyan-400 border border-cyan-500/20 animate-pulse">
                                Thinking...
                              </span>
                            )}
                            {isWaiting && (
                              <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-[10px] font-semibold text-slate-500 bg-slate-800/60 border border-slate-700/40">
                                Waiting
                              </span>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              {/* Historical Clues (if round > 1) */}
              {roomState.clueHistory && roomState.clueHistory.some(c => c.round < (roomState.currentRound || 1)) && (
                <div className="mt-5 pt-4 border-t border-slate-800/60">
                  <div className="text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-2">
                    Previous Rounds Clues
                  </div>
                  <div className="space-y-1.5 max-h-36 overflow-y-auto">
                    {roomState.clueHistory
                      .filter(c => c.round < (roomState.currentRound || 1))
                      .map((c, i) => (
                        <div key={i} className="flex items-center justify-between text-xs py-1 px-2 rounded-lg bg-dark-950/60 text-slate-400">
                          <span>
                            <strong className="text-slate-300">{c.username}</strong>:{' '}
                            {c.skipped ? <em className="text-amber-400">Skipped</em> : `"${c.clue}"`}
                          </span>
                          <span className="text-[10px] text-slate-500">R{c.round}</span>
                        </div>
                      ))}
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Right: Players Turn Order Status */}
          <div className="glass-card p-6">
            <h4 className="font-display font-bold text-base text-white mb-4">Turn Order</h4>
            <div className="space-y-2.5">
              {roomState.players.map((p) => {
                const isDisconnected = (!p.isConnected || p.connectionStatus === 'DISCONNECTED') && p.isAlive && !p.permanentlyDeparted;
                const isActive = roomState.activeTurnPlayerId === p.id && !isDisconnected;
                const isEliminated = !p.isAlive || p.permanentlyDeparted;
                const playerDeadline = p.disconnectDeadline || (disconnectAlert?.playerId === p.id ? (disconnectAlert.disconnectDeadline || disconnectAlert.deadline) : null);
                const playerTimeout = p.gameDisconnectTimeout || (disconnectAlert?.playerId === p.id ? (disconnectAlert.gameDisconnectTimeout || disconnectAlert.timeoutSeconds) : (roomState.settings?.gameDisconnectTimeout || roomState.settings?.gameDisconnectGracePeriod || 15));

                return (
                  <div
                    key={p.id}
                    className={`flex items-center justify-between p-2.5 rounded-xl border transition-all ${isActive
                      ? 'bg-cyan-950/40 border-cyan-500 text-white font-bold ring-1 ring-cyan-500'
                      : isDisconnected
                        ? 'bg-rose-950/30 border-rose-500/60 text-white ring-1 ring-rose-500/40 shadow-sm shadow-rose-950'
                        : isEliminated
                          ? 'bg-dark-950/40 border-slate-900 opacity-40'
                          : 'bg-dark-800/60 border-slate-800 text-slate-300'
                      }`}
                  >
                    <div className="flex items-center gap-2.5">
                      <PlayerAvatar player={p} size="sm" showStatus={false} />
                      <div className="flex flex-col">
                        <span className="text-sm font-semibold text-slate-200">{p.username}</span>
                        {p.id === player?.id && (
                          <span className="text-[10px] text-cyan-400 font-normal">(You)</span>
                        )}
                      </div>
                    </div>
                    <div>
                      {p.permanentlyDeparted ? (
                        <span className="text-[10px] font-bold uppercase text-slate-600">Left Match</span>
                      ) : !p.isAlive ? (
                        <span className="text-[10px] font-bold uppercase text-slate-500">Eliminated</span>
                      ) : isDisconnected ? (
                        <DisconnectCountdownBadge
                          deadline={playerDeadline}
                          timeout={playerTimeout}
                          isGameOver={roomState.status === 'FINISHED'}
                        />
                      ) : isActive ? (
                        <span className="text-[10px] font-bold uppercase text-cyan-400 animate-pulse">Thinking...</span>
                      ) : (
                        <span className="text-[10px] font-semibold text-slate-500">Waiting</span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* ========================================================== */}
      {/* PHASE 3: VOTING */}
      {/* ========================================================== */}
      {roomState.status === 'VOTING' && (
        isAlive ? (
          /* Normal Alive Player Voting Interface */
          <div className="glass-card p-6 sm:p-8 animate-fade-in">
            <div className="text-center mb-6">
              <div className="w-14 h-14 rounded-3xl bg-rose-500/20 text-rose-500 flex items-center justify-center mx-auto mb-3 border border-rose-500/30">
                <Vote className="w-7 h-7" />
              </div>
              <h2 className="font-display font-black text-2xl text-white">Cast Your Vote</h2>
              <p className="text-xs text-slate-400 max-w-md mx-auto">
                Review all clues submitted and vote to eliminate who you believe is the Imposter.
              </p>
            </div>

            {/* Player Voting Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3 mb-6">
              {roomState.players.filter(p => p.isAlive && !p.permanentlyDeparted).map((p) => {
                const isSelf = p.id === player?.id;
                const isSelected = selectedVoteTarget === p.id;
                return (
                  <button
                    key={p.id}
                    disabled={isSelf || hasVoted || !isAlive}
                    onClick={() => setSelectedVoteTarget(p.id)}
                    className={`p-4 rounded-2xl border text-left transition-all ${isSelected
                      ? 'bg-rose-950/40 border-rose-500 text-white ring-2 ring-rose-500 shadow-lg shadow-rose-500/20'
                      : isSelf
                        ? 'bg-dark-950/40 border-slate-800 opacity-60 cursor-not-allowed'
                        : 'bg-dark-800/80 border-slate-700/80 hover:border-slate-600 hover:bg-dark-800'
                      }`}
                  >
                    <div className="flex items-center gap-3 mb-2">
                      <PlayerAvatar player={p} size="sm" showStatus={false} />
                      <div>
                        <div className="font-bold text-sm text-slate-100">{p.username}</div>
                        <div className="text-[11px] text-slate-400">
                          {isSelf ? '(You cannot vote self)' : 'Vote to Eliminate'}
                        </div>
                      </div>
                    </div>
                    {p.clues?.length > 0 && (
                      <div className="text-[11px] text-slate-400 mt-2 truncate">
                        Clues: <span className="text-slate-200 font-semibold">{p.clues.filter(Boolean).join(', ')}</span>
                      </div>
                    )}
                  </button>
                );
              })}
            </div>

            <div className="flex items-center justify-center gap-4">
              <button
                onClick={handleVoteSubmit}
                disabled={!selectedVoteTarget || hasVoted || !isAlive}
                className="btn-primary px-8 py-3.5 flex items-center gap-2 text-sm disabled:opacity-40"
              >
                <Vote className="w-4 h-4" />
                <span>{hasVoted ? 'Vote Submitted!' : 'Confirm Vote'}</span>
              </button>
            </div>
          </div>
        ) : (
          /* Spectator Voting View (Eliminated players cannot vote) */
          <div className="glass-card p-6 sm:p-8 animate-fade-in">
            <div className="text-center mb-6">
              <div className="w-14 h-14 rounded-3xl bg-purple-500/20 text-purple-400 flex items-center justify-center mx-auto mb-3 border border-purple-500/30">
                <Eye className="w-7 h-7" />
              </div>
              <h2 className="font-display font-black text-2xl text-white">
                Voting in Progress — Spectating
              </h2>
              <p className="text-xs text-slate-400 max-w-md mx-auto mt-1">
                You are spectating this round. Alive players are voting to eliminate who they suspect is the Imposter.
              </p>
              <div className="mt-3 inline-flex items-center gap-2 px-3 py-1 rounded-full bg-slate-800/80 border border-slate-700/60 text-xs font-semibold text-slate-300">
                <span>Votes cast:</span>
                <span className="font-bold text-cyan-400 font-mono">
                  {Object.keys(roomState.votes || {}).length} / {roomState.players.filter(p => p.isAlive && !p.permanentlyDeparted).length}
                </span>
              </div>
            </div>

            {/* Spectator Live Votes Table */}
            <div className="overflow-x-auto border border-slate-800 rounded-2xl bg-dark-950/60 max-w-2xl mx-auto shadow-inner">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-slate-800 text-[11px] font-bold uppercase tracking-wider text-slate-400 bg-dark-900/80">
                    <th className="py-3 px-4">Eligible Voter</th>
                    <th className="py-3 px-4">Voted For</th>
                    <th className="py-3 px-4 text-right">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/50 text-xs sm:text-sm">
                  {roomState.players.filter(p => p.isAlive && !p.permanentlyDeparted).map((voter) => {
                    const targetPlayerId = roomState.votes?.[voter.id];
                    const targetPlayer = targetPlayerId ? roomState.players.find(x => x.id === targetPlayerId) : null;
                    const hasCastVote = Boolean(targetPlayerId);

                    return (
                      <tr key={voter.id} className="hover:bg-dark-900/40 transition-colors">
                        <td className="py-3 px-4">
                          <div className="flex items-center gap-2.5">
                            <PlayerAvatar player={voter} size="sm" showStatus={false} />
                            <span className="font-semibold text-slate-200">{voter.username}</span>
                          </div>
                        </td>
                        <td className="py-3 px-4">
                          {hasCastVote ? (
                            <div className="flex items-center gap-1.5 font-bold text-rose-300">
                              <span>🎯</span>
                              <span>{targetPlayer ? targetPlayer.username : 'Target Selected'}</span>
                            </div>
                          ) : (
                            <span className="text-slate-500 italic">Undecided...</span>
                          )}
                        </td>
                        <td className="py-3 px-4 text-right">
                          {hasCastVote ? (
                            <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                              Voted
                            </span>
                          ) : (
                            <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-amber-500/10 text-amber-400 border border-amber-500/20 animate-pulse">
                              Deciding...
                            </span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            <div className="mt-5 text-center text-xs text-slate-500">
              Results and eliminations will be calculated when all alive players cast their votes or time expires.
            </div>
          </div>
        )
      )}

      {/* ========================================================== */}
      {/* PHASE 4: RESULTS & ELIMINATION */}
      {/* ========================================================== */}
      {roomState.status === 'RESULTS' && roomState.eliminationResult && (
        <div className="glass-card p-8 sm:p-12 text-center animate-fade-in max-w-xl mx-auto">
          <div className="w-16 h-16 rounded-3xl bg-rose-500/20 text-rose-500 flex items-center justify-center mx-auto mb-4 border border-rose-500/30">
            <Skull className="w-8 h-8" />
          </div>

          <h2 className="font-display font-black text-3xl text-white mb-2">Round Elimination</h2>

          {roomState.eliminationResult.eliminatedPlayer ? (
            <div className="my-6 p-6 rounded-2xl bg-dark-950 border border-slate-800">
              <div className="text-xs uppercase font-bold text-slate-400 mb-1">Eliminated by Vote</div>
              <div className="font-display font-black text-2xl text-rose-400 mb-2">
                {roomState.eliminationResult.eliminatedPlayer.username}
              </div>
              <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider bg-slate-800 text-slate-200">
                Identity: {roomState.eliminationResult.eliminatedPlayer.role}
              </div>
            </div>
          ) : (
            <div className="my-6 p-6 rounded-2xl bg-dark-950 border border-slate-800 text-amber-400 font-bold">
              The vote was tied! No player was eliminated this round.
            </div>
          )}

          <p className="text-xs text-slate-400">
            Checking victory conditions and preparing for the next round...
          </p>
        </div>
      )}

      {/* ========================================================== */}
      {/* PHASE 5: FINISHED / WINNER ANNOUNCEMENT */}
      {/* ========================================================== */}
      {roomState.status === 'FINISHED' && roomState.winnerResult && (
        <div className="glass-card p-8 sm:p-12 text-center animate-fade-in max-w-2xl mx-auto">
          <div className="w-20 h-20 rounded-3xl bg-amber-500/20 text-amber-400 flex items-center justify-center mx-auto mb-5 border border-amber-500/30 shadow-xl shadow-amber-500/20">
            <Trophy className="w-10 h-10" />
          </div>

          <h1 className="font-display font-black text-4xl sm:text-5xl text-white tracking-tight mb-2">
            {roomState.winnerResult.winnerRole === 'IMPOSTER' ? (
              <span className="text-rose-500">IMPOSTERS WIN!</span>
            ) : (
              <span className="text-cyan-400">CIVILIANS WIN!</span>
            )}
          </h1>

          <p className="text-sm font-semibold text-slate-300 max-w-md mx-auto mb-6">
            {roomState.winnerResult.winCondition === 'IMPOSTER_GUESSED_WORD'
              ? '💥 An Imposter correctly entered the exact secret word during their turn!'
              : roomState.winnerResult.winCondition === 'ALL_IMPOSTERS_ELIMINATED'
                ? '🎉 All Imposters were successfully identified and eliminated!'
                : roomState.winnerResult.winCondition === 'IMPOSTERS_PARITY'
                  ? '🎭 Imposters have reached equal numbers with the Civilians!'
                  : roomState.winnerResult.winCondition === 'FINAL_SHOWDOWN_DECISIVE'
                    ? '🎭 Imposters outmaneuvered the Civilians in the final showdown!'
                    : 'Match completed!'}
          </p>

          {/* Full Secret Reveal Box */}
          <div className="p-6 rounded-2xl bg-dark-950 border border-slate-800 text-left space-y-4 mb-8">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400 block mb-1">
                  Secret Word
                </span>
                <span className="font-display font-extrabold text-xl text-cyan-400">
                  {roomState.winnerResult.secretWord}
                </span>
              </div>
              <div>
                <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400 block mb-1">
                  Imposter Hint
                </span>
                <span className="font-display font-semibold text-sm text-slate-200">
                  {roomState.winnerResult.hint}
                </span>
              </div>
            </div>

            <div>
              <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400 block mb-2">
                Imposters in this Match
              </span>
              <div className="flex items-center gap-2 flex-wrap">
                {roomState.winnerResult.imposters?.map(imp => (
                  <span key={imp.id} className="badge-imposter text-sm py-1.5 px-3">
                    {imp.username}
                  </span>
                ))}
              </div>
            </div>
          </div>

          <div className="flex items-center justify-center gap-3">
            <button
              onClick={handleLeaveGame}
              disabled={isLeaving}
              className="btn-secondary px-6 py-3 flex items-center gap-2 text-sm disabled:opacity-50"
            >
              <HomeIcon className="w-4 h-4" />
              <span>{isLeaving ? 'Leaving...' : 'Back to Home'}</span>
            </button>
            <button
              onClick={handleReturnToLobby}
              className="btn-primary px-8 py-3 flex items-center gap-2 text-sm"
            >
              <RotateCcw className="w-4 h-4" />
              <span>Return to Lobby</span>
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

export default GameView;
