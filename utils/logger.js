const logs = [];
const MAX_LOGS = 500;

export const sseClients = new Set();

function write(level, ...args) {
  const entry = {
    time: new Date().toISOString(),
    level: level.toLowerCase(),
    text: args.join(' '),
  };

  logs.push(entry);
  if (logs.length > MAX_LOGS) logs.shift();

  const fn = level === 'ERROR' ? console.error : level === 'WARN' ? console.warn : console.log;
  fn(`[${new Date(entry.time).toLocaleString('de-DE', { timeZone: 'Europe/Berlin' })}] [${level}] ${entry.text}`);

  // SSE Listeners benachrichtigen
  sseClients.forEach(res => {
    try { res.write(`data: ${JSON.stringify(entry)}\n\n`); } catch (_) {}
  });
}

export const logger = {
  info:    (...a) => write('INFO',  ...a),
  warn:    (...a) => write('WARN',  ...a),
  error:   (...a) => write('ERROR', ...a),
  getLogs: () => [...logs],
};
