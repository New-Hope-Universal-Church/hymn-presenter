const fs   = require('fs');
const path = require('path');
const { app } = require('electron');

let logPath = null;

// ─────────────────────────────────────────────
// Setup — call once after app.whenReady()
// ─────────────────────────────────────────────
function setupLogger() {
  const logDir = path.join(app.getPath('userData'), 'logs');
  if (!fs.existsSync(logDir)) fs.mkdirSync(logDir, { recursive: true });

  // One log file per day: nhuc-2026-03-08.log
  const date = new Date().toISOString().slice(0, 10);
  logPath = path.join(logDir, `nhuc-${date}.log`);

  // Rotate — keep only last 7 log files
  rotateLogs(logDir);

  // Write session header
  write('INFO', `═══ NHUC Hymn Projector v${app.getVersion()} ═══`);
  write('INFO', `Session started: ${new Date().toLocaleString()}`);
  write('INFO', `Log file: ${logPath}`);

  // Intercept console.log and console.error
  const origLog   = console.log.bind(console);
  const origError = console.error.bind(console);
  const origWarn  = console.warn.bind(console);

  console.log = (...args) => {
    origLog(...args);
    write('INFO', args.map(stringify).join(' '));
  };

  console.error = (...args) => {
    origError(...args);
    write('ERROR', args.map(stringify).join(' '));
  };

  console.warn = (...args) => {
    origWarn(...args);
    write('WARN', args.map(stringify).join(' '));
  };

  // Catch uncaught exceptions
  process.on('uncaughtException', (err) => {
    write('FATAL', `Uncaught Exception: ${err.message}\n${err.stack}`);
  });

  process.on('unhandledRejection', (reason) => {
    const msg = reason instanceof Error
      ? `${reason.message}\n${reason.stack}`
      : String(reason);
    write('FATAL', `Unhandled Rejection: ${msg}`);
  });

  return logPath;
}

// ─────────────────────────────────────────────
// Write a line to the log file
// ─────────────────────────────────────────────
function write(level, message) {
  if (!logPath) return;
  const timestamp = new Date().toISOString().replace('T', ' ').slice(0, 23);
  const line      = `[${timestamp}] [${level.padEnd(5)}] ${message}\n`;
  try {
    fs.appendFileSync(logPath, line, 'utf8');
  } catch {
    // If logging fails, silently ignore — don't crash the app
  }
}

// ─────────────────────────────────────────────
// Keep only last 7 daily log files
// ─────────────────────────────────────────────
function rotateLogs(logDir) {
  try {
    const files = fs.readdirSync(logDir)
      .filter(f => f.startsWith('nhuc-') && f.endsWith('.log'))
      .sort()
      .reverse();

    files.slice(7).forEach(f => {
      fs.unlinkSync(path.join(logDir, f));
    });
  } catch { /* ignore */ }
}

// ─────────────────────────────────────────────
// Stringify anything for logging
// ─────────────────────────────────────────────
function stringify(val) {
  if (val instanceof Error) return `${val.message}\n${val.stack}`;
  if (typeof val === 'object') {
    try { return JSON.stringify(val); } catch { return String(val); }
  }
  return String(val);
}

// ─────────────────────────────────────────────
// Get log file path (for showing user where it is)
// ─────────────────────────────────────────────
function getLogPath() { return logPath; }

module.exports = { setupLogger, getLogPath, write };