const logs = [];
const MAX_LOGS = 500;

function timestamp() {
  return new Date().toLocaleString('de-DE', { timeZone: 'Europe/Berlin' });
}

function write(level, ...args) {
  const line = `[${timestamp()}] [${level}] ${args.join(' ')}`;
  logs.push(line);
  if (logs.length > MAX_LOGS) logs.shift();
  const fn = level === 'ERROR' ? console.error : level === 'WARN' ? console.warn : console.log;
  fn(line);
  // Notify SSE listeners
  sseClients.forEach(res => {
    try { res.write(`data: ${JSON.stringify(line)}\n\n`); } catch (_) {}
  });
}

export const logger = {
  info:  (...a) => write('INFO',  ...a),
  warn:  (...a) => write('WARN',  ...a),
  error: (...a) => write('ERROR', ...a),
  getLogs: () => [...logs],
};

export const sseClients = new Set();
