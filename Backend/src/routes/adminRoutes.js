import express from 'express';
import {
  getStatsSummary,
  getCategories,
  getCategoryById,
  createCategory,
  updateCategory,
  deleteCategory,
  addWord,
  deleteWord,
  getGameHistory,
  getAuditLogs,
  triggerSeed
} from '../controllers/adminController.js';
import { requireAdmin } from '../middlewares/authMiddleware.js';

const router = express.Router();

router.use(requireAdmin);

router.get('/stats', getStatsSummary);
router.get('/categories', getCategories);
router.get('/categories/:id', getCategoryById);
router.post('/categories', createCategory);
router.put('/categories/:id', updateCategory);
router.delete('/categories/:id', deleteCategory);

router.post('/categories/:id/words', addWord);
router.delete('/categories/:id/words/:wordText', deleteWord);

router.get('/history', getGameHistory);
router.get('/audit-logs', getAuditLogs);
router.post('/seed', triggerSeed);

export default router;
