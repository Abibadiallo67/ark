const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const User = require('../models/User');
const Session = require('../models/Session');
const Application = require('../models/Application');
const redis = require('../config/database').redisClient;

class AuthController {
  // Inscription d'un nouvel utilisateur
  static async register(req, res) {
    try {
      const {
        username,
        email,
        password,
        firstName,
        lastName,
        country,
        city,
        contacts,
        affiliateCode
      } = req.body;

      // Vérifier si l'utilisateur existe déjà
      const existingUser = await User.findOne({
        $or: [{ username }, { email }]
      });

      if (existingUser) {
        return res.status(400).json({
          success: false,
          error: 'Username or email already exists'
        });
      }

      // Créer l'utilisateur
      const user = new User({
        username,
        email,
        password,
        firstName,
        lastName,
        country,
        city,
        contacts: contacts || []
      });

      // Gérer l'affiliation
      if (affiliateCode) {
        const referrer = await User.findOne({ affiliateCode });
        if (referrer) {
          user.referredBy = referrer._id;
          
          // Ajouter à la liste des références du parrain
          referrer.referrals.push({
            userId: user._id,
            joinedAt: new Date()
          });
          await referrer.save();
        }
      }

      // Générer le code d'affiliation
      user.generateAffiliateCode();

      await user.save();

      // Générer des tokens
      const tokens = await AuthController.generateTokens(user, null);

      res.status(201).json({
        success: true,
        message: 'User registered successfully',
        data: {
          user: {
            id: user._id,
            username: user.username,
            email: user.email,
            fullName: user.fullName,
            country: user.country,
            city: user.city,
            userType: user.userType,
            affiliateCode: user.affiliateCode,
            credit: user.credit,
            isVerified: user.isVerified
          },
          tokens
        }
      });

    } catch (error) {
      console.error('Registration error:', error);
      res.status(500).json({
        success: false,
        error: 'Registration failed',
        details: error.message
      });
    }
  }

  // Connexion
  static async login(req, res) {
    try {
      const { username, password, applicationId } = req.body;

      // Récupérer l'utilisateur avec le mot de passe
      const user = await User.findOne({
        $or: [{ username }, { email: username }]
      }).select('+password');

      if (!user) {
        return res.status(401).json({
          success: false,
          error: 'Invalid credentials'
        });
      }

      // Vérifier le mot de passe
      const isPasswordValid = await user.comparePassword(password);
      if (!isPasswordValid) {
        return res.status(401).json({
          success: false,
          error: 'Invalid credentials'
        });
      }

      // Vérifier si le compte est actif
      if (!user.isActive) {
        return res.status(403).json({
          success: false,
          error: 'Account is deactivated'
        });
      }

      // Vérifier l'application si applicationId est fourni
      let application = null;
      if (applicationId) {
        application = await Application.findById(applicationId);
        if (!application || !application.isActive) {
          return res.status(400).json({
            success: false,
            error: 'Invalid or inactive application'
          });
        }
      }

      // Mettre à jour les statistiques de connexion
      user.lastLogin = new Date();
      user.loginCount += 1;
      await user.save();

      // Générer des tokens
      const tokens = await AuthController.generateTokens(user, application);

      res.json({
        success: true,
        message: 'Login successful',
        data: {
          user: {
            id: user._id,
            username: user.username,
            email: user.email,
            fullName: user.fullName,
            userType: user.userType,
            credit: user.credit,
            isVerified: user.isVerified,
            twoFactorEnabled: user.twoFactorEnabled
          },
          tokens
        }
      });

    } catch (error) {
      console.error('Login error:', error);
      res.status(500).json({
        success: false,
        error: 'Login failed'
      });
    }
  }

  // Rafraîchir le token
  static async refreshToken(req, res) {
    try {
      const { refreshToken } = req.body;

      if (!refreshToken) {
        return res.status(400).json({
          success: false,
          error: 'Refresh token required'
        });
      }

      // Vérifier le refresh token
      const decoded = jwt.verify(refreshToken, process.env.JWT_REFRESH_SECRET);

      // Vérifier la session
      const session = await Session.findOne({
        refreshToken,
        isRevoked: false,
        expiresAt: { $gt: new Date() }
      }).populate('userId applicationId');

      if (!session) {
        return res.status(401).json({
          success: false,
          error: 'Invalid or expired refresh token'
        });
      }

      // Récupérer l'utilisateur
      const user = await User.findById(session.userId);
      if (!user || !user.isActive) {
        return res.status(401).json({
          success: false,
          error: 'User not found or inactive'
        });
      }

      // Révoquer l'ancien access token
      session.isRevoked = true;
      session.revokedAt = new Date();
      await session.save();

      // Mettre le token dans la liste noire Redis
      await redis.setex(
        `token:revoked:${session.accessToken}`,
        3600,
        'true'
      );

      // Générer de nouveaux tokens
      const tokens = await AuthController.generateTokens(
        user,
        session.applicationId
      );

      res.json({
        success: true,
        message: 'Token refreshed successfully',
        data: { tokens }
      });

    } catch (error) {
      if (error.name === 'TokenExpiredError') {
        return res.status(401).json({
          success: false,
          error: 'Refresh token expired'
        });
      }
      
      console.error('Refresh token error:', error);
      res.status(500).json({
        success: false,
        error: 'Token refresh failed'
      });
    }
  }

  // Déconnexion
  static async logout(req, res) {
    try {
      const { session } = req;

      // Révoquer la session
      session.isRevoked = true;
      session.revokedAt = new Date();
      await session.save();

      // Mettre les tokens dans la liste noire Redis
      await redis.setex(
        `token:revoked:${session.accessToken}`,
        3600,
        'true'
      );

      await redis.setex(
        `token:revoked:${session.refreshToken}`,
        3600,
        'true'
      );

      res.json({
        success: true,
        message: 'Logout successful'
      });

    } catch (error) {
      console.error('Logout error:', error);
      res.status(500).json({
        success: false,
        error: 'Logout failed'
      });
    }
  }

  // Méthode utilitaire pour générer des tokens
  static async generateTokens(user, application) {
    const accessToken = jwt.sign(
      {
        userId: user._id,
        username: user.username,
        userType: user.userType,
        applicationId: application?._id
      },
      process.env.JWT_SECRET,
      { expiresIn: process.env.ACCESS_TOKEN_EXPIRY }
    );

    const refreshToken = jwt.sign(
      {
        userId: user._id,
        tokenType: 'refresh'
      },
      process.env.JWT_REFRESH_SECRET,
      { expiresIn: process.env.REFRESH_TOKEN_EXPIRY }
    );

    // Calculer la date d'expiration
    const expiresAt = new Date();
    expiresAt.setSeconds(
      expiresAt.getSeconds() + 
      parseInt(process.env.ACCESS_TOKEN_EXPIRY) * 60
    );

    // Créer une session
    const session = new Session({
      userId: user._id,
      applicationId: application?._id,
      accessToken,
      refreshToken,
      ipAddress: req?.ip,
      userAgent: req?.headers['user-agent'],
      expiresAt
    });

    await session.save();

    return {
      accessToken,
      refreshToken,
      expiresIn: parseInt(process.env.ACCESS_TOKEN_EXPIRY) * 60,
      tokenType: 'Bearer'
    };
  }
}

module.exports = AuthController;
