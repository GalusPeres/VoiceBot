import { Router } from 'express';
import { BOT_USERNAME } from '../../utils/constants.js';

export default function manifestRoutes(client) {
  const router = Router();

  router.get('/', (req, res) => {
    const botUser = client?.user;
    res.json({
      id: 'voicebot',
      name: BOT_USERNAME,
      version: '0.1.0',
      icon: 'mic',
      avatar: botUser?.displayAvatarURL({ size: 128 }) || null,
      capabilities: ['status', 'guilds', 'logs', 'stats', 'settings', 'voice-control'],
      pages: [
        { id: 'stats',    label: 'Statistics', icon: 'stats',    kind: 'stats' },
        { id: 'logs',     label: 'Live Logs',  icon: 'logs',     kind: 'logs' },
        { id: 'settings', label: 'Settings',   icon: 'settings', kind: 'settings' },
      ],
      endpoints: {
        status:         '/api/status',
        guilds:         '/api/guilds',
        logs:           '/api/logs',
        logStream:      '/api/logs/stream',
        stats:          '/api/stats',
        settings:       '/api/settings',
        settingsSchema: '/api/settings/schema',
      },
    });
  });

  return router;
}
