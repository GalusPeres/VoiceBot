import { Client, GatewayIntentBits, Events } from 'discord.js';
import { logger } from './utils/logger.js';
import { parseCommand } from './services/commandParser.js';
import { parseIntentWithLLM, initLLM, isLLMReady } from './services/llm.js';
import { initTTS } from './services/tts.js';
import { handleIntent } from './services/commandHandler.js';
import { joinVoice, leaveVoice } from './services/voiceManager.js';
import { startApiServer, trackCommand } from './api/server.js';
import { COMMAND_PREFIX, MENTION_ONLY, CONTROL_CHANNEL_ID } from './utils/constants.js';

// ─── Discord Client ───────────────────────────────────────────────────────────

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.GuildVoiceStates,
    GatewayIntentBits.MessageContent,
  ],
});

// ─── Hilfe Text ───────────────────────────────────────────────────────────────

const HELP_TEXT = `**🎙️ VoiceBot – Befehle**

**Voice (Sprachkanal)**
\`.join\` – Bot kommt in deinen Sprachkanal und hört zu
\`.leave\` – Bot verlässt den Sprachkanal
Danach einfach sprechen – der Bot versteht dich!

**🎵 Musik**
\`spiel [Song/Artist]\` · \`pause\` · \`weiter\` · \`stop\`
\`skip\` · \`lautstärke [0-100]\` · \`lauter\` · \`leiser\`
\`was läuft\` · \`queue\`

**🔊 Sounds**
\`sound [name]\` · \`stopp sound\``;

// ─── Text Command Handler ─────────────────────────────────────────────────────

async function handleTextCommand(message, text) {
  const guildId = message.guild?.id;
  if (!guildId) return;

  const voiceChannelId = message.member?.voice?.channel?.id || null;
  const userId = message.author.id;

  // Voice join/leave
  if (/^(join|hör|hör zu|listen|komm)$/i.test(text)) {
    const vc = message.member?.voice?.channel;
    if (!vc) { await message.reply('❌ Du musst in einem Sprachkanal sein.'); return; }
    joinVoice(vc);
    await message.reply(`✅ Verbunden mit **${vc.name}** — ich höre zu!`);
    trackCommand(true);
    return;
  }

  if (/^(leave|tschüss|raus|disconnect|geh)$/i.test(text)) {
    const left = leaveVoice(guildId);
    await message.reply(left ? '👋 Verlasse den Sprachkanal.' : '❌ Bin in keinem Sprachkanal.');
    trackCommand(true);
    return;
  }

  if (/^(hilfe?|help|\?)$/i.test(text)) {
    await message.reply(HELP_TEXT);
    trackCommand(true);
    return;
  }

  // Erst schnelle Pattern-Erkennung
  let parsed = await parseCommand(text);

  // Wenn unklar → LLM
  if (!parsed || parsed.intent === 'unknown') {
    if (!isLLMReady()) {
      await message.reply('⏳ KI wird noch geladen, bitte kurz warten...');
      trackCommand(false);
      return;
    }
    parsed = await parseIntentWithLLM(text);
  }

  if (!parsed || parsed.intent === 'unknown') {
    await message.reply('❓ Das habe ich nicht verstanden. Schreib `.hilfe` für Befehle.');
    trackCommand(false);
    return;
  }

  const needsVoice = ['play_music', 'play_sound'].includes(parsed.intent);
  if (needsVoice && !voiceChannelId) {
    await message.reply('❌ Du musst in einem Sprachkanal sein.');
    trackCommand(false);
    return;
  }

  try {
    const loadingMsg = parsed.intent === 'play_music'
      ? await message.reply('🔍 Suche...')
      : null;

    const response = await handleIntent(parsed, guildId, voiceChannelId, userId);

    if (loadingMsg) {
      await loadingMsg.edit(response ? `▶️ ${response}` : '✅ Erledigt.');
    } else if (response) {
      await message.reply(response);
    }

    trackCommand(true);
  } catch (err) {
    logger.error('[CMD] Fehler:', err.message);
    await message.reply(`❌ Fehler: ${err.message}`).catch(() => {});
    trackCommand(false);
  }
}

// ─── Message Listener ─────────────────────────────────────────────────────────

client.on(Events.MessageCreate, async (message) => {
  if (message.author.bot) return;
  if (!message.guild) return;
  if (CONTROL_CHANNEL_ID && message.channelId !== CONTROL_CHANNEL_ID) return;

  const myId = client.user?.id;
  const mentioned = myId && message.mentions.users.has(myId);
  let text = message.content.trim();

  if (MENTION_ONLY) {
    if (!mentioned) return;
    text = text.replace(/<@!?\d+>/g, '').trim();
    if (!text) return;
  } else {
    if (mentioned) {
      text = text.replace(/<@!?\d+>/g, '').trim();
    } else if (text.startsWith(COMMAND_PREFIX)) {
      text = text.slice(COMMAND_PREFIX.length).trim();
    } else {
      return;
    }
    if (!text) return;
  }

  await handleTextCommand(message, text);
});

// ─── Ready ────────────────────────────────────────────────────────────────────

client.once(Events.ClientReady, async () => {
  logger.info(`✅ VoiceBot eingeloggt als ${client.user.tag}`);
  logger.info(`📡 Präfix: "${COMMAND_PREFIX}" | Mention-only: ${MENTION_ONLY}`);

  // LLM + TTS im Hintergrund laden
  initLLM().catch(err => logger.error('[Init] LLM:', err.message));
  initTTS().catch(err => logger.error('[Init] TTS:', err.message));
});

client.on(Events.Error, err => logger.error('[Discord]', err.message));

// ─── Start ────────────────────────────────────────────────────────────────────

const token = process.env.DISCORD_TOKEN;
if (!token) {
  logger.error('❌ DISCORD_TOKEN fehlt in .env');
  process.exit(1);
}

startApiServer(client);
client.login(token);
