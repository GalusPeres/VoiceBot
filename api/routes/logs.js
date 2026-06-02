import { Router } from 'express';
import { logger, sseClients } from '../../utils/logger.js';

export default function logsRoutes() {
  const router = Router();

  router.get('/', (req, res) => {
    res.json(logger.getLogs());
  });

  router.get('/stream', (req, res) => {
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.flushHeaders();

    // Letzte 50 Logs direkt senden
    logger.getLogs().slice(-50).forEach(line => {
      res.write(`data: ${JSON.stringify(line)}\n\n`);
    });

    sseClients.add(res);
    req.on('close', () => sseClients.delete(res));
  });

  return router;
}
