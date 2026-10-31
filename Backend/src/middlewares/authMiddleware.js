import jwt from 'jsonwebtoken';

const JWT_SECRET = process.env.JWT_SECRET || 'imposter_default_secret_jwt';

export const requireAuth = (req, res, next) => {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ success: false, error: 'Authorization token required' });
  }

  const token = authHeader.split(' ')[1];
  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    req.user = decoded;
    next();
  } catch (err) {
    return res.status(401).json({ success: false, error: 'Invalid or expired token' });
  }
};

export const requireAdmin = (req, res, next) => {
  requireAuth(req, res, () => {
    if (!req.user || (req.user.role !== 'ADMIN' && req.user.role !== 'SUPER_ADMIN')) {
      return res.status(403).json({ success: false, error: 'Administrative privileges required' });
    }
    next();
  });
};

export default {
  requireAuth,
  requireAdmin
};
