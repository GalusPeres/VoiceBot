import { nodewhisper } from 'nodejs-whisper';
import path from 'path';
import fs from 'fs';
import { spawnSync } from 'child_process';
import { DATA_DIR, WHISPER_MODEL } from '../utils/constants.js';
import { logger } from '../utils/logger.js';

const MODEL_DIR  = path.join(DATA_DIR, 'models', 'whisper');
const MODEL_FILE = path.join(MODEL_DIR, `ggml-${WHISPER_MODEL}.bin`);
const MODEL_URL  = `https://huggingface.co/ggerganov/whisper.cpp/resolve/main/ggml-${WHISPER_MODEL}.bin`;

// nodejs-whisper sucht das Modell immer hier (fest im Code verdrahtet)
const NW_MODEL_DIR  = '/app/node_modules/nodejs-whisper/cpp/whisper.cpp/models';
const NW_MODEL_FILE = path.join(NW_MODEL_DIR, `ggml-${WHISPER_MODEL}.bin`);

process.env.WHISPER_MODEL_DIR = MODEL_DIR;

let modelReady = false;

export async function initSTT() {
  fs.mkdirSync(MODEL_DIR, { recursive: true });
  fs.mkdirSync(NW_MODEL_DIR, { recursive: true });

  if (!fs.existsSync(MODEL_FILE)) {
    logger.info(`[STT] Lade Whisper-Modell (${WHISPER_MODEL}) herunter — bitte warten...`);
    const r = spawnSync('wget', ['-q', '-O', MODEL_FILE, MODEL_URL], { stdio: 'inherit' });
    if (r.status !== 0) {
      fs.rmSync(MODEL_FILE, { force: true });
      throw new Error('[STT] Modell-Download fehlgeschlagen');
    }
    logger.info('[STT] Whisper-Modell heruntergeladen ✅');
  }

  // Symlink damit nodejs-whisper das Modell am erwarteten Pfad findet
  if (!fs.existsSync(NW_MODEL_FILE)) {
    fs.symlinkSync(MODEL_FILE, NW_MODEL_FILE);
    logger.info('[STT] Symlink gesetzt ✅');
  }

  modelReady = true;
  logger.info('[STT] Whisper bereit ✅');
}

export async function transcribe(audioFilePath) {
  if (!fs.existsSync(audioFilePath)) {
    logger.warn('[STT] Audio-Datei nicht gefunden:', audioFilePath);
    return '';
  }
  if (!modelReady) {
    logger.warn('[STT] Modell noch nicht bereit');
    return '';
  }

  try {
    logger.info('[STT] Transkribiere...');
    const result = await nodewhisper(audioFilePath, {
      modelName: WHISPER_MODEL,
      removeWavFileAfterTranscription: false,
      withCuda: false,
      whisperOptions: {
        language: 'auto',
        outputInText: true,
        translateToEnglish: false,
      },
    });

    const text = (result || '').trim()
      .replace(/\[.*?\]/g, '')
      .replace(/\(.*?\)/g, '')
      .trim();

    logger.info(`[STT] Ergebnis: "${text}"`);
    return text;
  } catch (err) {
    logger.error('[STT] Fehler:', err.message);
    return '';
  }
}
