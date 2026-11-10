import express from 'express';
import { getPublicAppConfig } from '../controllers/appConfigController.js';

const router = express.Router();

// GET /api/v1/app/config?versionCode=4
router.get('/config', getPublicAppConfig);

export default router;

