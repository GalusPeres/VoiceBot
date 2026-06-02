import { Router } from 'express';
import { COMMAND_PREFIX, MENTION_ONLY, CONTROL_CHANNEL_ID, OLLAMA_URL, OLLAMA_MODEL } from '../../utils/constants.js';

// Laufzeit-Settings (nur im RAM, kein Datei-Schreiben nötig da ENV)
const runtime = {
  COMMAND_PREFIX:     COMMAND_PREFIX,
  MENTION_ONLY:       MENTION_ONLY,
  CONTROL_CHANNEL_ID: CONTROL_CHANNEL_ID,
  OLLAMA_URL:         OLLAMA_URL,
  OLLAMA_MODEL:       OLLAMA_MODEL,
};

const SCHEMA = [
  {
    key: 'COMMAND_PREFIX',
    label: 'Befehl-Präfix',
    description: 'Zeichen mit dem Befehle starten (z.B. .)',
    type: 'string',
    writable: true,
  },
  {
    key: 'MENTION_ONLY',
    label: 'Nur bei @-Erwähnung',
    description: 'Bot reagiert nur wenn er direkt erwähnt wird',
    type: 'boolean',
    writable: true,
  },
  {
    key: 'CONTROL_CHANNEL_ID',
    label: 'Control Channel ID',
    description: 'Nur in diesem Channel antworten (leer = alle)',
    type: 'string',
    writable: true,
  },
  {
    key: 'OLLAMA_URL',
    label: 'Ollama URL',
    description: 'URL des Ollama-Servers (leer = deaktiviert)',
    type: 'string',
    writable: true,
  },
  {
    key: 'OLLAMA_MODEL',
    label: 'Ollama Modell',
    description: 'Welches Modell für KI-Befehlserkennung nutzen',
    type: 'string',
    writable: true,
  },
];

export default function settingsRoutes() {
  const router = Router();

  router.get('/', (req, res) => {
    res.json(
      SCHEMA.map(s => ({
        ...s,
        value: runtime[s.key] ?? '',
        source: 'env',
      }))
    );
  });

  router.get('/schema', (req, res) => {
    res.json(SCHEMA);
  });

  router.put('/', (req, res) => {
    const updates = req.body || {};
    for (const [key, value] of Object.entries(updates)) {
      if (key in runtime) {
        runtime[key] = value;
      }
    }
    res.json({ updated: true, settings: runtime });
  });

  return router;
}
