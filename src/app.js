import express from 'express';
import cors from 'cors';
import authRoutes from './routes/auth.routes.js';
import userRoutes from './routes/user.routes.js';
import leadRoutes from './routes/lead.routes.js';
import dealRoutes from './routes/deal.routes.js';
import activityRoutes from './routes/activity.routes.js';
import customerRoutes from './routes/customer.routes.js';
import reportRoutes from './routes/report.routes.js';
import notificationRoutes from './routes/notification.routes.js';

const app = express();

// Middleware
app.use(express.json());
app.use(cors())
// Routes
app.use('/api/auth', authRoutes);
app.use('/api/users', userRoutes);
app.use('/api/leads', leadRoutes);
app.use('/api/deals', dealRoutes);
app.use('/api/customers', customerRoutes);
app.use('/api/notifications', notificationRoutes)
app.use('/api', activityRoutes);
app.use('/api', reportRoutes);


// Basic Health Check Route
app.get('/api/health', (req, res) => {
  res.status(200).json({ status: 'OK', message: 'CRM API is running.' });
});

// Global Error Handler (Placeholder for now)
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ message: 'Internal Server Error' });
});

export default app;