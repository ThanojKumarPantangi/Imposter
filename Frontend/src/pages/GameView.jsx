import React, { useEffect, useState, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import confetti from 'canvas-confetti';
import {
  Shield, Eye, EyeOff, Send, Clock, Vote, Trophy, Skull,
  AlertCircle, Sparkles, Volume2, ArrowRight, RotateCcw, Home as HomeIcon, ArrowLeft
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useSocket } from '../context/SocketContext';
import { PlayerAvatar } from '../components/PlayerAvatar';
import { CountdownTimer } from '../components/CountdownTimer';
import { VoiceControls } from '../components/VoiceControls';
import { sounds } from '../utils/sound';

export function GameView() {
  const { roomCode } = useParams();
  const navigate = useNavigate();
  const { player } = useAuth();
  const {
    roomState,
    submitClue,
    submitVote,
    joinRoom,
    leaveRoom,
    returnToLobby
  } = useSocket();

  const [clueInput, setClueInput] = useState('');
  const [selectedVoteTarget, setSelectedVoteTarget] = useState(null);
  const [hasVoted, setHasVoted] = useState(false);
  const [revealedSecret, setRevealedSecret] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');

  const normalizedCode = (roomCode || '').toUpperCase();

  // Reconnect / sync if needed
  useEffect(() => {
    if (player && (!roomState || roomState.code !== normalizedCode)) {
      joinRoom(normalizedCode, player);
    }
  }, [normalizedCode, player]);

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
    sounds.playClick();
    if (player?.id) {
      await leaveRoom(normalizedCode, player.id);
    }
    navigate('/');
  }, [leaveRoom, normalizedCode, player?.id, navigate]);

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
  const isMyTurn = roomState.status === 'CLUE_ROUND' && roomState.activeTurnPlayerId === player?.id;
  const isImposter = me.role === 'IMPOSTER';
  const isCivilian = me.role === 'CIVILIAN';
  const isAlive = me.isAlive !== false && !me.permanentlyDeparted;

  const handleClueSubmit = (e) => {
    e.preventDefault();
    setErrorMessage('');
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
      <div className="flex items-center justify-between gap-4 mb-6 flex-wrap">
        <div className="flex items-center gap-3">
          <button
            onClick={handleLeaveGame}
            className="flex items-center gap-1.5 text-xs font-bold text-slate-400 hover:text-white px-2.5 py-1.5 rounded-xl bg-dark-900 border border-slate-800 transition-colors"
            title="Leave Match"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>Leave</span>
          </button>

          <div className="flex flex-col">
            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Category</span>
            <span className="font-display font-bold text-base text-white truncate max-w-[160px] sm:max-w-xs">
              {roomState.settings?.categoryName || 'Fruits'}
            </span>
          </div>
          <div className="h-6 w-px bg-slate-800" />
          <div className="flex flex-col">
            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Round</span>
            <span className="font-display font-bold text-base text-cyan-400">{roomState.currentRound || 1}</span>
          </div>
        </div>

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

        {/* Voice controls */}
        <VoiceControls />
      </div>

      {/* Secret Card Section (Private to the user) */}
      <div className="mb-6">
        <div
          className={`glass-card p-5 border relative overflow-hidden transition-all ${
            isImposter
              ? 'border-rose-500/50 bg-rose-950/20 imposter-glow'
              : 'border-cyan-500/50 bg-cyan-950/20 civilian-glow'
          }`}
        >
          <div className="flex items-center justify-between gap-4 flex-wrap">
            <div className="flex items-center gap-3.5">
              <div
                className={`p-3 rounded-2xl ${
                  isImposter ? 'bg-rose-500/20 text-rose-400' : 'bg-cyan-500/20 text-cyan-400'
                }`}
              >
                <Shield className="w-6 h-6" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-xs font-bold uppercase tracking-wider text-slate-400">Your Secret Role</span>
                  <span className={isImposter ? 'badge-imposter' : 'badge-civilian'}>
                    {me.role || 'SPECTATOR'}
                  </span>
                  {!isAlive && (
                    <span className="text-[10px] font-bold uppercase px-2 py-0.5 rounded bg-slate-800 text-slate-400">
                      Spectating
                    </span>
                  )}
                </div>

                <div className="flex items-center gap-2 mt-1">
                  {isImposter ? (
                    <div>
                      <span className="text-xs text-rose-300 font-semibold block">Your Persistent Hint:</span>
                      <span className="text-lg font-black text-rose-200">{roomState.myHint}</span>
                    </div>
                  ) : isCivilian ? (
                    <div>
                      <span className="text-xs text-cyan-300 font-semibold block">Your Secret Word:</span>
                      <span className="text-2xl font-black text-cyan-200 tracking-wide font-display">
                        {revealedSecret ? roomState.myWord : '••••••••'}
                      </span>
                    </div>
                  ) : (
                    <span className="text-sm font-semibold text-slate-400">Spectator Mode (You were eliminated)</span>
                  )}
                </div>
              </div>
            </div>

            {/* Toggle Visibility button for Civilian secret word */}
            {isCivilian && (
              <button
                onClick={() => setRevealedSecret(prev => !prev)}
                className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-dark-900 border border-slate-700 text-xs font-semibold text-slate-300 hover:text-white"
              >
                {revealedSecret ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                <span>{revealedSecret ? 'Hide Word' : 'Reveal Word'}</span>
              </button>
            )}
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
          <h2 className="font-display font-black text-3xl text-white mb-2">Secret Roles Distributed</h2>
          <p className="text-sm text-slate-400 max-w-md mx-auto mb-6">
            Memorize your word or hint above! Clue rounds will begin in a moment.
          </p>
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-dark-950 border border-slate-800 text-sm font-bold text-slate-300">
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
            {/* Active Player Status Card */}
            <div
              className={`glass-card p-6 border ${
                isMyTurn
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
                    <h3 className="font-display font-bold text-lg text-white">
                      {isMyTurn ? '🌟 It is YOUR turn to submit a clue!' : `Waiting for ${roomState.players.find(p => p.id === roomState.activeTurnPlayerId)?.username || 'active player'}...`}
                    </h3>
                    <p className="text-xs text-slate-400">
                      {isImposter
                        ? 'Enter a plausible clue or type the exact secret word to win instantly!'
                        : 'Enter a single word related to your secret word without giving it away.'}
                    </p>
                  </div>
                </div>
              </div>

              {/* Clue Input Form */}
              {isMyTurn && isAlive && (
                <form onSubmit={handleClueSubmit} className="space-y-3">
                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={clueInput}
                      onChange={(e) => setClueInput(e.target.value)}
                      placeholder={isImposter ? 'Enter clue OR exact secret word guess...' : 'Enter your related clue...'}
                      autoFocus
                      maxLength={40}
                      className="flex-1 bg-dark-950 border border-slate-700 focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500 px-4 py-3 rounded-xl text-white placeholder-slate-500 text-sm font-semibold outline-none"
                    />
                    <button type="submit" className="btn-cyan flex items-center gap-2 px-6">
                      <Send className="w-4 h-4" />
                      <span>Submit</span>
                    </button>
                  </div>
                  {isImposter && (
                    <div className="text-[11px] text-rose-400 font-semibold bg-rose-500/10 p-2.5 rounded-xl border border-rose-500/20">
                      💡 <strong>Imposter Tip:</strong> If you deduce the secret word, typing the exact word here wins the match for Imposters immediately!
                    </div>
                  )}
                </form>
              )}
            </div>

            {/* Clue History Log with Skipped Turn Display */}
            <div className="glass-card p-6">
              <h4 className="font-display font-bold text-base text-white mb-4 flex items-center gap-2">
                <span>Submitted Clues</span>
                <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-slate-800 text-slate-400">
                  {roomState.clueHistory?.length || 0}
                </span>
              </h4>

              {roomState.clueHistory?.length === 0 ? (
                <div className="py-8 text-center text-slate-500 text-sm">
                  No clues submitted yet this round.
                </div>
              ) : (
                <div className="space-y-2.5 max-h-[350px] overflow-y-auto pr-1">
                  {roomState.clueHistory?.map((c, idx) => (
                    <div
                      key={idx}
                      className={`flex items-center justify-between p-3 rounded-xl border ${
                        c.skipped
                          ? 'bg-amber-950/20 border-amber-500/30'
                          : 'bg-dark-950 border-slate-800/80'
                      }`}
                    >
                      <div className="flex items-center gap-2.5">
                        <span className="text-xs font-bold text-cyan-400">{c.username}:</span>
                        {c.skipped ? (
                          <span className="text-xs font-semibold text-amber-400 italic">
                            {c.username} skipped the turn — no clue submitted.
                          </span>
                        ) : (
                          <span className="text-sm font-black text-slate-100 font-display">"{c.clue}"</span>
                        )}
                      </div>
                      <span className="text-[10px] text-slate-500 uppercase font-semibold">
                        Round {c.round}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Right: Players Turn Order Status */}
          <div className="glass-card p-6">
            <h4 className="font-display font-bold text-base text-white mb-4">Turn Order</h4>
            <div className="space-y-2.5">
              {roomState.players.map((p) => {
                const isActive = roomState.activeTurnPlayerId === p.id;
                const isEliminated = !p.isAlive || p.permanentlyDeparted;
                return (
                  <div
                    key={p.id}
                    className={`flex items-center justify-between p-2.5 rounded-xl border transition-all ${
                      isActive
                        ? 'bg-cyan-950/40 border-cyan-500 text-white font-bold ring-1 ring-cyan-500'
                        : isEliminated
                        ? 'bg-dark-950/40 border-slate-900 opacity-40'
                        : 'bg-dark-800/60 border-slate-800 text-slate-300'
                    }`}
                  >
                    <div className="flex items-center gap-2.5">
                      <PlayerAvatar player={p} size="sm" showStatus={false} />
                      <span className="text-sm">{p.username}</span>
                    </div>
                    <div>
                      {p.permanentlyDeparted ? (
                        <span className="text-[10px] font-bold uppercase text-slate-600">Left Match</span>
                      ) : !p.isAlive ? (
                        <span className="text-[10px] font-bold uppercase text-slate-500">Eliminated</span>
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
                  className={`p-4 rounded-2xl border text-left transition-all ${
                    isSelected
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
              className="btn-secondary px-6 py-3 flex items-center gap-2 text-sm"
            >
              <HomeIcon className="w-4 h-4" />
              <span>Back to Home</span>
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
