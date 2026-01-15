const rateLimit = require('express-rate-limit');
const redis = require('../config/database').redisClient;

// Stockage personnalisé pour Redis
const RedisStore = require('rate-limit-redis').default;

const createRateLimiter = (windowMs, max, keyPrefix) => {
  return rateLimit({
    windowMs,
    max,
    message: {
      success: false,
      error: 'Too many requests, please try again later'
    },
    standardHeaders: true,
    legacyHeaders: false,
    keyGenerator: (req) => {
      return `${keyPrefix}:${req.ip}:${req.user ? req.user.id : 'anonymous'}`;
    },
    skip: (req) => {
      // Skip pour les IPs de confiance
      const trustedIPs = ['127.0.0.1', '::1'];
      return trustedIPs.includes(req.ip);
    },
    store: new RedisStore({
      sendCommand: (...args) => redis.sendCommand(args),
      prefix: 'rate_limit:'
    })
  });
};

// Limiteurs pour différentes routes
const rateLimiters = {
  // Limiteur strict pour l'authentification
  auth: createRateLimiter(15 * 60 * 1000, 5, 'auth'),
  
  // Limiteur standard pour les API
  api: createRateLimiter(15 * 60 * 1000, 100, 'api'),
  
  // Limiteur pour la création de compte
  registration: createRateLimiter(60 * 60 * 1000, 3, 'registration'),
  
  // Limiteur pour les transferts de crédits
  creditTransfer: createRateLimiter(60 * 60 * 1000, 10, 'credit_transfer'),
  
  // Limiteur pour les demandes OAuth
  oauth: createRateLimiter(15 * 60 * 1000, 20, 'oauth'),
  
  // Limiteur pour les webhooks
  webhook: createRateLimiter(60 * 1000, 60, 'webhook')
};

module.exports = rateLimiters;
