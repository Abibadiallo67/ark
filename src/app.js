require('dotenv').config();
const express = require('express');
const helmet = require('helmet');
const cors = require('cors');
const compression = require('compression');
const morgan = require('morgan');
const swaggerUi = require('swagger-ui-express');
const database = require('./config/database');
const swaggerDocument = require('./docs/swagger');

class App {
  constructor() {
    this.app = express();
    this.port = process.env.PORT || 3000;
    this.apiVersion = process.env.API_VERSION || 'v1';

    this.initializeMiddlewares();
    this.initializeDatabase();
    this.initializeRoutes();
    this.initializeErrorHandling();
    this.initializeSwagger();
  }

  initializeMiddlewares() {
    // Sécurité
    this.app.use(helmet({
      contentSecurityPolicy: {
        directives: {
          defaultSrc: ["'self'"],
          styleSrc: ["'self'", "'unsafe-inline'"],
          scriptSrc: ["'self'"],
          imgSrc: ["'self'", "data:", "https:"]
        }
      }
    }));

    // CORS configurable
    const corsOptions = {
      origin: process.env.ALLOWED_ORIGINS 
        ? process.env.ALLOWED_ORIGINS.split(',')
        : '*',
      credentials: true,
      optionsSuccessStatus: 200
    };
    this.app.use(cors(corsOptions));

    // Logging
    this.app.use(morgan('combined'));

    // Body parsers
    this.app.use(express.json({ limit: '10mb' }));
    this.app.use(express.urlencoded({ extended: true, limit: '10mb' }));

    // Compression
    this.app.use(compression());

    // Health check
    this.app.get('/health', (req, res) => {
      res.json({
        status: 'healthy',
        timestamp: new Date().toISOString(),
        uptime: process.uptime()
      });
    });
  }

  async initializeDatabase() {
    await database.connectMongoDB();
    await database.connectRedis();
  }

  initializeRoutes() {
    // Routes API
    this.app.use(`/api/${this.apiVersion}/auth`, require('./routes/auth'));
    this.app.use(`/api/${this.apiVersion}/user`, require('./routes/user'));
    this.app.use(`/api/${this.apiVersion}/admin`, require('./routes/admin'));

    // Route 404
    this.app.use('*', (req, res) => {
      res.status(404).json({
        success: false,
        error: 'Endpoint not found'
      });
    });
  }

  initializeErrorHandling() {
    // Error handler global
    this.app.use((err, req, res, next) => {
      console.error('Global error handler:', err);

      const statusCode = err.statusCode || 500;
      const message = err.message || 'Internal server error';

      res.status(statusCode).json({
        success: false,
        error: message,
        ...(process.env.NODE_ENV === 'development' && { stack: err.stack })
      });
    });
  }

  initializeSwagger() {
    if (process.env.NODE_ENV !== 'production') {
      this.app.use(
        `/api/${this.apiVersion}/docs`,
        swaggerUi.serve,
        swaggerUi.setup(swaggerDocument)
      );
    }
  }

  start() {
    this.server = this.app.listen(this.port, () => {
      console.log(`
        🚀 Server is running!
        📍 Port: ${this.port}
        🌍 Environment: ${process.env.NODE_ENV}
        📚 API Version: ${this.apiVersion}
        📊 MongoDB: Connected
        🔴 Redis: Connected
        📄 Documentation: http://localhost:${this.port}/api/${this.apiVersion}/docs
      `);
    });

    // Gestion propre de l'arrêt
    process.on('SIGTERM', () => this.shutdown());
    process.on('SIGINT', () => this.shutdown());
  }

  async shutdown() {
    console.log('🛑 Shutting down server...');
    
    if (this.server) {
      this.server.close();
    }
    
    await database.disconnect();
    console.log('✅ Server shut down successfully');
    process.exit(0);
  }
}

// Démarrer l'application
if (require.main === module) {
  const app = new App();
  app.start();
}

module.exports = App;
