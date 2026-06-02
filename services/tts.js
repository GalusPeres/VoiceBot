import { spawn } from 'child_process';
import { createWriteStream, createReadStream, mkdirSync, unlink, existsSync } from 'fs';
import path from 'path';
import { Readable } from 'stream';
import { createAudioResource, StreamType, createAudioPlayer, AudioPlayerStatus } from '@discordjs/voice';
import { PIPER_BIN, PIPER_MODEL_PATH, TMP_DIR, DATA_DIR } from '../utils/constants.js';
import { logger } from '../utils/logger.js';

// Piper TTS Modell-URLs
const PIPER_MODEL_URL      = 'https://huggingface.co/rhasspy/piper-voices/resolve/main/de/de_DE/thorsten/medium/de_DE-thorsten-medium.onnx';
const PIPER_MODEL_JSON_URL = 'https://huggingface.co/rhasspy/piper-voices/resolve/main/de/de_DE/thorsten/medium/de_DE-thorsten-medium.onnx.json';

// ─── Model Download ───────────────────────────────────────────────────────────

async function downloadFile(url, destPath) {
  const res = await fetch(url, { redirect: 'follow' });
  if (!res.ok) throw new Error(`Download ${url} fehlgeschlagen: ${res.status}`);
  mkdirSync(path.dirname(destPath), { recursive: true });
  const fileStream = createWriteStream(destPath);
  await new Promise((resolve, reject) => {
    Readable.fromWeb(res.body).pipe(fileStream);
    fileStream.on('finish', resolve);
    fileStream.on('error', reject);
  });
}

export async function initTTS() {
  if (!existsSync(PIPER_MODEL_PATH)) {
    logger.info('[TTS] Lade Piper-Stimme (de_DE-thorsten-medium)...');
    await downloadFile(PIPER_MODEL_URL, PIPER_MODEL_PATH);
    await downloadFile(PIPER_MODEL_JSON_URL, PIPER_MODEL_PATH + '.json');
    logger.info('[TTS] Piper-Stimme geladen ✅');
  } else {
    logger.info('[TTS] Piper-Stimme bereits vorhanden ✅');
  }
}

// ─── Synthesize ───────────────────────────────────────────────────────────────

function synthesize(text) {
  return new Promise((resolve, reject) => {
    mkdirSync(TMP_DIR, { recursive: true });
    const outFile = path.join(TMP_DIR, `tts_${Date.now()}.wav`);

    const child = spawn(PIPER_BIN, [
      '--model', PIPER_MODEL_PATH,
      '--output_file', outFile,
    ]);

    child.stdin.write(text);
    child.stdin.end();

    child.on('close', (code) => {
      if (code !== 0) return reject(new Error(`Piper exit code ${code}`));
      resolve(outFile);
    });

    child.on('error', (err) => {
      reject(new Error(`Piper nicht gefunden: ${err.message}. PIPER_BIN korrekt?`));
    });
  });
}

// ─── Play in Voice Channel ────────────────────────────────────────────────────

function playWav(wavFile, connection) {
  return new Promise((resolve) => {
    const player = createAudioPlayer();
    const resource = createAudioResource(wavFile, { inputType: StreamType.Arbitrary });

    player.play(resource);
    connection.subscribe(player);

    player.on(AudioPlayerStatus.Idle, resolve);
    player.on('error', (err) => {
      logger.error('[TTS] Player-Fehler:', err.message);
      resolve();
    });

    setTimeout(resolve, 15000); // Fallback
  });
}

// ─── Main Export ──────────────────────────────────────────────────────────────

export async function speak(text, connection) {
  if (!text || !connection) return;

  if (!existsSync(PIPER_BIN)) {
    logger.warn('[TTS] Piper-Binary nicht gefunden, überspringe TTS');
    return;
  }

  try {
    logger.info(`[TTS] Spreche: "${text}"`);
    const wavFile = await synthesize(text);
    await playWav(wavFile, connection);
    unlink(wavFile, () => {});
  } catch (err) {
    logger.error('[TTS] Fehler:', err.message);
  }
}
