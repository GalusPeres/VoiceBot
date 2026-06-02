import {
  joinVoiceChannel,
  VoiceConnectionStatus,
  EndBehaviorType,
  createAudioPlayer,
} from '@discordjs/voice';
import prism from 'prism-media';
import fs from 'fs';
import path from 'path';
import { TMP_DIR } from '../utils/constants.js';
import { logger } from '../utils/logger.js';
import { transcribe } from './stt.js';
import { parseIntentWithLLM } from './llm.js';
import { parseCommand } from './commandParser.js';
import { handleIntent } from './commandHandler.js';
import { speak } from './tts.js';

// Aktive Verbindungen pro Guild
const connections = new Map();

// ─── WAV Helper ───────────────────────────────────────────────────────────────

function saveWav(filePath, pcmBuffer, sampleRate = 16000, channels = 1) {
  const bitDepth = 16;
  const byteRate = sampleRate * channels * (bitDepth / 8);
  const blockAlign = channels * (bitDepth / 8);
  const dataSize = pcmBuffer.length;

  const header = Buffer.alloc(44);
  header.write('RIFF', 0);
  header.writeUInt32LE(dataSize + 36, 4);
  header.write('WAVE', 8);
  header.write('fmt ', 12);
  header.writeUInt32LE(16, 16);
  header.writeUInt16LE(1, 20);         // PCM
  header.writeUInt16LE(channels, 22);
  header.writeUInt32LE(sampleRate, 24);
  header.writeUInt32LE(byteRate, 28);
  header.writeUInt16LE(blockAlign, 32);
  header.writeUInt16LE(bitDepth, 34);
  header.write('data', 36);
  header.writeUInt32LE(dataSize, 40);

  fs.writeFileSync(filePath, Buffer.concat([header, pcmBuffer]));
}

// ─── Audio Verarbeitung ───────────────────────────────────────────────────────

async function processAudio(pcmBuffer, userId, guild) {
  if (pcmBuffer.length < 8000) return; // Zu kurz, ignorieren

  fs.mkdirSync(TMP_DIR, { recursive: true });
  const wavFile = path.join(TMP_DIR, `voice_${userId}_${Date.now()}.wav`);

  try {
    saveWav(wavFile, pcmBuffer);

    // 1. Sprache → Text
    const text = await transcribe(wavFile);
    if (!text || text.length < 2) return;

    logger.info(`[Voice] "${guild.members.cache.get(userId)?.displayName || userId}": ${text}`);

    // 2. Text → Intent (zuerst schnelle Pattern-Erkennung, dann LLM)
    let parsed = await parseCommand(text);
    if (!parsed || parsed.intent === 'unknown') {
      parsed = await parseIntentWithLLM(text);
    }
    if (!parsed || parsed.intent === 'unknown') return;

    // 3. Voice Channel des Users
    const member = guild.members.cache.get(userId);
    const channelId = member?.voice?.channelId;

    // 4. Befehl ausführen
    const response = await handleIntent(parsed, guild.id, channelId, userId);
    if (!response) return;

    // 5. Antwort sprechen
    const entry = connections.get(guild.id);
    if (entry?.connection) {
      await speak(response, entry.connection);
    }

    // 6. Text-Log in System-Channel
    const textChannel = guild.systemChannel ||
      guild.channels.cache.find(c => c.type === 0 && c.permissionsFor(guild.members.me)?.has('SendMessages'));
    textChannel?.send(`🎙️ **${member?.displayName || userId}**: *${text}*\n→ ${response}`).catch(() => {});

  } finally {
    fs.unlink(wavFile, () => {});
  }
}

// ─── User Audio Subscription ──────────────────────────────────────────────────

function subscribeUser(receiver, userId, guild) {
  if (receiver.subscriptions.has(userId)) return;

  const audioStream = receiver.subscribe(userId, {
    end: { behavior: EndBehaviorType.AfterSilence, duration: 1200 },
  });

  const decoder = new prism.opus.Decoder({ rate: 16000, channels: 1, frameSize: 960 });
  const chunks = [];

  audioStream.pipe(decoder);

  decoder.on('data', chunk => chunks.push(chunk));

  decoder.on('end', async () => {
    if (chunks.length === 0) return;
    const pcm = Buffer.concat(chunks);
    try {
      await processAudio(pcm, userId, guild);
    } catch (err) {
      logger.error('[Voice] Verarbeitungsfehler:', err.message);
    }
  });

  audioStream.on('error', err => logger.error('[Voice] Stream-Fehler:', err.message));
}

// ─── Connection Setup ─────────────────────────────────────────────────────────

function setupReceiver(connection, guild) {
  const receiver = connection.receiver;
  receiver.speaking.on('start', userId => {
    // Bot-eigene Audio ignorieren
    if (userId === guild.members.me?.id) return;
    subscribeUser(receiver, userId, guild);
  });
}

// ─── Public API ───────────────────────────────────────────────────────────────

export function joinVoice(channel) {
  const guildId = channel.guild.id;

  if (connections.has(guildId)) {
    logger.info(`[Voice] Bereits verbunden in "${channel.name}"`);
    return connections.get(guildId).connection;
  }

  const connection = joinVoiceChannel({
    channelId: channel.id,
    guildId: channel.guild.id,
    adapterCreator: channel.guild.voiceAdapterCreator,
    selfDeaf: false,   // WICHTIG: false = Bot hört zu
    selfMute: false,
  });

  connections.set(guildId, { connection, channel });

  connection.on(VoiceConnectionStatus.Ready, () => {
    logger.info(`[Voice] ✅ Verbunden mit "${channel.name}" — höre zu`);
    setupReceiver(connection, channel.guild);
  });

  connection.on(VoiceConnectionStatus.Disconnected, () => {
    logger.info(`[Voice] Verbindung getrennt (Guild: ${guildId})`);
    connections.delete(guildId);
  });

  connection.on('error', err => logger.error('[Voice] Fehler:', err.message));

  return connection;
}

export function leaveVoice(guildId) {
  const entry = connections.get(guildId);
  if (!entry) return false;
  try {
    entry.connection.destroy();
  } catch (_) {}
  connections.delete(guildId);
  logger.info(`[Voice] Verlasse Guild ${guildId}`);
  return true;
}

export function getConnection(guildId) {
  return connections.get(guildId)?.connection || null;
}

export function isConnected(guildId) {
  return connections.has(guildId);
}
