// Minimal levelled logger: "2026-09-27T10:00:00.000Z [INFO] message"
// Kept dependency-free on purpose; swap for pino/winston if logs need shipping.
const isTest = process.env.NODE_ENV === 'test';

function write(level, message, details) {
  if (isTest && level !== 'ERROR') return;
  const line = `${new Date().toISOString()} [${level}] ${message}`;
  const output = level === 'ERROR' ? console.error : level === 'WARN' ? console.warn : console.log;
  if (details !== undefined) output(line, details);
  else output(line);
}

module.exports = {
  info: (message, details) => write('INFO', message, details),
  warn: (message, details) => write('WARN', message, details),
  error: (message, details) => write('ERROR', message, details),
};
