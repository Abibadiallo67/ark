const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const ContactSchema = new mongoose.Schema({
  type: {
    type: String,
    enum: ['whatsapp', 'telegram', 'phone', 'email', 'other'],
    required: true
  },
  value: {
    type: String,
    required: true
  },
  verified: {
    type: Boolean,
    default: false
  },
  isPrimary: {
    type: Boolean,
    default: false
  }
});

const UserSchema = new mongoose.Schema({
  // Identifiants
  username: {
    type: String,
    required: true,
    unique: true,
    trim: true,
    minlength: 3,
    maxlength: 30,
    index: true
  },
  email: {
    type: String,
    unique: true,
    sparse: true,
    trim: true,
    lowercase: true,
    match: [/^\w+([.-]?\w+)*@\w+([.-]?\w+)*(\.\w{2,3})+$/, 'Invalid email']
  },
  password: {
    type: String,
    required: true,
    minlength: 8,
    select: false
  },
  
  // Informations personnelles
  firstName: {
    type: String,
    trim: true
  },
  lastName: {
    type: String,
    trim: true
  },
  country: {
    type: String,
    trim: true,
    index: true
  },
  city: {
    type: String,
    trim: true
  },
  
  // Système de crédits
  credit: {
    type: Number,
    default: 0,
    min: 0
  },
  creditHistory: [{
    amount: Number,
    type: {
      type: String,
      enum: ['deposit', 'withdrawal', 'transfer_sent', 'transfer_received', 'purchase', 'commission']
    },
    description: String,
    referenceId: String,
    timestamp: {
      type: Date,
      default: Date.now
    },
    metadata: mongoose.Schema.Types.Mixed
  }],
  
  // Contacts
  contacts: [ContactSchema],
  
  // Type d'utilisateur
  userType: {
    type: String,
    enum: ['user', 'affiliate', 'partner', 'team', 'admin'],
    default: 'user',
    index: true
  },
  
  // Réseau d'affiliation
  affiliateCode: {
    type: String,
    unique: true,
    sparse: true
  },
  referredBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  referrals: [{
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    },
    joinedAt: Date,
    commissionEarned: Number
  }],
  commissionRate: {
    type: Number,
    default: 10, // 10% par défaut
    min: 0,
    max: 100
  },
  
  // Sécurité
  isVerified: {
    type: Boolean,
    default: false
  },
  isActive: {
    type: Boolean,
    default: true
  },
  twoFactorEnabled: {
    type: Boolean,
    default: false
  },
  twoFactorSecret: {
    type: String,
    select: false
  },
  
  // Métadonnées
  lastLogin: Date,
  loginCount: {
    type: Number,
    default: 0
  },
  metadata: mongoose.Schema.Types.Mixed,
  
  // Timestamps
  createdAt: {
    type: Date,
    default: Date.now
  },
  updatedAt: {
    type: Date,
    default: Date.now
  }
}, {
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

// Virtual pour le nom complet
UserSchema.virtual('fullName').get(function() {
  return `${this.firstName || ''} ${this.lastName || ''}`.trim();
});

// Virtual pour le solde formaté
UserSchema.virtual('formattedCredit').get(function() {
  return `$${this.credit.toFixed(2)}`;
});

// Hash password avant sauvegarde
UserSchema.pre('save', async function(next) {
  if (!this.isModified('password')) return next();
  
  try {
    const salt = await bcrypt.genSalt(12);
    this.password = await bcrypt.hash(this.password, salt);
    next();
  } catch (error) {
    next(error);
  }
});

// Méthode pour comparer les mots de passe
UserSchema.methods.comparePassword = async function(candidatePassword) {
  return await bcrypt.compare(candidatePassword, this.password);
};

// Méthode pour générer un code d'affiliation
UserSchema.methods.generateAffiliateCode = function() {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  let code = '';
  for (let i = 0; i < 8; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  this.affiliateCode = `${this.username.substring(0, 3).toUpperCase()}${code}`;
  return this.affiliateCode;
};

// Méthode pour ajouter des crédits
UserSchema.methods.addCredit = function(amount, type, description, metadata = {}) {
  this.credit += amount;
  this.creditHistory.push({
    amount,
    type,
    description,
    metadata,
    referenceId: require('crypto').randomBytes(16).toString('hex')
  });
  return this.save();
};

// Méthode pour transférer des crédits
UserSchema.methods.transferCredit = async function(toUserId, amount, description = '') {
  const User = mongoose.model('User');
  const session = await mongoose.startSession();
  
  try {
    session.startTransaction();
    
    // Vérifier le solde
    if (this.credit < amount) {
      throw new Error('Insufficient credit');
    }
    
    // Débiter l'expéditeur
    this.credit -= amount;
    this.creditHistory.push({
      amount: -amount,
      type: 'transfer_sent',
      description: `Transfer to ${toUserId}: ${description}`,
      referenceId: require('crypto').randomBytes(16).toString('hex')
    });
    await this.save({ session });
    
    // Créditer le destinataire
    const recipient = await User.findById(toUserId).session(session);
    if (!recipient) {
      throw new Error('Recipient not found');
    }
    
    recipient.credit += amount;
    recipient.creditHistory.push({
      amount,
      type: 'transfer_received',
      description: `Transfer from ${this._id}: ${description}`,
      referenceId: require('crypto').randomBytes(16).toString('hex')
    });
    await recipient.save({ session });
    
    await session.commitTransaction();
    session.endSession();
    
    return {
      success: true,
      transactionId: this.creditHistory[this.creditHistory.length - 1].referenceId,
      newBalance: this.credit
    };
    
  } catch (error) {
    await session.abortTransaction();
    session.endSession();
    throw error;
  }
};

// Indexes pour optimisation des performances
UserSchema.index({ username: 1 });
UserSchema.index({ email: 1 });
UserSchema.index({ userType: 1 });
UserSchema.index({ country: 1 });
UserSchema.index({ affiliateCode: 1 });
UserSchema.index({ referredBy: 1 });
UserSchema.index({ 'contacts.value': 1 });
UserSchema.index({ createdAt: -1 });

module.exports = mongoose.model('User', UserSchema);
