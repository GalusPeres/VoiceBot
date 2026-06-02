import { OLLAMA_URL, OLLAMA_MODEL } from '../utils/constants.js';
import { logger } from '../utils/logger.js';

// ─── Pattern-basiertes Parsing ───────────────────────────────────────────────

const PATTERNS = [
  // Musik abspielen
  {
    intent: 'play_music',
    patterns: [
      /^spiel(?:e|en)?\s+(?:mir\s+)?(?:etwas\s+von\s+)?(.+)/i,
      /^play\s+(.+)/i,
      /^leg(?:e)?\s+(.+?)\s+auf/i,
      /^mach\s+(.+?)\s+an/i,
      /^hör(?:e)?\s+(?:dir\s+)?(.+)/i,
    ],
    extract: (m) => ({ query: m[1].trim() }),
  },

  // Pause
  {
    intent: 'pause',
    patterns: [
      /^paus(?:e|iere|ieren)?$/i,
      /^halt(?:e)?$/i,
      /^stopp?\s+kurz$/i,
      /^warte?$/i,
    ],
    extract: () => ({}),
  },

  // Weiter / Resume
  {
    intent: 'resume',
    patterns: [
      /^weiter(?:machen)?$/i,
      /^resume$/i,
      /^fortsetzen?$/i,
      /^wieder\s+an$/i,
      /^weiterspielen?$/i,
    ],
    extract: () => ({}),
  },

  // Musik stoppen
  {
    intent: 'stop_music',
    patterns: [
      /^stopp?\s*(?:die\s+)?(?:musik)?$/i,
      /^stop\s*(?:music)?$/i,
      /^aufhör(?:en)?$/i,
      /^aus(?:machen)?$/i,
      /^beenden?$/i,
    ],
    extract: () => ({}),
  },

  // Skip
  {
    intent: 'skip',
    patterns: [
      /^skip(?:pe)?$/i,
      /^nächstes?$/i,
      /^next$/i,
      /^überspringen?$/i,
      /^weiter(?:\s+(?:lied|song|track))?$/i,
    ],
    extract: () => ({}),
  },

  // Lautstärke
  {
    intent: 'volume',
    patterns: [
      /^lautstärke\s+(?:auf\s+)?(\d+)/i,
      /^volume\s+(?:auf\s+)?(\d+)/i,
      /^vol(?:ume)?\s+(\d+)/i,
      /^auf\s+(\d+)\s*(?:%|prozent)?/i,
    ],
    extract: (m) => ({ level: Math.min(100, Math.max(0, parseInt(m[1]))) }),
  },
  {
    intent: 'volume_up',
    patterns: [/^lauter$/i, /^louder$/i, /^volume\s+up$/i],
    extract: () => ({}),
  },
  {
    intent: 'volume_down',
    patterns: [/^leiser$/i, /^quieter$/i, /^volume\s+down$/i],
    extract: () => ({}),
  },

  // Sound abspielen
  {
    intent: 'play_sound',
    patterns: [
      /^sound\s+(.+)/i,
      /^spiel(?:e)?\s+(?:den\s+)?sound\s+(.+)/i,
      /^mach\s+(?:den\s+)?(.+?)\s+sound/i,
    ],
    extract: (m) => ({ name: m[1].trim().toLowerCase() }),
  },

  // Sound stoppen
  {
    intent: 'stop_sound',
    patterns: [/^stopp?\s+sound$/i, /^stop\s+sound$/i],
    extract: () => ({}),
  },

  // Queue anzeigen
  {
    intent: 'queue',
    patterns: [
      /^queue$/i,
      /^warteschlange$/i,
      /^was\s+kommt\s+(?:noch|als\s+nächstes)?$/i,
      /^was\s+(?:spielt|läuft)\s+(?:noch)?$/i,
      /^playlist$/i,
    ],
    extract: () => ({}),
  },

  // Was spielt gerade
  {
    intent: 'now_playing',
    patterns: [
      /^was\s+(?:spielt|läuft)\s+(?:gerade|da)?$/i,
      /^(?:aktuell|gerade)\?$/i,
      /^now\s+playing$/i,
      /^was\s+ist\s+das$/i,
    ],
    extract: () => ({}),
  },

  // Hilfe
  {
    intent: 'help',
    patterns: [/^hilfe?$/i, /^help$/i, /^befehle?$/i, /^commands?$/i, /^\?$/],
    extract: () => ({}),
  },
];

// ─── Ollama Fallback ──────────────────────────────────────────────────────────

async function parseWithOllama(text) {
  if (!OLLAMA_URL) return null;
  try {
    const prompt = `Du bist ein Discord-Bot-Befehls-Parser. Der Nutzer hat geschrieben: "${text}"

Erkenne den Befehl und gib NUR gültiges JSON zurück — kein Text davor oder danach.

Mögliche Intents:
- play_music: Musik abspielen (params: { query: "Suchbegriff" })
- pause: Musik pausieren (params: {})
- resume: Musik fortsetzen (params: {})
- stop_music: Musik stoppen (params: {})
- skip: Nächstes Lied (params: {})
- volume: Lautstärke setzen (params: { level: 0-100 })
- volume_up: Lauter (params: {})
- volume_down: Leiser (params: {})
- play_sound: Sound-Effekt abspielen (params: { name: "soundname" })
- stop_sound: Sound stoppen (params: {})
- queue: Warteschlange anzeigen (params: {})
- now_playing: Aktuellen Song anzeigen (params: {})
- unknown: Unbekannter Befehl (params: {})

Antworte NUR mit: {"intent": "...", "params": {...}}`;

    const res = await fetch(`${OLLAMA_URL}/api/generate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ model: OLLAMA_MODEL, prompt, stream: false }),
      signal: AbortSignal.timeout(8000),
    });

    if (!res.ok) return null;
    const data = await res.json();
    const raw = data.response?.trim();
    const match = raw?.match(/\{[\s\S]*\}/);
    if (!match) return null;
    const parsed = JSON.parse(match[0]);
    if (!parsed.intent) return null;
    logger.info(`[Ollama] Intent erkannt: ${parsed.intent}`);
    return parsed;
  } catch (err) {
    logger.warn(`[Ollama] Fehler: ${err.message}`);
    return null;
  }
}

// ─── Haupt-Export ─────────────────────────────────────────────────────────────

export async function parseCommand(text) {
  const clean = text.trim();

  // Pattern-Matching zuerst (schnell + zuverlässig)
  for (const { intent, patterns, extract } of PATTERNS) {
    for (const pattern of patterns) {
      const m = clean.match(pattern);
      if (m) {
        const params = extract(m);
        logger.info(`[Parser] Pattern-Match: "${clean}" → ${intent} ${JSON.stringify(params)}`);
        return { intent, params };
      }
    }
  }

  // Ollama als Fallback
  const ollamaResult = await parseWithOllama(clean);
  if (ollamaResult) return ollamaResult;

  logger.info(`[Parser] Nicht erkannt: "${clean}"`);
  return { intent: 'unknown', params: {} };
}
