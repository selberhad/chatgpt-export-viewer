#!/usr/bin/env node
// browsezip — left list + right metadata; Enter inline JSON tree; 'o' open externally; 'q' quit; 'v' GPT view
import { emitError, resolvePathFromArgOrStdin } from '../lib/io.js';
import { readMetadata, extractToTemp, cleanupTemp } from '../lib/zip.js';
import { openExternal } from '../lib/open_external.js';
import {
  term,
  ensureCursorOnExit,
  paneWidth,
  drawMetaPanel,
  listMenu,
  terminalEnter,
  terminalLeave,
  status,
  makeListSearch,
} from '../lib/terminal.js';
import { showJsonTreeFile } from '../lib/viewers.js';
import path from 'node:path';
import { spawn } from 'node:child_process';

ensureCursorOnExit();

async function gptView(zipPath) {
  const viewerPath = path.resolve('cli/gptbrowser.js');
  await new Promise((resolve, reject) => {
    const child = spawn(process.execPath, [viewerPath, zipPath], {
      stdio: ['inherit', 'inherit', 'inherit'],
    });
    child.on('error', reject);
    child.on('exit', code =>
      code === 0 ? resolve() : reject(new Error('gptbrowser exit ' + code)),
    );
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
    const metas = await readMetadata(zipPath);
    const names = metas.map(m => m.name);
    const hasGPTArchive = names.includes('conversations.json');
    const leftWidth = paneWidth(0.55);
    let currentIndex = 0;

    while (true) {
      term.clear();
      const footerKeys = ['q=quit', '/ find', 'n/N next/prev', 'Enter=json', 'o=open'];
      if (hasGPTArchive) footerKeys.push('v=GPT');
      const search = makeListSearch(names, { footerKeys });
      const onHighlight = ev => {
        if (ev && typeof ev.highlightedIndex === 'number') currentIndex = ev.highlightedIndex;
        drawMetaPanel(metas[currentIndex], leftWidth);
        search.onHighlight();
      };
      const onKey = async (key, ctx) => {
        if (key === 'o' || key === 'O') {
          const meta = metas[currentIndex];
          if (!meta || meta.is_directory) return true;
          try {
            const { file } = await extractToTemp(zipPath, meta.name, 'archive-browser');
            openExternal(file);
            status('Opened externally: ' + (meta?.name || ''), 'green');
          } catch (e) {
            status('Open failed: ' + String((e && e.message) || e), 'red');
          }
          return true;
        }
        if (key === 'v' || key === 'V') {
          if (!hasGPTArchive) {
            status('GPT view unavailable: conversations.json not found at root', 'red');
            return true;
          }
          try {
            terminalLeave();
            await gptView(zipPath);
            terminalEnter();
            status('Returned from GPT archive view', 'gray');
          } catch (e) {
            terminalEnter();
            status('GPT view failed: ' + String((e && e.message) || e), 'red');
          }
          return true;
        }
        const res = search.onKey(key, ctx);
        if (res === true || (res && typeof res === 'object')) return res;
        return false;
      };
      const res = await listMenu(names, {
        x: 1,
        y: 1,
        width: leftWidth,
        height: Math.max(5, term.height - 2),
        style: term.white,
        selectedStyle: term.black.bgWhite,
        onHighlight,
        onKey,
        getHighlightQuery: search.getHighlightQuery,
      });
      if (res.type !== 'submit') break;

      // Inline JSON preview on submit
      const meta = metas[res.index] || metas[currentIndex];
      if (meta && !meta.is_directory && /\.json$/i.test(meta.name)) {
        try {
          const { dir, file } = await extractToTemp(zipPath, meta.name, 'archive-browser-inline');
          terminalLeave();
          await showJsonTreeFile(file);
          terminalEnter();
          await cleanupTemp(dir);
        } catch (e) {
          terminalEnter();
          status('Preview failed: ' + String((e && e.message) || e), 'red');
        }
      }
    }

    process.exit(0);
  } catch (e) {
    emitError('ERR_ZIP', 'zip processing failed', String((e && e.message) || e));
    process.exit(1);
  }
}

main();
