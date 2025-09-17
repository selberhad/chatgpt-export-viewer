#!/usr/bin/env node
// tuilist_v3 — scrollable list from stdin JSON array of strings using shared listMenu
import { emitError, readStdin } from '../lib/io.js';
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
  ensureCursorOnExit();
  let items;
  try {
    const raw = await readStdin();
    const parsed = JSON.parse(raw || '[]');
    if (!Array.isArray(parsed) || !parsed.every(x => typeof x === 'string'))
      throw new Error('expected JSON array of strings');
    items = parsed;
  } catch {
    emitError(
      'ERR_INPUT_INVALID',
      'stdin must be JSON array of strings',
      'e.g., ["a.json","b.json"]',
    );
    process.exit(1);
  }

  try {
    await runMenu(items);
    process.exit(0);
  } catch (e) {
    emitError('ERR_TUI_INIT', 'terminal init failed', String((e && e.message) || e));
    process.exit(1);
  }
}

main();
