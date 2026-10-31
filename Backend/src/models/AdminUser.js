import mongoose from 'mongoose';

const AdminUserSchema = new mongoose.Schema({
  email: {
    type: String,
    required: true,
    unique: true,
    lowercase: true,
    trim: true
  },
  passwordHash: {
    type: String,
    required: true
  },
  role: {
    type: String,
    enum: ['SUPER_ADMIN', 'ADMIN'],
    default: 'ADMIN'
  },
  lastLoginAt: {
    type: Date,
    default: null
  }
}, {
  timestamps: true
});

const AdminUser = mongoose.model('AdminUser', AdminUserSchema);
export default AdminUser;
