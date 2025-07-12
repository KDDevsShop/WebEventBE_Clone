import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import accountRoutes from './routes/accountRoutes.js';
import serviceTypeRoutes from './routes/serviceTypeRoutes.js';
import serviceRoutes from './routes/serviceRoutes.js';
import variationRouter from './routes/variationRoutes.js';
import pricingTierRoutes from './routes/pricingTierRoutes.js';
import eventRoutes from './routes/eventRoutes.js';
import eventTypeRoutes from './routes/eventTypeRoutes.js';
import notificationRoutes from './routes/notificationRoutes.js';
import reviewRoutes from './routes/reviewRoutes.js';
import paymentRoutes from './routes/paymentRoutes.js';
import roomRoutes from './routes/roomRoutes.js';
import imageRoutes from './routes/imageRoutes.js';
import dashboardRoutes from './routes/dashboardRoutes.js';
import analyticsRoutes from './routes/analyticsRoutes.js';
import nodemailer from 'nodemailer';
import cookieParser from 'cookie-parser';
dotenv.config();

const app = express();

// Middleware
app.use(
  cors({
    origin: 'http://localhost:5173',
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE'],
    allowedHeaders: ['Content-Type', 'Authorization'],
  })
);

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'success', message: 'Server is running' });
});

// Routes
app.use('/api/accounts', accountRoutes);
app.use('/api/service-types', serviceTypeRoutes);
app.use('/api/services', serviceRoutes);
app.use('/api/variations', variationRouter);
app.use('/api/pricing-tiers', pricingTierRoutes);
app.use('/api/events', eventRoutes);
app.use('/api/event-types', eventTypeRoutes);
app.use('/api/notifications', notificationRoutes);
app.use('/api/reviews', reviewRoutes);
app.use('/api/payments', paymentRoutes);
app.use('/api/rooms', roomRoutes);
app.use('/api/images', imageRoutes);
app.use('/api/dashboard', dashboardRoutes);
app.use('/api/analytics', analyticsRoutes);

// 404 handler
app.use((req, res) => {
  res.status(404).json({
    status: 'error',
    message: `Route ${req.method} ${req.originalUrl} not found`,
  });
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
