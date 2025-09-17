// lib/zip.js — yauzl helpers (ESM)
import { createRequire } from 'node:module';
import fs from 'node:fs';
import fsp from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';

const require = createRequire(import.meta.url);
const yauzl = require('yauzl');

function methodLabel(code) {
  const map = { 0: 'store', 8: 'deflate' };
  return map[code] ?? String(code);
}
function toHex8(n) {
  return typeof n === 'number' && Number.isFinite(n)
    ? (n >>> 0).toString(16).padStart(8, '0')
    : undefined;
}
function isDirectoryName(name) {
  return typeof name === 'string' && /\/$/.test(name);
}

export function listNames(zipPath) {
  return new Promise((resolve, reject) => {
    yauzl.open(zipPath, { lazyEntries: true, autoClose: true }, (openErr, zipFile) => {
      if (openErr) return reject(openErr);
      const names = [];
      zipFile.readEntry();
      zipFile.on('entry', entry => {
        names.push(entry.fileName);
        zipFile.readEntry();
      });
      zipFile.on('end', () => resolve(names));
      zipFile.on('error', reject);
    });
  });
}

export function readMetadata(zipPath) {
  return new Promise((resolve, reject) => {
    yauzl.open(zipPath, { lazyEntries: true, autoClose: true }, (openErr, zipFile) => {
      if (openErr) return reject(openErr);
      const metas = [];
      zipFile.readEntry();
      zipFile.on('entry', entry => {
        const m = {
          name: entry.fileName,
          compressed_size: entry.compressedSize,
          uncompressed_size: entry.uncompressedSize,
          method: methodLabel(entry.compressionMethod),
          crc32: toHex8(entry.crc32),
          is_directory: isDirectoryName(entry.fileName),
        };
        try {
          if (entry.getLastModDate) {
            const d = entry.getLastModDate();
            if (d instanceof Date && !isNaN(d.getTime()))
              m.last_modified = new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString();
          }
        } catch {}
        metas.push(m);
        zipFile.readEntry();
      });
      zipFile.on('end', () => resolve(metas));
      zipFile.on('error', reject);
    });
  });
}

export function readEntryText(zipPath, entryName) {
  return new Promise((resolve, reject) => {
    yauzl.open(zipPath, { lazyEntries: true, autoClose: true }, (openErr, zipFile) => {
      if (openErr) return reject(openErr);
      let done = false;
      const finish = (err, text) => {
        if (done) return;
        done = true;
        err ? reject(err) : resolve(text);
      };
      zipFile.readEntry();
      zipFile.on('entry', entry => {
        if (entry.fileName === entryName) {
          zipFile.openReadStream(entry, (err, readStream) => {
            if (err) return finish(err);
            const chunks = [];
            readStream.on('data', b => chunks.push(b));
            readStream.on('end', () => finish(null, Buffer.concat(chunks).toString('utf8')));
            readStream.on('error', e => finish(e));
          });
        } else {
          zipFile.readEntry();
        }
      });
      zipFile.on('end', () => finish(new Error('entry not found')));
      zipFile.on('error', e => finish(e));
    });
  });
}

export function extractEntry(zipPath, entryName, destPath) {
  return new Promise((resolve, reject) => {
    yauzl.open(zipPath, { lazyEntries: true, autoClose: true }, (openErr, zipFile) => {
      if (openErr) return reject(openErr);
      let done = false;
      zipFile.readEntry();
      zipFile.on('entry', entry => {
        if (entry.fileName === entryName) {
          if (/\/$/.test(entry.fileName)) {
            fsp
              .mkdir(destPath, { recursive: true })
              .then(() => {
                done = true;
                resolve();
              })
              .catch(e => {
                done = true;
                reject(e);
              });
            return;
          }
          zipFile.openReadStream(entry, (err, readStream) => {
            if (err) {
              done = true;
              return reject(err);
            }
            fsp
              .mkdir(path.dirname(destPath), { recursive: true })
              .then(() => {
                const ws = fs.createWriteStream(destPath);
                readStream.on('error', e => {
                  if (!done) {
                    done = true;
                    reject(e);
                  }
                });
                ws.on('error', e => {
                  if (!done) {
                    done = true;
                    reject(e);
                  }
                });
                ws.on('finish', () => {
                  if (!done) {
                    done = true;
                    resolve();
                  }
                });
                readStream.pipe(ws);
              })
              .catch(e => {
                done = true;
                reject(e);
              });
          });
        } else {
          zipFile.readEntry();
        }
      });
      zipFile.on('end', () => {
        if (!done) reject(new Error('entry not found'));
      });
      zipFile.on('error', e => {
        if (!done) reject(e);
      });
    });
  });
}

export async function extractToTemp(zipPath, entryName, prefix = 'archive-browser') {
  const dir = await fsp.mkdtemp(path.join(os.tmpdir(), prefix + '-'));
  const file = path.join(dir, path.basename(entryName));
  await extractEntry(zipPath, entryName, file);
  return { dir, file };
}

export async function cleanupTemp(p) {
  try {
    await fsp.rm(p, { recursive: true, force: true });
  } catch {}
}
