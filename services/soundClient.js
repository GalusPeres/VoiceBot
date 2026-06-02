import { SOUND_BOT_URL, BOT_API_TOKEN } from '../utils/constants.js';
import { logger } from '../utils/logger.js';

function headers(userId = null) {
  const h = { 'Content-Type': 'application/json' };
  if (BOT_API_TOKEN) h['authorization'] = `Bearer ${BOT_API_TOKEN}`;
  if (userId) h['x-dashboard-user-id'] = userId;
  return h;
}

async function call(method, path, body = null, userId = null) {
  const url = `${SOUND_BOT_URL}/api${path}`;
  const opts = { method, headers: headers(userId) };
  if (body) opts.body = JSON.stringify(body);
  const res = await fetch(url, opts);
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: res.statusText }));
    throw new Error(err.error || res.statusText);
  }
  return res.json().catch(() => null);
}

export const soundClient = {
  // Sound abspielen
  async play(guildId, channelId, sound, userId = null) {
    return call('POST', '/play', { guildId, channelId, sound }, userId);
  },

  // Sound stoppen
  async stop(guildId, userId = null) {
    return call('POST', '/play/stop', { guildId }, userId);
  },

  // Alle verfügbaren Sounds holen
  async getSounds() {
    return call('GET', '/sounds');
  },

  async isOnline() {
    try {
      await fetch(`${SOUND_BOT_URL}/api/status`, { signal: AbortSignal.timeout(2000) });
      return true;
    } catch {
      return false;
    }
  },
};
