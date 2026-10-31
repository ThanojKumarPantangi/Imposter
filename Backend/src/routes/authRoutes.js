import express from 'express';
import { registerOrRestore, updateUsername, getProfile, adminLogin } from '../controllers/authController.js';

const router = express.Router();

router.post('/device-session', registerOrRestore);
router.post('/update-username', updateUsername);
router.get('/profile', getProfile);
router.post('/admin/login', adminLogin);

export default router;
