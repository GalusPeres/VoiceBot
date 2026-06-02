import { Router } from 'express';
import { COMMAND_PREFIX, MENTION_ONLY, CONTROL_CHANNEL_ID } from '../../utils/constants.js';

// Laufzeit-Settings (nur im RAM, kein Datei-Schreiben nötig da ENV)
const runtime = {
  COMMAND_PREFIX:     COMMAND_PREFIX,
  MENTION_ONLY:       MENTION_ONLY,
  CONTROL_CHANNEL_ID: CONTROL_CHANNEL_ID,
};

// Schema im Format das GenericSettingsScreen erwartet: sections[].fields[]
const SCHEMA = {
  sections: [
    {
      id: 'general',
      label: 'Allgemein',
      fields: [
        { key: 'COMMAND_PREFIX',     label: 'Befehl-Präfix',       description: 'Zeichen mit dem Befehle starten (z.B. !)', type: 'string',  editable: true },
        { key: 'MENTION_ONLY',       label: 'Nur bei @-Erwähnung', description: 'Bot reagiert nur wenn er direkt erwähnt wird', type: 'boolean', editable: true },
        { key: 'CONTROL_CHANNEL_ID', label: 'Control Channel ID',  description: 'Nur in diesem Channel antworten (leer = alle)', type: 'string',  editable: true },
      ],
    },
  ],
};

export default function settingsRoutes() {
  const router = Router();

  // GET /api/settings → { KEY: value, ... }
  router.get('/', (req, res) => {
    res.json({ ...runtime });
  });

  // GET /api/settings/schema → { sections: [...] }
  router.get('/schema', (req, res) => {
    res.json(SCHEMA);
  });

  // PUT /api/settings → update runtime values
  router.put('/', (req, res) => {
    const updates = req.body || {};
    for (const [key, value] of Object.entries(updates)) {
      if (key in runtime) runtime[key] = value;
    }
    res.json({ updated: true, settings: { ...runtime } });
  });

  return router;
}
