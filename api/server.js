import express from 'express';
import cors from 'cors';
import { BOT_API_PORT, BOT_API_TOKEN } from '../utils/constants.js';
import { logger } from '../utils/logger.js';

import manifestRoutes from './routes/manifest.js';
import statusRoutes   from './routes/status.js';
import guildsRoutes   from './routes/guilds.js';
import logsRoutes     from './routes/logs.js';
import statsRoutes,   { trackCommand } from './routes/stats.js';
import settingsRoutes from './routes/settings.js';

export { trackCommand };

function requireToken(req, res, next) {
  if (!BOT_API_TOKEN) return next();
  const auth = req.headers.authorization || '';
  if (auth === `Bearer ${BOT_API_TOKEN}`) return next();
  res.status(401).json({ error: 'unauthorized' });
}

export function startApiServer(client) {
  const app = express();
  app.use(cors());
  app.use(express.json());

  app.get('/healthz', (req, res) => res.json({ ok: true }));

  app.use(requireToken);

  app.use('/api/manifest', manifestRoutes(client));
  app.use('/api/status',   statusRoutes(client));
  app.use('/api/guilds',   guildsRoutes(client));
  app.use('/api/logs',     logsRoutes());
  app.use('/api/stats',    statsRoutes(client));
  app.use('/api/settings', settingsRoutes());

  app.use((err, req, res, _next) => {
    logger.error('[API]', err.message);
    res.status(500).json({ error: err.message });
  });

  app.listen(BOT_API_PORT, '0.0.0.0', () => {
    logger.info(`[API] Server läuft auf :${BOT_API_PORT}`);
  });
}
