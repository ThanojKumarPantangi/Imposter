import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Smartphone, Eye, EyeOff, ArrowRight, RotateCcw, Trophy, Users, Shield, Plus, Trash2 } from 'lucide-react';
import { sounds } from '../utils/sound';

const DEFAULT_CATEGORIES = [
  { name: 'Fruits', words: [{ word: 'Apple', hint: 'Crisp fruit, often red or green' }, { word: 'Banana', hint: 'Yellow peel with curved fruit' }, { word: 'Mango', hint: 'Sweet tropical fruit with a flat stone' }] },
  { name: 'Vegetables', words: [{ word: 'Carrot', hint: 'Orange root crunchy in salads' }, { word: 'Potato', hint: 'Starchy tuber, great for fries' }] },
  { name: 'Snacks', words: [{ word: 'Pizza', hint: 'Baked crust topped with cheese and tomato sauce' }, { word: 'Taco', hint: 'Folded tortilla packed with seasoned fillings' }] }
];

export function PassAndPlay() {
  const navigate = useNavigate();
  const [phase, setPhase] = useState('SETUP'); // SETUP | PASS | REVEAL | CLUES | VOTING | WINNER
  const [playerNames, setPlayerNames] = useState(['Alice', 'Bob', 'Charlie', 'David']);
  const [newPlayerName, setNewPlayerName] = useState('');
  const [impostersCount, setImpostersCount] = useState(1);
  const [currentRevealIndex, setCurrentRevealIndex] = useState(0);

  const [gameState, setGameState] = useState({
    secretWord: '',
    hint: '',
    players: [],
    clues: [],
    winner: null
  });

  const handleAddPlayer = (e) => {
    e.preventDefault();
    if (!newPlayerName.trim()) return;
    setPlayerNames([...playerNames, newPlayerName.trim()]);
    setNewPlayerName('');
  };

  const handleRemovePlayer = (idx) => {
    setPlayerNames(playerNames.filter((_, i) => i !== idx));
  };

  const startPassAndPlayGame = () => {
    if (playerNames.length < 3) return;
    sounds.playClick();

    // Pick random category and word
    const cat = DEFAULT_CATEGORIES[Math.floor(Math.random() * DEFAULT_CATEGORIES.length)];
    const wordItem = cat.words[Math.floor(Math.random() * cat.words.length)];

    // Assign Imposters
    const shuffled = [...playerNames].sort(() => Math.random() - 0.5);
    const imposterNames = new Set(shuffled.slice(0, impostersCount));

    const players = playerNames.map((name, i) => ({
      id: i,
      name,
      role: imposterNames.has(name) ? 'IMPOSTER' : 'CIVILIAN',
      isAlive: true
    }));

    setGameState({
      secretWord: wordItem.word,
      hint: wordItem.hint,
      players,
      clues: [],
      winner: null
    });

    setCurrentRevealIndex(0);
    setPhase('PASS');
  };

  const currentPlayer = gameState.players[currentRevealIndex];

  return (
    <div className="max-w-xl mx-auto px-4 py-8">
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <button
          onClick={() => navigate('/')}
          className="text-xs font-bold text-slate-400 hover:text-white px-3 py-1.5 rounded-lg bg-dark-900 border border-slate-800"
        >
          ← Back to Home
        </button>
        <span className="badge-civilian">Local Party Mode</span>
      </div>

      {/* SETUP PHASE */}
      {phase === 'SETUP' && (
        <div className="glass-card p-6 sm:p-8">
          <div className="flex items-center gap-3 mb-6">
            <div className="p-3 rounded-2xl bg-purple-500/20 text-purple-400">
              <Smartphone className="w-6 h-6" />
            </div>
            <div>
              <h1 className="font-display font-black text-2xl text-white">Pass & Play</h1>
              <p className="text-xs text-slate-400">Pass this single device between friends</p>
            </div>
          </div>

          <div className="space-y-4 mb-6">
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-400 mb-2">
                Players ({playerNames.length})
              </label>
              <div className="space-y-2 mb-3">
                {playerNames.map((name, idx) => (
                  <div key={idx} className="flex items-center justify-between p-2.5 rounded-xl bg-dark-950 border border-slate-800 text-sm font-semibold text-slate-200">
                    <span>{name}</span>
                    {playerNames.length > 3 && (
                      <button onClick={() => handleRemovePlayer(idx)} className="text-slate-500 hover:text-rose-400 p-1">
                        <Trash2 className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                ))}
              </div>

              <form onSubmit={handleAddPlayer} className="flex gap-2">
                <input
                  type="text"
                  value={newPlayerName}
                  onChange={(e) => setNewPlayerName(e.target.value)}
                  placeholder="Add friend's name..."
                  className="flex-1 bg-dark-950 border border-slate-700 focus:border-purple-500 px-3.5 py-2.5 rounded-xl text-sm text-white placeholder-slate-500 outline-none"
                />
                <button type="submit" className="btn-secondary px-4 py-2.5 text-sm flex items-center gap-1">
                  <Plus className="w-4 h-4" />
                  <span>Add</span>
                </button>
              </form>
            </div>

            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-400 mb-2">
                Number of Imposters
              </label>
              <div className="grid grid-cols-2 gap-2">
                {[1, 2].map(n => (
                  <button
                    key={n}
                    type="button"
                    onClick={() => setImpostersCount(n)}
                    className={`py-2 rounded-xl text-xs font-bold border transition-all ${
                      impostersCount === n
                        ? 'bg-rose-500/20 border-rose-500 text-rose-300'
                        : 'bg-dark-950 border-slate-800 text-slate-400'
                    }`}
                  >
                    {n} Imposter{n > 1 ? 's' : ''}
                  </button>
                ))}
              </div>
            </div>
          </div>

          <button
            onClick={startPassAndPlayGame}
            disabled={playerNames.length < 3}
            className="w-full btn-primary py-3.5 flex items-center justify-center gap-2"
          >
            <span>Start Pass & Play</span>
            <ArrowRight className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* PASS DEVICE SCREEN */}
      {phase === 'PASS' && currentPlayer && (
        <div className="glass-card p-8 sm:p-12 text-center animate-fade-in">
          <div className="w-16 h-16 rounded-3xl bg-purple-500/20 text-purple-400 flex items-center justify-center mx-auto mb-4 border border-purple-500/30">
            <Smartphone className="w-8 h-8" />
          </div>
          <h2 className="font-display font-black text-2xl text-white mb-2">
            Pass Device To:
          </h2>
          <div className="font-display font-extrabold text-4xl text-purple-400 mb-6">
            {currentPlayer.name}
          </div>
          <p className="text-xs text-slate-400 mb-8 max-w-xs mx-auto">
            Ensure no other player can view the screen before tapping to reveal!
          </p>

          <button
            onClick={() => setPhase('REVEAL')}
            className="w-full btn-primary py-3.5 flex items-center justify-center gap-2"
          >
            <Eye className="w-4 h-4" />
            <span>I Am {currentPlayer.name} (Reveal Role)</span>
          </button>
        </div>
      )}

      {/* REVEAL ROLE PRIVATELY */}
      {phase === 'REVEAL' && currentPlayer && (
        <div className="glass-card p-8 sm:p-12 text-center animate-fade-in">
          <div className="mb-6">
            <span className="text-xs uppercase font-bold text-slate-400 block mb-1">
              Secret Role for {currentPlayer.name}
            </span>
            <span className={currentPlayer.role === 'IMPOSTER' ? 'badge-imposter text-sm px-4 py-1.5' : 'badge-civilian text-sm px-4 py-1.5'}>
              {currentPlayer.role}
            </span>
          </div>

          <div className="p-6 rounded-2xl bg-dark-950 border border-slate-800 mb-8">
            {currentPlayer.role === 'IMPOSTER' ? (
              <div>
                <span className="text-xs text-rose-300 font-semibold block mb-1">Your Persistent Hint:</span>
                <span className="font-display font-black text-2xl text-rose-400">{gameState.hint}</span>
              </div>
            ) : (
              <div>
                <span className="text-xs text-cyan-300 font-semibold block mb-1">Your Secret Word:</span>
                <span className="font-display font-black text-3xl text-cyan-400">{gameState.secretWord}</span>
              </div>
            )}
          </div>

          <button
            onClick={() => {
              if (currentRevealIndex + 1 < gameState.players.length) {
                setCurrentRevealIndex(currentRevealIndex + 1);
                setPhase('PASS');
              } else {
                setPhase('PLAY');
              }
            }}
            className="w-full btn-cyan py-3.5 flex items-center justify-center gap-2"
          >
            <EyeOff className="w-4 h-4" />
            <span>
              {currentRevealIndex + 1 < gameState.players.length
                ? 'Hide & Pass to Next Player'
                : 'All Roles Revealed — Start Game!'}
            </span>
          </button>
        </div>
      )}

      {/* IN-GAME ROUND OVERVIEW */}
      {phase === 'PLAY' && (
        <div className="glass-card p-6 sm:p-8 text-center animate-fade-in">
          <h2 className="font-display font-black text-2xl text-white mb-2">Clue & Discussion Round</h2>
          <p className="text-xs text-slate-400 mb-6">
            Go around the room in circle! Each player enters or speaks aloud a word related to their secret.
          </p>

          <div className="space-y-2 mb-8">
            {gameState.players.map((p, idx) => (
              <div key={idx} className="flex items-center justify-between p-3 rounded-xl bg-dark-950 border border-slate-800 text-sm font-semibold text-slate-200">
                <span>{idx + 1}. {p.name}</span>
                <span className="text-xs text-slate-500">Living Participant</span>
              </div>
            ))}
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={() => setPhase('SETUP')}
              className="flex-1 btn-secondary py-3 text-sm"
            >
              Restart Mode
            </button>
            <button
              onClick={() => alert(`Secret Word was: ${gameState.secretWord}\nImposters were: ${gameState.players.filter(p => p.role === 'IMPOSTER').map(p => p.name).join(', ')}`)}
              className="flex-1 btn-primary py-3 text-sm"
            >
              Reveal & Finish
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
