import { Router } from 'express';

const startedAt = Date.now();
let commandCount = 0;
let successCount = 0;
let failCount = 0;

export function trackCommand(success) {
  commandCount++;
  if (success) successCount++; else failCount++;
}

export default function statsRoutes(client) {
  const router = Router();

  router.get('/', (req, res) => {
    const uptimeSec = Math.floor((Date.now() - startedAt) / 1000);
    const h = Math.floor(uptimeSec / 3600);
    const m = Math.floor((uptimeSec % 3600) / 60);

    res.json({
      cards: [
        { key: 'guilds',   label: 'Servers',   value: client?.guilds?.cache?.size || 0 },
        { key: 'commands', label: 'Commands',   value: commandCount },
        { key: 'success',  label: 'Erfolgreich',value: successCount },
        { key: 'uptime',   label: 'Uptime',     value: `${h}h ${m}m` },
      ],
    });
  });

  return router;
}
