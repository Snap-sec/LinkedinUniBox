import express from 'express';
import cors from 'cors';
import mongoose from 'mongoose';
import dotenv from 'dotenv';
import apiRouter from './routes/api.js';
import { startSyncCron } from './services/cronService.js';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 5000;
const MONGO_URI = process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/linkedin_inbox';

app.use(cors());
app.use(express.json({ limit: '10mb' }));

// Request Logger Middleware
app.use((req, res, next) => {
  console.log(`[HTTP Request] ${req.method} ${req.url} at ${new Date().toLocaleTimeString()}`);
  next();
});

// API Routes
app.use('/api', apiRouter);

// Dynamic Extension Zip Download Fallback
app.get('/linkedin-extension.zip', (req, res) => {
  res.redirect('/api/extension/download');
});

// Health Endpoint
app.get('/health', (req, res) => {
  res.json({ status: 'ok', database: mongoose.connection.readyState === 1 ? 'connected' : 'disconnected' });
});

// Database Connection & Server Start
async function startServer() {
  try {
    console.log('[MongoDB] Connecting to local MongoDB server...');
    await mongoose.connect(MONGO_URI);
    console.log('[MongoDB] Connected successfully to mongodb://127.0.0.1:27017/linkedin_inbox');

    // Start 30-second periodic background refetch cron
    startSyncCron(30000);

    app.listen(PORT, () => {
      console.log(`[Express API] Server running on http://localhost:${PORT}`);
    });
  } catch (err) {
    console.error('[MongoDB Error] Could not connect to local MongoDB:', err.message);
    console.log('[Express API] Starting server in fallback mode...');
    app.listen(PORT, () => {
      console.log(`[Express API] Server running on http://localhost:${PORT} (DB Connection pending)`);
    });
  }
}

startServer();
