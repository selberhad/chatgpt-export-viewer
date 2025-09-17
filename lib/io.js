// lib/io.js — shared IO utilities (ESM)
import { stdin as input, stderr as err } from 'node:process';
import fsp from 'node:fs/promises';
import path from 'node:path';

export function emitError(type, message, hint) {
  try {
    err.write(JSON.stringify({ type, message, hint }) + '\n');
  } catch {
    err.write('{"type":"' + type + '","message":' + JSON.stringify(message) + '}\n');
  }
}

export async function readStdin() {
  return new Promise((resolve, reject) => {
    let data = '';
    input.setEncoding('utf8');
    input.on('data', c => (data += c));
    input.on('end', () => resolve(data));
    input.on('error', reject);
  });
}

export async function resolvePathFromArgOrStdin({ argIndex = 2, key = 'zip_path' } = {}) {
  const arg = process.argv[argIndex];
  if (arg && typeof arg === 'string') return arg;
  const raw = await readStdin();
  let payload;
  try {
    payload = JSON.parse(raw || '{}');
  } catch {
    throw new Error('ERR_INPUT_INVALID');
  }
  if (!payload || typeof payload[key] !== 'string' || !payload[key])
    throw new Error('missing path');
  return payload[key];
}

export function jsonParseSafe(text) {
  try {
    return { ok: true, value: JSON.parse(text) };
  } catch (e) {
    return { ok: false, error: e };
  }
}

// Sanitize a title into a safe base filename
export function safeFilename(title, max = 120) {
  const base = String(title || 'conversation')
    .trim()
    .replace(/[\s]+/g, ' ')
    .slice(0, max);
  const safe = base
    .replace(/[\\\/:*?"<>|]/g, '_')
    .replace(/[\u0000-\u001f]/g, '_')
    .replace(/^\.+$/, 'conversation');
  return safe || 'conversation';
}

// Ensure directory exists (mkdir -p)
export async function ensureDir(dirPath) {
  await fsp.mkdir(dirPath, { recursive: true });
}

// Create a unique file path under a directory with base name and extension
// Returns the full path, does not write the file itself
export async function writeFileUnique(dir, base, ext, content) {
  await ensureDir(dir);
  let candidate = path.join(dir, `${base}${ext}`);
  let n = 1;
  while (true) {
    try {
      await fsp.access(candidate);
      candidate = path.join(dir, `${base} (${n++})${ext}`);
    } catch {
      break;
    }
  }
  await fsp.writeFile(candidate, content);
  return candidate;
}
