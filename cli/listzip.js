#!/usr/bin/env node
// listzip_v3 — list entries in a ZIP using shared listMenu with optional search
import { emitError, resolvePathFromArgOrStdin } from '../lib/io.js';
import { listNames } from '../lib/zip.js';
import { term, ensureCursorOnExit, listMenu, makeListSearch } from '../lib/terminal.js';

async function runMenu(items) {
  term.clear();
  const search = makeListSearch(items, {
    footerKeys: ['q=quit', '/ find', 'n/N next/prev', 'Enter exit'],
  });
  await listMenu(items, {
    x: 1,
    y: 1,
    width: term.width - 2,
    height: Math.max(5, term.height - 2),
    style: term.white,
    selectedStyle: term.black.bgWhite,
    onHighlight: search.onHighlight,
    onKey: search.onKey,
    getHighlightQuery: search.getHighlightQuery,
  });
}

async function main() {
  let zipPath;
  try {
    zipPath = await resolvePathFromArgOrStdin({ key: 'zip_path' });
  } catch {
    emitError('ERR_INPUT', 'missing path', 'argv <file.zip> or stdin {"zip_path":"..."}');
    process.exit(1);
  }
  try {
    const items = await listNames(zipPath);
    await runMenu(items);
    process.exit(0);
  } catch (e) {
    emitError('ERR_ZIP', 'zip processing failed', String((e && e.message) || e));
    process.exit(1);
  }
}

main();
ensureCursorOnExit();
