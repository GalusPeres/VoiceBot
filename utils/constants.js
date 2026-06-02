import path from 'path';

export const DATA_DIR         = process.env.DATA_DIR         || './data';
export const MUSIC_BOT_URL    = process.env.MUSIC_BOT_URL    || 'http://localhost:3001';
export const SOUND_BOT_URL    = process.env.SOUND_BOT_URL    || 'http://localhost:3002';
export const BOT_API_TOKEN    = process.env.BOT_API_TOKEN    || '';
export const BOT_API_PORT     = Number(process.env.BOT_API_PORT) || 3003;
export const BOT_USERNAME     = process.env.BOT_USERNAME     || 'VoiceBot';
export const COMMAND_PREFIX   = process.env.COMMAND_PREFIX   || '.';
export const MENTION_ONLY     = process.env.MENTION_ONLY === 'true';
export const CONTROL_CHANNEL_ID = process.env.CONTROL_CHANNEL_ID || '';

// Model paths (in mounted /data folder)
export const WHISPER_MODEL    = process.env.WHISPER_MODEL    || 'small';
export const LLM_MODEL_PATH   = process.env.LLM_MODEL_PATH   || path.join(DATA_DIR, 'models', 'llm', 'Qwen3.5-2B-Q4_K_M.gguf');
export const PIPER_BIN        = process.env.PIPER_BIN        || '/app/piper/piper';
export const PIPER_MODEL_PATH = process.env.PIPER_MODEL_PATH || path.join(DATA_DIR, 'models', 'tts', 'de_DE-thorsten-medium.onnx');
export const TMP_DIR          = path.join(DATA_DIR, 'temp');
