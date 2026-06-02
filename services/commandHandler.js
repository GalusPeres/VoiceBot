import { musicClient } from './musicClient.js';
import { soundClient } from './soundClient.js';
import { logger } from '../utils/logger.js';

export async function handleIntent(intent, guildId, channelId, userId) {
  const { intent: action, params = {} } = intent;
  logger.info(`[Handler] ${action} | guild=${guildId} channel=${channelId}`);

  const needsChannel = ['play_music', 'play_sound'].includes(action);
  if (needsChannel && !channelId) {
    return 'Du musst in einem Sprachkanal sein.';
  }

  try {
    switch (action) {

      case 'play_music': {
        const q = params.query;
        if (!q) return 'Was soll ich abspielen?';
        await musicClient.play(guildId, channelId, q, userId);
        return `Spiele ${q}.`;
      }

      case 'pause':
        await musicClient.pause(guildId, userId);
        return 'Musik pausiert.';

      case 'resume':
        await musicClient.resume(guildId, userId);
        return 'Musik weiter.';

      case 'stop_music':
        await musicClient.stop(guildId, userId);
        return 'Musik gestoppt.';

      case 'skip':
        await musicClient.skip(guildId, userId);
        return 'Übersprungen.';

      case 'volume': {
        const lvl = Math.min(100, Math.max(0, Number(params.level) || 50));
        await musicClient.volume(guildId, lvl, userId);
        return `Lautstärke auf ${lvl} Prozent.`;
      }

      case 'volume_up': {
        const p = await musicClient.getPlayer(guildId, userId).catch(() => null);
        const nv = Math.min(100, (p?.volume ?? 50) + 10);
        await musicClient.volume(guildId, nv, userId);
        return `Lauter. Jetzt ${nv} Prozent.`;
      }

      case 'volume_down': {
        const p = await musicClient.getPlayer(guildId, userId).catch(() => null);
        const nv = Math.max(0, (p?.volume ?? 50) - 10);
        await musicClient.volume(guildId, nv, userId);
        return `Leiser. Jetzt ${nv} Prozent.`;
      }

      case 'play_sound': {
        const name = params.name;
        if (!name) return 'Welchen Sound?';
        await soundClient.play(guildId, channelId, name, userId);
        return `Sound ${name}.`;
      }

      case 'stop_sound':
        await soundClient.stop(guildId, userId);
        return 'Sound gestoppt.';

      case 'now_playing': {
        const p = await musicClient.getPlayer(guildId, userId).catch(() => null);
        if (!p?.current) return 'Gerade läuft nichts.';
        return `Gerade läuft ${p.current.title}${p.current.author ? ' von ' + p.current.author : ''}.`;
      }

      case 'queue': {
        const p = await musicClient.getPlayer(guildId, userId).catch(() => null);
        if (!p?.queue?.length) return 'Die Warteschlange ist leer.';
        return `${p.queue.length} Songs. Als nächstes: ${p.queue[0]?.title}.`;
      }

      case 'unknown':
        return 'Das habe ich nicht verstanden.';

      default:
        return null;
    }
  } catch (err) {
    logger.error(`[Handler] Fehler bei ${action}:`, err.message);
    return 'Es ist ein Fehler aufgetreten.';
  }
}
