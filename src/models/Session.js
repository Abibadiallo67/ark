const mongoose = require('mongoose');

const SessionSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  applicationId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Application'
  },
  accessToken: {
    type: String,
    required: true,
    unique: true
  },
  refreshToken: {
    type: String,
    required: true,
    unique: true
  },
  ipAddress: String,
  userAgent: String,
  deviceInfo: mongoose.Schema.Types.Mixed,
  expiresAt: {
    type: Date,
    required: true,
    index: { expireAfterSeconds: 0 }
  },
  isRevoked: {
    type: Boolean,
    default: false
  },
  revokedAt: Date,
  lastActivity: {
    type: Date,
    default: Date.now
  },
  metadata: mongoose.Schema.Types.Mixed,
  createdAt: {
    type: Date,
    default: Date.now
  }
});

// Indexes
SessionSchema.index({ userId: 1 });
SessionSchema.index({ accessToken: 1 });
SessionSchema.index({ refreshToken: 1 });
SessionSchema.index({ createdAt: 1 });
SessionSchema.index({ expiresAt: 1 });

module.exports = mongoose.model('Session', SessionSchema);
