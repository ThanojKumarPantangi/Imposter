import Category from '../models/Category.js';
import GameHistory from '../models/GameHistory.js';
import Guest from '../models/Guest.js';
import AuditLog from '../models/AuditLog.js';
import seed from '../scripts/seedCategories.js';

export const getCategories = async (req, res) => {
  try {
    const categories = await Category.find().sort({ displayOrder: 1, name: 1 });
    return res.json({ success: true, categories });
  } catch (error) {
    return res.status(500).json({ success: false, error: error.message });
  }
};

export const getCategoryById = async (req, res) => {
  try {
    const { id } = req.params;
    const category = await Category.findOne({ $or: [{ id }, { slug: id }] });
    if (!category) return res.status(404).json({ success: false, error: 'Category not found' });
    return res.json({ success: true, category });
  } catch (error) {
    return res.status(500).json({ success: false, error: error.message });
  }
};

export const createCategory = async (req, res) => {
  try {
    const data = req.body;
    if (!data.name || !data.slug) {
      return res.status(400).json({ success: false, error: 'Name and slug are required' });
    }
    data.id = data.id || `cat_${data.slug.replace(/[^a-zA-Z0-9_]/g, '_').toLowerCase()}`;
    const category = await Category.create(data);

    await AuditLog.create({
      action: 'CREATE_CATEGORY',
      adminEmail: req.user.email,
      target: category.name,
      details: { id: category.id }
    });

    return res.status(201).json({ success: true, category });
  } catch (error) {
    return res.status(400).json({ success: false, error: error.message });
  }
};

export const updateCategory = async (req, res) => {
  try {
    const { id } = req.params;
    const updates = req.body;
    const category = await Category.findOneAndUpdate(
      { $or: [{ id }, { slug: id }] },
      updates,
      { new: true }
    );
    if (!category) return res.status(404).json({ success: false, error: 'Category not found' });

    await AuditLog.create({
      action: 'UPDATE_CATEGORY',
      adminEmail: req.user.email,
      target: category.name,
      details: updates
    });

    return res.json({ success: true, category });
  } catch (error) {
    return res.status(400).json({ success: false, error: error.message });
  }
};

export const deleteCategory = async (req, res) => {
  try {
    const { id } = req.params;
    const category = await Category.findOneAndDelete({ $or: [{ id }, { slug: id }] });
    if (!category) return res.status(404).json({ success: false, error: 'Category not found' });

    await AuditLog.create({
      action: 'DELETE_CATEGORY',
      adminEmail: req.user.email,
      target: category.name,
      details: { id: category.id }
    });

    return res.json({ success: true, message: 'Category deleted successfully' });
  } catch (error) {
    return res.status(500).json({ success: false, error: error.message });
  }
};

export const addWord = async (req, res) => {
  try {
    const { id } = req.params;
    const { word, hint, difficulty } = req.body;
    if (!word || !hint) {
      return res.status(400).json({ success: false, error: 'Word and hint are required' });
    }

    const category = await Category.findOne({ $or: [{ id }, { slug: id }] });
    if (!category) return res.status(404).json({ success: false, error: 'Category not found' });

    category.words.push({
      word: word.trim(),
      normalizedWord: word.trim().toLowerCase(),
      hint: hint.trim(),
      difficulty: difficulty || 'EASY',
      enabled: true
    });
    await category.save();

    return res.json({ success: true, category });
  } catch (error) {
    return res.status(400).json({ success: false, error: error.message });
  }
};

export const deleteWord = async (req, res) => {
  try {
    const { id, wordText } = req.params;
    const category = await Category.findOne({ $or: [{ id }, { slug: id }] });
    if (!category) return res.status(404).json({ success: false, error: 'Category not found' });

    category.words = category.words.filter(w => w.word.toLowerCase() !== decodeURIComponent(wordText).toLowerCase());
    await category.save();

    return res.json({ success: true, category });
  } catch (error) {
    return res.status(500).json({ success: false, error: error.message });
  }
};

export const getGameHistory = async (req, res) => {
  try {
    const page = parseInt(req.query.page, 10) || 1;
    const limit = parseInt(req.query.limit, 10) || 20;
    const history = await GameHistory.find()
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit);

    const total = await GameHistory.countDocuments();
    return res.json({ success: true, history, total, page, pages: Math.ceil(total / limit) });
  } catch (error) {
    return res.status(500).json({ success: false, error: error.message });
  }
};

export const getAuditLogs = async (req, res) => {
  try {
    const logs = await AuditLog.find().sort({ timestamp: -1 }).limit(100);
    return res.json({ success: true, logs });
  } catch (error) {
    return res.status(500).json({ success: false, error: error.message });
  }
};

export const getStatsSummary = async (req, res) => {
  try {
    const totalPlayers = await Guest.countDocuments();
    const totalGames = await GameHistory.countDocuments();
    const totalCategories = await Category.countDocuments();
    
    const civilianWins = await GameHistory.countDocuments({ winnerRole: 'CIVILIAN' });
    const imposterWins = await GameHistory.countDocuments({ winnerRole: 'IMPOSTER' });

    return res.json({
      success: true,
      stats: {
        totalPlayers,
        totalGames,
        totalCategories,
        civilianWins,
        imposterWins
      }
    });
  } catch (error) {
    return res.status(500).json({ success: false, error: error.message });
  }
};

export const triggerSeed = async (req, res) => {
  try {
    await seed();
    return res.json({ success: true, message: 'Seed triggered and completed successfully' });
  } catch (error) {
    return res.status(500).json({ success: false, error: error.message });
  }
};

export default {
  getCategories,
  getCategoryById,
  createCategory,
  updateCategory,
  deleteCategory,
  addWord,
  deleteWord,
  getGameHistory,
  getAuditLogs,
  getStatsSummary,
  triggerSeed
};
