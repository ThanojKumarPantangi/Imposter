import mongoose from 'mongoose';

const GuestSchema = new mongoose.Schema({
  deviceId: {
    type: String,
    required: true,
    unique: true,
    index: true,
    trim: true
  },
  username: {
    type: String,
    required: true,
    trim: true,
    minlength: 2,
    maxlength: 25
  },
  avatar: {
    type: String,
    default: 'avatar-1'
  },
  stats: {
    gamesPlayed: { type: Number, default: 0 },
    wins: { type: Number, default: 0 },
    civilianWins: { type: Number, default: 0 },
    imposterWins: { type: Number, default: 0 },
    cluesGiven: { type: Number, default: 0 },
    correctVotes: { type: Number, default: 0 }
  },
  lastActiveAt: {
    type: Date,
    default: Date.now
  }
}, {
  timestamps: true
});

const Guest = mongoose.model('Guest', GuestSchema);
export default Guest;
