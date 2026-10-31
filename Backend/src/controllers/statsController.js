import Guest from '../models/Guest.js';
import GameHistory from '../models/GameHistory.js';

export const getPlayerStats = async (req, res) => {
  try {
    const { playerId } = req.params;
    const guest = await Guest.findById(playerId);
    if (!guest) {
      return res.status(404).json({ success: false, error: 'Player not found' });
    }

    const recentMatches = await GameHistory.find({ 'players.playerId': playerId })
      .sort({ createdAt: -1 })
      .limit(10)
      .lean();

    return res.json({
      success: true,
      player: {
        id: guest._id.toString(),
        username: guest.username,
        avatar: guest.avatar,
        stats: guest.stats
      },
      recentMatches
    });
  } catch (error) {
    return res.status(500).json({ success: false, error: error.message });
  }
};

export const getLeaderboard = async (req, res) => {
  try {
    const topPlayers = await Guest.find({ 'stats.gamesPlayed': { $gt: 0 } })
      .sort({ 'stats.wins': -1, 'stats.gamesPlayed': -1 })
      .limit(20)
      .select('username avatar stats')
      .lean();

    return res.json({ success: true, leaderboard: topPlayers });
  } catch (error) {
    return res.status(500).json({ success: false, error: error.message });
  }
};

export default {
  getPlayerStats,
  getLeaderboard
};
