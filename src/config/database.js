const mongoose = require('mongoose');
const redis = require('redis');

class Database {
  constructor() {
    this.mongoConnection = null;
    this.redisClient = null;
  }

  async connectMongoDB() {
    try {
      this.mongoConnection = await mongoose.connect(process.env.MONGODB_URI, {
        useNewUrlParser: true,
        useUnifiedTopology: true,
        maxPoolSize: 10,
        minPoolSize: 5,
      });
      console.log('✅ MongoDB connected successfully');
      return this.mongoConnection;
    } catch (error) {
      console.error('❌ MongoDB connection error:', error);
      process.exit(1);
    }
  }

  async connectRedis() {
    try {
      this.redisClient = redis.createClient({
        url: process.env.REDIS_URL,
      });

      this.redisClient.on('error', (err) => {
        console.error('❌ Redis connection error:', err);
      });

      await this.redisClient.connect();
      console.log('✅ Redis connected successfully');
      return this.redisClient;
    } catch (error) {
      console.error('❌ Redis connection failed:', error);
    }
  }

  async disconnect() {
    if (this.mongoConnection) {
      await mongoose.disconnect();
    }
    if (this.redisClient) {
      await this.redisClient.quit();
    }
  }
}

module.exports = new Database();
