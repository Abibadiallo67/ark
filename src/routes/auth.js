const express = require('express');
const router = express.Router();
const AuthController = require('../controllers/AuthController');
const rateLimiters = require('../middleware/rateLimiter');
const { body, validationResult } = require('express-validator');

// Validation middleware
const validate = (validations) => {
  return async (req, res, next) => {
    await Promise.all(validations.map(validation => validation.run(req)));

    const errors = validationResult(req);
    if (errors.isEmpty()) {
      return next();
    }

    res.status(400).json({
      success: false,
      errors: errors.array()
    });
  };
};

// Routes d'authentification
router.post(
  '/register',
  rateLimiters.registration,
  validate([
    body('username')
      .isLength({ min: 3, max: 30 })
      .withMessage('Username must be between 3 and 30 characters'),
    body('email').isEmail().withMessage('Valid email is required'),
    body('password')
      .isLength({ min: 8 })
      .withMessage('Password must be at least 8 characters'),
    body('country').optional().isString(),
    body('city').optional().isString()
  ]),
  AuthController.register
);

router.post(
  '/login',
  rateLimiters.auth,
  validate([
    body('username').notEmpty().withMessage('Username or email is required'),
    body('password').notEmpty().withMessage('Password is required')
  ]),
  AuthController.login
);

router.post(
  '/refresh-token',
  validate([
    body('refreshToken').notEmpty().withMessage('Refresh token is required')
  ]),
  AuthController.refreshToken
);

router.post(
  '/logout',
  AuthController.logout
);

// OAuth2 endpoints
router.post(
  '/oauth/authorize',
  rateLimiters.oauth,
  async (req, res) => {
    // Implémentation OAuth2
    res.json({ message: 'OAuth2 authorize endpoint' });
  }
);

router.post(
  '/oauth/token',
  rateLimiters.oauth,
  async (req, res) => {
    // Implémentation OAuth2 token
    res.json({ message: 'OAuth2 token endpoint' });
  }
);

module.exports = router;
