import { Router } from 'express';

function serializeGuild(guild, userId = null) {
  if (!guild) return null;
  const voiceChannels = [...guild.channels.cache.values()]
    .filter(c => c.type === 2)
    .map(c => ({ id: c.id, name: c.name, userCount: c.members.size }));

  return {
    id: guild.id,
    name: guild.name,
    icon: guild.iconURL?.({ size: 128 }) || null,
    members: guild.memberCount,
    voiceChannels,
    userVoiceChannelId: userId
      ? (guild.voiceStates.cache.get(userId)?.channelId || null)
      : null,
  };
}

export default function guildsRoutes(client) {
  const router = Router();

  router.get('/', (req, res) => {
    const userId = req.get('x-dashboard-user-id');
    const guilds = [...client.guilds.cache.values()].map(g => serializeGuild(g, userId));
    res.json(guilds);
  });

  router.get('/:id', (req, res) => {
    const guild = client.guilds.cache.get(req.params.id);
    if (!guild) return res.status(404).json({ error: 'guild not found' });
    res.json(serializeGuild(guild, req.get('x-dashboard-user-id')));
  });

  return router;
}
