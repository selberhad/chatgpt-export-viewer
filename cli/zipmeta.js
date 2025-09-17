#!/usr/bin/env node
// zipmeta_v2 — emits ZIP metadata as JSON
import { emitError, resolvePathFromArgOrStdin } from '../lib/io.js';
import { readMetadata } from '../lib/zip.js';

async function main() {
  let zipPath;
  try {
    zipPath = await resolvePathFromArgOrStdin({ key: 'zip_path' });
  } catch {
    emitError('ERR_INPUT', 'missing path', 'argv <file.zip> or stdin {"zip_path":"..."}');
    process.exit(1);
  }

  try {
    const metas = await readMetadata(zipPath);
    process.stdout.write(JSON.stringify(metas));
  } catch (e) {
    const msg = String((e && e.message) || e);
    if (msg.includes('ENOENT')) emitError('ERR_ZIP_NOT_FOUND', 'zip file not found', zipPath);
    else emitError('ERR_ZIP', 'zip processing failed', msg);
    process.exit(1);
  }
}

main();
