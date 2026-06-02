import { Router } from 'express';
import { musicClient } from '../../services/musicClient.js';
import { soundClient } from '../../services/soundClient.js';

const startedAt = Date.now();

export default function statusRoutes(client) {
  const router = Router();

  router.get('/', async (req, res) => {
    const [musicOnline, soundOnline] = await Promise.all([
      musicClient.isOnline(),
      soundClient.isOnline(),
    ]);

    res.json({
      online: client?.isReady() || false,
      uptimeMs: Date.now() - startedAt,
      guildCount: client?.guilds?.cache?.size || 0,
      connectedBots: {
        music: musicOnline,
        sound: soundOnline,
      },
    });
  });

  return router;
}
