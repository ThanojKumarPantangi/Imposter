import mongoose from 'mongoose';

const AuditLogSchema = new mongoose.Schema({
  action: { type: String, required: true },
  adminEmail: { type: String, required: true },
  target: { type: String, default: null },
  details: { type: mongoose.Schema.Types.Mixed, default: {} },
  ip: { type: String, default: null },
  timestamp: { type: Date, default: Date.now }
});

const AuditLog = mongoose.model('AuditLog', AuditLogSchema);
export default AuditLog;
