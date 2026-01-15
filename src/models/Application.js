const mongoose = require('mongoose');
const crypto = require('crypto');

const ApplicationSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    trim: true
  },
  description: {
    type: String,
    trim: true
  },
  clientId: {
    type: String,
    required: true,
    unique: true,
    default: () => crypto.randomBytes(16).toString('hex')
  },
  clientSecret: {
    type: String,
    required: true,
    select: false,
    default: () => crypto.randomBytes(32).toString('hex')
  },
  redirectUris: [{
    type: String,
    required: true
  }],
  owner: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  permissions: [{
    type: String,
    enum: ['read_profile', 'write_profile', 'read_credit', 'use_credit', 'transfer_credit']
  }],
  isActive: {
    type: Boolean,
    default: true
  },
  webhookUrl: String,
  rateLimit: {
    type: Number,
    default: 1000
  },
  metadata: mongoose.Schema.Types.Mixed,
  createdAt: {
    type: Date,
    default: Date.now
  },
  updatedAt: {
    type: Date,
    default: Date.now
  }
}, {
  timestamps: true
});

// Méthode pour valider l'URI de redirection
ApplicationSchema.methods.validateRedirectUri = function(uri) {
  return this.redirectUris.includes(uri);
};

// Méthode pour générer un nouveau secret client
ApplicationSchema.methods.regenerateSecret = function() {
  this.clientSecret = crypto.randomBytes(32).toString('hex');
  return this.save();
};

module.exports = mongoose.model('Application', ApplicationSchema);
