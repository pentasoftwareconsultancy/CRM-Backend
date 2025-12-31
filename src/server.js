import app from './app.js';
import dotenv from 'dotenv';
import mongoose from 'mongoose';
import logger from './utils/logger.js';

dotenv.config();

const PORT = process.env.PORT || 5000;
const MONGODB_URI = process.env.MONGODB_URI;

mongoose.connect(MONGODB_URI)
  .then(() => {
    logger.info('Database connected successfully.');
    app.listen(PORT, (err) => {
      logger.info(`Server running on port ${PORT}`);
      if (process.env.NODE_ENV === 'test') {
        logger.info('Running in TEST environment.');
      }
      if (err) {
        logger.error(err)
      }
    });
  })
  .catch(err => {
    logger.error('Database connection failed:', err);
    process.exit(1);
  });