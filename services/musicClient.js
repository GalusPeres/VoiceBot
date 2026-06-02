import { MUSIC_BOT_URL, BOT_API_TOKEN } from '../utils/constants.js';
import { logger } from '../utils/logger.js';

function headers(userId = null) {
  const h = { 'Content-Type': 'application/json' };
  if (BOT_API_TOKEN) h['authorization'] = `Bearer ${BOT_API_TOKEN}`;
  if (userId) h['x-dashboard-user-id'] = userId;
  return h;
}

async function call(method, path, body = null, userId = null) {
  const url = `${MUSIC_BOT_URL}/api${path}`;
  const opts = { method, headers: headers(userId) };
  if (body) opts.body = JSON.stringify(body);
  const res = await fetch(url, opts);
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: res.statusText }));
    throw new Error(err.error || res.statusText);
  }
  return res.json().catch(() => null);
}

export const musicClient = {
  // Musik spielen
  async play(guildId, channelId, query, userId = null) {
    return call('POST', '/player/play', { guildId, channelId, query }, userId);
  },

  // Pause / Weiter
  async pause(guildId, userId = null) {
    return call('POST', '/player/pause', { guildId }, userId);
  },
  async resume(guildId, userId = null) {
    return call('POST', '/player/resume', { guildId }, userId);
  },

  // Stop
  async stop(guildId, userId = null) {
    return call('POST', '/player/stop', { guildId }, userId);
  },

  // Skip
  async skip(guildId, userId = null) {
    return call('POST', '/player/skip', { guildId }, userId);
  },

  // Lautstärke
  async volume(guildId, level, userId = null) {
    return call('POST', '/player/volume', { guildId, volume: level }, userId);
  },

  // Player-Status holen
  async getPlayer(guildId, userId = null) {
    return call('GET', `/player?guildId=${guildId}`, null, userId);
  },

  // Queue holen
  async getQueue(guildId, userId = null) {
    return call('GET', `/player/queue?guildId=${guildId}`, null, userId);
  },

  // Verbinden
  async connect(guildId, channelId, userId = null) {
    return call('POST', '/player/connect', { guildId, channelId }, userId);
  },

  async isOnline() {
    try {
      await fetch(`${MUSIC_BOT_URL}/api/status`, { signal: AbortSignal.timeout(2000) });
      return true;
    } catch {
      return false;
    }
  },
};
