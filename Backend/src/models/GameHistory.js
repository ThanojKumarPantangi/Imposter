import mongoose from 'mongoose';

const PlayerGameRecordSchema = new mongoose.Schema({
  playerId: { type: String, required: true },
  username: { type: String, required: true },
  role: { type: String, enum: ['CIVILIAN', 'IMPOSTER'], required: true },
  isWinner: { type: Boolean, default: false },
  isAlive: { type: Boolean, default: true },
  eliminatedAtRound: { type: Number, default: null },
  clues: [{ type: String }],
  votesReceived: { type: Number, default: 0 }
}, { _id: false });

const GameHistorySchema = new mongoose.Schema({
  roomCode: { type: String, required: true, index: true },
  hostId: { type: String, required: true },
  categoryName: { type: String, required: true },
  secretWord: { type: String, required: true },
  hint: { type: String, required: true },
  winnerRole: { type: String, enum: ['CIVILIAN', 'IMPOSTER'], required: true },
  winCondition: {
    type: String,
    enum: [
      'ALL_IMPOSTERS_ELIMINATED',
      'IMPOSTER_GUESSED_WORD',
      'FINAL_SHOWDOWN_DECISIVE',
      'IMPOSTERS_PARITY',
      'PERMANENT_DEPARTURE'
    ],
    required: true
  },
  impostersCount: { type: Number, default: 1 },
  roundsCount: { type: Number, default: 1 },
  players: [PlayerGameRecordSchema],
  startedAt: { type: Date, default: Date.now },
  endedAt: { type: Date, default: Date.now }
}, {
  timestamps: true
});

const GameHistory = mongoose.model('GameHistory', GameHistorySchema);
export default GameHistory;
