const jwt = require('jsonwebtoken');
const User = require('../models/User');
const Session = require('../models/Session');
const redis = require('../config/database').redisClient;

class AuthMiddleware {
  // Middleware pour vérifier le token JWT
  static async verifyToken(req, res, next) {
    try {
      const authHeader = req.headers.authorization;
      
      if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return res.status(401).json({
          success: false,
          error: 'Access token required'
        });
      }

      const token = authHeader.split(' ')[1];
      
      // Vérifier dans Redis si le token est révoqué
      const isRevoked = await redis.get(`token:revoked:${token}`);
      if (isRevoked) {
        return res.status(401).json({
          success: false,
          error: 'Token has been revoked'
        });
      }

      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      
      // Vérifier la session dans la base de données
      const session = await Session.findOne({
        accessToken: token,
        isRevoked: false,
        expiresAt: { $gt: new Date() }
      });

      if (!session) {
        return res.status(401).json({
          success: false,
          error: 'Invalid or expired session'
        });
      }

      // Récupérer l'utilisateur
      const user = await User.findById(decoded.userId).select('-password -twoFactorSecret');
      
      if (!user || !user.isActive) {
        return res.status(401).json({
          success: false,
          error: 'User not found or inactive'
        });
      }

      // Mettre à jour la dernière activité
      session.lastActivity = new Date();
      await session.save();

      // Attacher les données à la requête
      req.user = user;
      req.session = session;
      req.token = token;

      next();
    } catch (error) {
      if (error.name === 'TokenExpiredError') {
        return res.status(401).json({
          success: false,
          error: 'Token expired',
          code: 'TOKEN_EXPIRED'
        });
      }
      
      if (error.name === 'JsonWebTokenError') {
        return res.status(401).json({
          success: false,
          error: 'Invalid token',
          code: 'INVALID_TOKEN'
        });
      }

      console.error('Auth middleware error:', error);
      res.status(500).json({
        success: false,
        error: 'Authentication failed'
      });
    }
  }

  // Middleware pour vérifier les permissions
  static checkPermission(requiredPermission) {
    return async (req, res, next) => {
      try {
        const { applicationId } = req.session;
        
        if (!applicationId) {
          return next(); // Pas de vérification si pas d'application
        }

        // Ici, vous pouvez vérifier si l'application a la permission requise
        // Cette logique dépendra de votre implémentation des permissions
        
        next();
      } catch (error) {
        console.error('Permission check error:', error);
        res.status(403).json({
          success: false,
          error: 'Insufficient permissions'
        });
      }
    };
  }

  // Middleware pour vérifier le rôle
  static checkRole(roles) {
    return (req, res, next) => {
      if (!req.user) {
        return res.status(401).json({
          success: false,
          error: 'Authentication required'
        });
      }

      const userRole = req.user.userType;
      
      if (!roles.includes(userRole)) {
        return res.status(403).json({
          success: false,
          error: 'Insufficient role privileges'
        });
      }

      next();
    };
  }

  // Middleware pour vérifier le 2FA
  static async verifyTwoFactor(req, res, next) {
    try {
      if (!req.user.twoFactorEnabled) {
        return next();
      }

      const twoFactorToken = req.headers['x-2fa-token'];
      
      if (!twoFactorToken) {
        return res.status(401).json({
          success: false,
          error: 'Two-factor authentication required',
          code: '2FA_REQUIRED'
        });
      }

      // Vérifier le token 2FA
      // Implémentez votre logique de vérification 2FA ici
      
      next();
    } catch (error) {
      console.error('2FA verification error:', error);
      res.status(401).json({
        success: false,
        error: 'Two-factor authentication failed'
      });
    }
  }
}

module.exports = AuthMiddleware;
