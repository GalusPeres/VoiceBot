import { nodewhisper } from 'nodejs-whisper';
import path from 'path';
import fs from 'fs';
import { DATA_DIR, WHISPER_MODEL } from '../utils/constants.js';
import { logger } from '../utils/logger.js';

// Whisper lädt Modelle automatisch beim ersten Aufruf herunter
process.env.WHISPER_MODEL_DIR = path.join(DATA_DIR, 'models', 'whisper');

export async function transcribe(audioFilePath) {
  if (!fs.existsSync(audioFilePath)) {
    logger.warn('[STT] Audio-Datei nicht gefunden:', audioFilePath);
    return '';
  }

  try {
    logger.info('[STT] Transkribiere...');
    const result = await nodewhisper(audioFilePath, {
      modelName: WHISPER_MODEL,
      autoDownloadModelName: WHISPER_MODEL,
      removeWavFileAfterTranscription: false,
      withCuda: false,
      whisperOptions: {
        language: 'auto',
        outputInText: true,
        translateToEnglish: false,
      },
    });

    const text = (result || '').trim()
      .replace(/\[.*?\]/g, '')   // [BLANK_AUDIO] etc. entfernen
      .replace(/\(.*?\)/g, '')
      .trim();

    logger.info(`[STT] Ergebnis: "${text}"`);
    return text;
  } catch (err) {
    logger.error('[STT] Fehler:', err.message);
    return '';
  }
}
