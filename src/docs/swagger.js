const swaggerJsdoc = require('swagger-jsdoc');

const options = {
  definition: {
    openapi: '3.0.0',
    info: {
      title: 'SSO Authentication API',
      version: '1.0.0',
      description: 'API de Single Sign-On avec gestion de crédits et réseau d\'affiliés',
      contact: {
        name: 'Support',
        email: 'support@sso-system.com'
      }
    },
    servers: [
      {
        url: 'http://localhost:3000/api/v1',
        description: 'Development server'
      }
    ],
    components: {
      securitySchemes: {
        BearerAuth: {
          type: 'http',
          scheme: 'bearer',
          bearerFormat: 'JWT'
        }
      },
      schemas: {
        User: {
          type: 'object',
          properties: {
            id: { type: 'string' },
            username: { type: 'string' },
            email: { type: 'string' },
            fullName: { type: 'string' },
            country: { type: 'string' },
            city: { type: 'string' },
            userType: { type: 'string', enum: ['user', 'affiliate', 'partner', 'team', 'admin'] },
            credit: { type: 'number' },
            affiliateCode: { type: 'string' },
            isVerified: { type: 'boolean' },
            isActive: { type: 'boolean' }
          }
        },
        AuthTokens: {
          type: 'object',
          properties: {
            accessToken: { type: 'string' },
            refreshToken: { type: 'string' },
            expiresIn: { type: 'number' },
            tokenType: { type: 'string' }
          }
        }
      }
    }
  },
  apis: ['./src/routes/*.js']
};

const specs = swaggerJsdoc(options);
module.exports = specs;
