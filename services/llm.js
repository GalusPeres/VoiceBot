import { getLlama, LlamaChatSession } from 'node-llama-cpp';
import fs from 'fs';
import path from 'path';
import { createWriteStream } from 'fs';
import { Readable } from 'stream';
import { LLM_MODEL_PATH, DATA_DIR } from '../utils/constants.js';
import { logger } from '../utils/logger.js';

// Qwen3.5-2B Q4_K_M von HuggingFace (unsloth)
const MODEL_URL = 'https://huggingface.co/unsloth/Qwen3.5-2B-GGUF/resolve/main/Qwen3.5-2B-Q4_K_M.gguf';

let llama = null;
let model = null;

// ─── Model Download ───────────────────────────────────────────────────────────

async function downloadModel() {
  const dir = path.dirname(LLM_MODEL_PATH);
  fs.mkdirSync(dir, { recursive: true });

  logger.info('[LLM] Lade Qwen3.5-2B-Q4_K_M.gguf herunter (~1.2GB) ...');
  logger.info('[LLM] Das dauert beim ersten Start einige Minuten.');

  const res = await fetch(MODEL_URL, { redirect: 'follow' });
  if (!res.ok) throw new Error(`Download fehlgeschlagen: ${res.status}`);

  const total = Number(res.headers.get('content-length') || 0);
  let loaded = 0;
  let lastLog = 0;

  const fileStream = createWriteStream(LLM_MODEL_PATH);

  await new Promise((resolve, reject) => {
    const readable = Readable.fromWeb(res.body);
    readable.on('data', chunk => {
      loaded += chunk.length;
      const pct = total ? Math.floor((loaded / total) * 100) : '?';
      if (Date.now() - lastLog > 5000) {
        logger.info(`[LLM] Download: ${pct}%`);
        lastLog = Date.now();
      }
    });
    readable.pipe(fileStream);
    fileStream.on('finish', resolve);
    fileStream.on('error', reject);
    readable.on('error', reject);
  });

  logger.info('[LLM] Download abgeschlossen ✅');
}

// ─── Init ─────────────────────────────────────────────────────────────────────

export async function initLLM() {
  try {
    if (!fs.existsSync(LLM_MODEL_PATH)) {
      await downloadModel();
    }

    logger.info('[LLM] Lade Modell in RAM...');
    llama = await getLlama();
    model = await llama.loadModel({ modelPath: LLM_MODEL_PATH });
    logger.info('[LLM] Qwen3.5-2B bereit ✅');
  } catch (err) {
    logger.error('[LLM] Initialisierung fehlgeschlagen:', err.message);
    model = null;
  }
}

// ─── System Prompt ────────────────────────────────────────────────────────────

const SYSTEM_PROMPT = `Du bist ein Befehlsinterpreter für einen Discord-Bot.
Deine einzige Aufgabe: Analysiere die Nutzereingabe und gib NUR ein JSON-Objekt zurück.
Kein erklärender Text, nur JSON.

Mögliche Intents:
- play_music  → params: { "query": "Suchbegriff/Interpret/Song" }
- pause       → params: {}
- resume      → params: {}
- stop_music  → params: {}
- skip        → params: {}
- volume      → params: { "level": 0-100 }
- volume_up   → params: {}
- volume_down → params: {}
- play_sound  → params: { "name": "soundname" }
- stop_sound  → params: {}
- queue       → params: {}
- now_playing → params: {}
- unknown     → params: {}

Beispiele:
"spiel mal was von Drake" → {"intent":"play_music","params":{"query":"Drake"}}
"mach lauter" → {"intent":"volume_up","params":{}}
"nächstes lied bitte" → {"intent":"skip","params":{}}
"was läuft gerade" → {"intent":"now_playing","params":{}}`;

// ─── Parse Intent ─────────────────────────────────────────────────────────────

export async function parseIntentWithLLM(text) {
  if (!model) {
    logger.warn('[LLM] Modell nicht geladen');
    return null;
  }

  try {
    const context = await model.createContext({ contextSize: 1024 });
    const session = new LlamaChatSession({
      contextSequence: context.getSequence(),
      systemPrompt: SYSTEM_PROMPT,
    });

    const response = await session.prompt(
      `Eingabe: "${text}"`,
      { temperature: 0.1, maxTokens: 80 }
    );

    await context.dispose();

    // JSON aus Antwort extrahieren
    const match = response.match(/\{[\s\S]*?\}/);
    if (!match) {
      logger.warn('[LLM] Kein JSON in Antwort:', response);
      return null;
    }

    const parsed = JSON.parse(match[0]);
    logger.info(`[LLM] Intent: ${parsed.intent}`, JSON.stringify(parsed.params || {}));
    return parsed;
  } catch (err) {
    logger.error('[LLM] Fehler:', err.message);
    return null;
  }
}

export function isLLMReady() {
  return model !== null;
}
