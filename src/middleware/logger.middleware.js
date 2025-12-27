import logger from '../utils/logger.js';

// Request logging middleware
export const requestLogger = (req, res, next) => {
  const start = Date.now();
  const userId = req.user ? req.user._id : null;

  logger.info(`Incoming request: ${req.method} ${req.originalUrl}`, { ip: req.ip, userId });

  res.on('finish', () => {
    const duration = Date.now() - start;
    logger.info(`Request completed: ${req.method} ${req.originalUrl} ${res.statusCode} ${duration}ms`, {
      ip: req.ip,
      userId,
      statusCode: res.statusCode,
      duration
    });
  });

  next();
};
