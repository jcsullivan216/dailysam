import express from 'express';
import cors from 'cors';
import cron from 'node-cron';
import path from 'path';
import { fileURLToPath } from 'url';
import solicitationsRouter from './routes/solicitations.js';
import { scrapeSamDaily } from './services/scraper.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const app = express();
const PORT = process.env.PORT || 3001;

// Middleware
app.use(cors());
app.use(express.json());

// Request logging
app.use((req, res, next) => {
  console.log(`${new Date().toISOString()} ${req.method} ${req.path}`);
  next();
});

// API routes
app.use('/api/solicitations', solicitationsRouter);

// Move scrape routes to be accessible at /api level too
app.post('/api/scrape', (req, res, next) => {
  req.url = '/scrape';
  solicitationsRouter(req, res, next);
});

app.get('/api/scrape/status', (req, res, next) => {
  req.url = '/scrape/status';
  solicitationsRouter(req, res, next);
});

app.get('/api/scrape/logs', (req, res, next) => {
  req.url = '/scrape/logs';
  solicitationsRouter(req, res, next);
});

app.post('/api/archive', (req, res, next) => {
  req.url = '/archive';
  solicitationsRouter(req, res, next);
});

app.get('/api/export', (req, res, next) => {
  req.url = '/export';
  solicitationsRouter(req, res, next);
});

// Health check
app.get('/api/health', (req, res) => {
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    uptime: process.uptime()
  });
});

// Serve static files from frontend build in production
const frontendPath = path.join(__dirname, '..', '..', 'frontend', 'dist');
app.use(express.static(frontendPath));

// Catch-all for SPA routing
app.get('*', (req, res) => {
  if (!req.path.startsWith('/api')) {
    res.sendFile(path.join(frontendPath, 'index.html'));
  } else {
    res.status(404).json({ error: 'API endpoint not found' });
  }
});

// Error handling middleware
app.use((err, req, res, next) => {
  console.error('Error:', err);
  res.status(500).json({
    success: false,
    error: err.message || 'Internal server error'
  });
});

// Auto-refresh scheduling (daily at 6 AM)
const ENABLE_AUTO_SCRAPE = process.env.ENABLE_AUTO_SCRAPE === 'true';

if (ENABLE_AUTO_SCRAPE) {
  cron.schedule('0 6 * * *', async () => {
    console.log('[Cron] Starting scheduled daily scrape...');
    try {
      const result = await scrapeSamDaily((msg) => console.log(`[Cron] ${msg}`));
      console.log('[Cron] Scheduled scrape completed:', result);
    } catch (error) {
      console.error('[Cron] Scheduled scrape failed:', error);
    }
  });
  console.log('Auto-scrape scheduled for daily at 6 AM');
}

// Start server
app.listen(PORT, () => {
  console.log(`
╔════════════════════════════════════════════════════════════╗
║         SAM Daily Solicitations Tracker - Backend          ║
╠════════════════════════════════════════════════════════════╣
║  Server running on: http://localhost:${PORT}                   ║
║  API Base URL:      http://localhost:${PORT}/api               ║
║  Auto-scrape:       ${ENABLE_AUTO_SCRAPE ? 'Enabled (6 AM daily)' : 'Disabled'}            ║
╚════════════════════════════════════════════════════════════╝
  `);
});

export default app;
