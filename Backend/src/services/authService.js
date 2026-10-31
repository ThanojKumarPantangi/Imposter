import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import { v4 as uuidv4 } from 'uuid';
import Guest from '../models/Guest.js';
import AdminUser from '../models/AdminUser.js';
import AuditLog from '../models/AuditLog.js';

const JWT_SECRET = process.env.JWT_SECRET || 'imposter_default_secret_jwt';
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || '7d';

class AuthService {
  /**
   * Device-based registration and session restoration
   */
  async registerOrRestoreDevice(deviceId, customUsername, avatar) {
    if (!deviceId) {
      deviceId = uuidv4();
    }

    let guest = await Guest.findOne({ deviceId });

    if (!guest) {
      const defaultName = customUsername && customUsername.trim().length >= 2 
        ? customUsername.trim() 
        : `Player_${Math.floor(1000 + Math.random() * 9000)}`;

      guest = await Guest.create({
        deviceId,
        username: defaultName,
        avatar: avatar || `avatar-${Math.floor(1 + Math.random() * 8)}`
      });
      console.log(`👤 [Auth] Created new guest player: ${guest.username} (${guest.deviceId})`);
    } else {
      guest.lastActiveAt = new Date();
      if (customUsername && customUsername.trim().length >= 2 && customUsername !== guest.username) {
        guest.username = customUsername.trim();
      }
      if (avatar && avatar !== guest.avatar) {
        guest.avatar = avatar;
      }
      await guest.save();
      console.log(`🔄 [Auth] Restored session for player: ${guest.username} (${guest.deviceId})`);
    }

    const token = this.generateToken({
      id: guest._id.toString(),
      deviceId: guest.deviceId,
      username: guest.username,
      role: 'GUEST'
    });

    return {
      token,
      player: {
        id: guest._id.toString(),
        deviceId: guest.deviceId,
        username: guest.username,
        avatar: guest.avatar,
        stats: guest.stats
      }
    };
  }

  /**
   * Update guest username
   */
  async updateUsername(deviceId, newUsername) {
    if (!deviceId || !newUsername || newUsername.trim().length < 2) {
      throw new Error('Valid username with at least 2 characters is required');
    }

    const guest = await Guest.findOne({ deviceId });
    if (!guest) {
      throw new Error('Player profile not found for this device');
    }

    guest.username = newUsername.trim().slice(0, 25);
    await guest.save();

    const token = this.generateToken({
      id: guest._id.toString(),
      deviceId: guest.deviceId,
      username: guest.username,
      role: 'GUEST'
    });

    return {
      token,
      player: {
        id: guest._id.toString(),
        deviceId: guest.deviceId,
        username: guest.username,
        avatar: guest.avatar,
        stats: guest.stats
      }
    };
  }

  /**
   * Admin Login
   */
  async loginAdmin(email, password, ip = null) {
    if (!email || !password) {
      throw new Error('Email and password are required');
    }

    const admin = await AdminUser.findOne({ email: email.toLowerCase().trim() });
    if (!admin) {
      throw new Error('Invalid administrative credentials');
    }

    const isMatch = await bcrypt.compare(password, admin.passwordHash);
    if (!isMatch) {
      throw new Error('Invalid administrative credentials');
    }

    admin.lastLoginAt = new Date();
    await admin.save();

    await AuditLog.create({
      action: 'ADMIN_LOGIN',
      adminEmail: admin.email,
      ip,
      details: { timestamp: new Date() }
    });

    const token = this.generateToken({
      id: admin._id.toString(),
      email: admin.email,
      role: admin.role
    });

    return {
      token,
      admin: {
        id: admin._id.toString(),
        email: admin.email,
        role: admin.role
      }
    };
  }

  generateToken(payload) {
    return jwt.sign(payload, JWT_SECRET, { expiresIn: JWT_EXPIRES_IN });
  }

  verifyToken(token) {
    return jwt.verify(token, JWT_SECRET);
  }
}

const authService = new AuthService();
export default authService;
