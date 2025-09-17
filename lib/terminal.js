// lib/terminal.js — terminal-kit helpers
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
export const term = require('terminal-kit').terminal;
const { wordwrap } = require('string-kit');

export function cursorToggle() {
  term.hideCursor();
}

export function clearViewport() {
  term.clear();
}

export function paneWidth(frac = 0.55) {
  return Math.max(10, Math.floor(term.width * frac));
}

export function status(text, color = 'gray') {
  try {
    term.saveCursor();
  } catch {}
  try {
    term.moveTo(1, Math.max(1, term.height));
    term.eraseLine();
    if (term[color]) term[color](text);
    else term.gray(text);
  } finally {
    try {
      term.restoreCursor();
    } catch {}
  }
}

// Print text with optional case-insensitive substring highlighting.
// - base: style function to print normal segments (e.g., term.white or term.black.bgWhite)
// - query: case-insensitive substring to highlight
// - highlightBg: terminal-kit background method name (e.g., 'bgYellow')
export function printHighlighted(text, { base, query, highlightBg = 'bgYellow' } = {}) {
  const str = String(text ?? '');
  const printBase = base || term;
  const q = (query || '').toLowerCase();
  if (!q) {
    printBase(str);
    return;
  }
  const lc = str.toLowerCase();
  let start = 0;
  while (start <= lc.length) {
    const pos = lc.indexOf(q, start);
    const chunk = pos === -1 ? str.slice(start) : str.slice(start, pos);
    if (chunk) printBase(chunk);
    if (pos === -1) break;
    const match = str.slice(pos, pos + q.length);
    if (typeof term[highlightBg] === 'function') term[highlightBg](match);
    else term.bgYellow(match);
    start = pos + q.length;
  }
}

// Wrap text into lines without joining; preserves blank lines
export function wrapLines(text, width) {
  const w = Math.max(1, width);
  const lines = String(text || '').split(/\r?\n/);
  const out = [];
  for (const line of lines) {
    const wrapped = wordwrap(line, { width: w, noJoin: true, fill: false });
    if (Array.isArray(wrapped) && wrapped.length) out.push(...wrapped);
    else out.push('');
  }
  return out;
}

export function drawMetaPanel(meta, leftWidth) {
  try {
    term.saveCursor();
  } catch {}
  const rightX = Math.min(term.width, leftWidth + 2);
  const panelWidth = Math.max(10, term.width - rightX - 1);
  const lines = [];
  if (!meta) {
    lines.push('');
  } else {
    lines.push('Name: ' + meta.name);
    lines.push('Dir: ' + (meta.is_directory ? 'yes' : 'no'));
    lines.push('Method: ' + (meta.method ?? ''));
    lines.push(
      'Size: ' +
        (meta.uncompressed_size ?? '') +
        ' (raw), ' +
        (meta.compressed_size ?? '') +
        ' (zip)',
    );
    lines.push('CRC32: ' + (meta.crc32 ?? ''));
    if (meta.last_modified) lines.push('Modified: ' + meta.last_modified);
  }
  for (let row = 1; row <= Math.min(term.height - 1, lines.length + 2); row++) {
    term.moveTo(rightX, row);
    term.eraseLineAfter();
    const text = lines[row - 1] || '';
    if (text) term(text.slice(0, panelWidth));
  }
  try {
    term.restoreCursor();
  } catch {}
}

// Force cursor visible (robust against toggle mismatches)
export function restoreCursor() {
  try {
    term('\x1b[?25h');
  } catch {}
}

// Install process-level handlers to always restore the cursor on exit
export function ensureCursorOnExit() {
  if (ensureCursorOnExit.__installed) return;
  ensureCursorOnExit.__installed = true;
  const restore = () => {
    restoreCursor();
  };
  process.once('exit', restore);
  process.once('SIGINT', () => {
    restore();
    process.exit(130);
  });
  process.once('SIGTERM', () => {
    restore();
    process.exit(143);
  });
  // Ignore EIO on stdin (happens when TTY input is torn down)
  if (process.stdin && typeof process.stdin.on === 'function') {
    process.stdin.on('error', e => {
      if (e && e.code === 'EIO') {
        /* ignore */
      }
    });
  }
  // Restore cursor but do not exit on EIO; allow parent loops to continue
  process.on('uncaughtException', e => {
    restore();
    if (e && e.code === 'EIO') return; // ignore
    process.exit(1);
  });
  process.on('unhandledRejection', () => {
    restore(); /* do not force-exit here */
  });
}

// Unified status line helper for key cheatsheets
export function statusKeys(parts = []) {
  const text = 'keys: ' + parts.join('  ·  ');
  status(text, 'gray');
}

// Standardized search status line
export function statusSearch(prompt = 'Search', query = '', { error = false, hint = '' } = {}) {
  const msg = `${prompt}: ${query || ''}${hint ? '  ' + hint : ''}`;
  status(msg, error ? 'red' : 'gray');
}

// Generic single-column menu wrapper returning a promise
// labels: array of strings to show
// options: terminal-kit singleColumnMenu options (x/y/width/pageSize, styles, etc.)
// onHighlight(ev): optional callback on highlight, receives terminal-kit event payload
// onKey(key): optional key handler; return true if handled to prevent default cancel behavior
export function withMenu(labels, { options = {}, onHighlight, onKey } = {}) {
  return new Promise((resolve, reject) => {
    try {
      cursorToggle();
      const menu = term.singleColumnMenu(labels, options);
      let currentIndex = 0;
      const handleHighlight = ev => {
        const idx = ev && (ev.highlightedIndex ?? ev.selectedIndex);
        if (typeof idx === 'number') currentIndex = idx;
        try {
          onHighlight && onHighlight(ev);
        } catch {}
      };
      const cleanup = type => {
        menu.removeListener && menu.removeListener('highlight', handleHighlight);
        menu.removeListener && menu.removeListener('submit', handleSubmit);
        menu.removeListener && menu.removeListener('cancel', handleCancel);
        term.removeListener && term.removeListener('key', handleKey);
        resolve({ type, index: currentIndex });
      };
      const handleSubmit = () => cleanup('submit');
      const handleCancel = () => cleanup('cancel');
      const handleKey = key => {
        try {
          if (onKey && onKey(key) === true) return; // caller handled key
          if (key === 'q' || key === 'Q') return cleanup('cancel');
        } catch {}
      };
      menu.on('highlight', handleHighlight);
      menu.on('submit', handleSubmit);
      menu.on('cancel', handleCancel);
      term.on('key', handleKey);
    } catch (e) {
      reject(e);
    }
  });
}

// Enter/leave helpers for TUI child processes
export function terminalEnter() {
  try {
    term.hideCursor();
    term.grabInput && term.grabInput(true);
  } catch {}
}
export function terminalLeave() {
  try {
    term.grabInput && term.grabInput(false);
    restoreCursor();
  } catch {}
}

// Draw a fixed-height list viewport (no terminal scrolling)
function drawListSlice({
  labels,
  x = 1,
  y = 1,
  width,
  height,
  selectedIndex,
  scrollOffset,
  style,
  selectedStyle,
  highlightQuery,
}) {
  const w = Math.max(1, width || term.width - x);
  const h = Math.max(1, height || term.height - y);
  for (let row = 0; row < h; row++) {
    const idx = scrollOffset + row;
    term.moveTo(x, y + row);
    term.eraseLineAfter();
    if (idx >= labels.length) continue;
    const raw = String(labels[idx] ?? '');
    const text = raw.length > w ? raw.slice(0, Math.max(0, w - 1)) + '…' : raw.padEnd(w, ' ');
    const base = idx === selectedIndex ? selectedStyle || term.black.bgWhite : style || term.white;
    printHighlighted(text, { base, query: highlightQuery, highlightBg: 'bgYellow' });
  }
}

// Keyboard-driven list menu with fixed viewport scrolling
export function listMenu(
  labels,
  {
    x = 1,
    y = 1,
    width,
    height,
    style,
    selectedStyle,
    onHighlight,
    onKey,
    getHighlightQuery,
    wrap = false,
  } = {},
) {
  return new Promise(resolve => {
    terminalEnter();
    const total = labels.length;
    const w = Math.max(1, width || term.width - x);
    const h = Math.max(1, height || term.height - y);

    if (!wrap) {
      let selectedIndex = 0;
      let scrollOffset = 0;
      const clamp = () => {
        if (selectedIndex < 0) selectedIndex = 0;
        if (selectedIndex >= total) selectedIndex = Math.max(0, total - 1);
        if (selectedIndex < scrollOffset) scrollOffset = selectedIndex;
        if (selectedIndex >= scrollOffset + h) scrollOffset = selectedIndex - h + 1;
        if (scrollOffset < 0) scrollOffset = 0;
        const maxScroll = Math.max(0, total - h);
        if (scrollOffset > maxScroll) scrollOffset = maxScroll;
      };
      const render = () => {
        const highlightQuery =
          typeof getHighlightQuery === 'function' ? getHighlightQuery() || '' : '';
        drawListSlice({
          labels,
          x,
          y,
          width: w,
          height: h,
          selectedIndex,
          scrollOffset,
          style,
          selectedStyle,
          highlightQuery,
        });
        try {
          onHighlight &&
            onHighlight({
              highlightedIndex: selectedIndex,
              highlightedText: labels[selectedIndex],
            });
        } catch {}
      };
      const cleanup = type => {
        term.removeListener('key', onKeyHandler);
        resolve({ type, index: selectedIndex });
      };
      const onKeyHandler = async key => {
        if (onKey) {
          const res = await onKey(key, { selectedIndex, total });
          if (res === true) return; // handled
          if (res && typeof res === 'object') {
            if (typeof res.selectIndex === 'number') {
              selectedIndex = Math.max(0, Math.min(total - 1, res.selectIndex));
              clamp();
              render();
              return;
            }
          }
        }
        switch (key) {
          case 'q':
          case 'Q':
            return cleanup('cancel');
          case 'ENTER':
          case 'KP_ENTER':
            return cleanup('submit');
          case 'UP':
          case 'k':
          case 'K':
            selectedIndex--;
            clamp();
            return render();
          case 'DOWN':
          case 'j':
          case 'J':
            selectedIndex++;
            clamp();
            return render();
          case 'PAGE_UP':
          case 'u':
          case 'CTRL_U':
            selectedIndex -= h;
            clamp();
            return render();
          case 'PAGE_DOWN':
          case 'd':
          case 'CTRL_D':
            selectedIndex += h;
            clamp();
            return render();
          case 'HOME':
          case 'g':
            selectedIndex = 0;
            clamp();
            return render();
          case 'END':
          case 'G':
            selectedIndex = total - 1;
            clamp();
            return render();
        }
      };
      render();
      term.on('key', onKeyHandler);
      return;
    }

    // Wrapped, multi-line per-item mode
    const linesByItem = labels.map(s => {
      const arr = wordwrap(String(s ?? ''), { width: w, noJoin: true, fill: false });
      return Array.isArray(arr) && arr.length ? arr : [''];
    });
    const heights = linesByItem.map(a => a.length);
    const offsets = new Array(heights.length);
    let acc = 0;
    for (let i = 0; i < heights.length; i++) {
      offsets[i] = acc;
      acc += heights[i];
    }
    const totalRows = acc;
    const maxScroll = Math.max(0, totalRows - h);
    let selectedIndex = 0;
    let scrollRow = 0;
    const ensureVisible = () => {
      const topRow = offsets[selectedIndex];
      const bottomRow = topRow + heights[selectedIndex] - 1;
      if (topRow < scrollRow) scrollRow = topRow;
      if (bottomRow >= scrollRow + h) scrollRow = bottomRow - h + 1;
      if (scrollRow < 0) scrollRow = 0;
      if (scrollRow > maxScroll) scrollRow = maxScroll;
    };
    const indexAtRow = row => {
      let lo = 0,
        hi = offsets.length - 1,
        ans = 0;
      while (lo <= hi) {
        const mid = (lo + hi) >> 1;
        if (offsets[mid] <= row) {
          ans = mid;
          lo = mid + 1;
        } else hi = mid - 1;
      }
      return ans;
    };
    const render = () => {
      let row = 0;
      let globalRow = scrollRow;
      let itemIndex = indexAtRow(globalRow);
      let lineIndex = globalRow - offsets[itemIndex];
      while (row < h) {
        term.moveTo(x, y + row);
        term.eraseLineAfter();
        if (globalRow >= totalRows) {
          row++;
          globalRow++;
          continue;
        }
        const isSelected = itemIndex === selectedIndex;
        const text = linesByItem[itemIndex][lineIndex] || '';
        const padded = text.length > w ? text.slice(0, w) : text + ' '.repeat(w - text.length);
        if (isSelected) (selectedStyle || term.black.bgWhite)(padded);
        else (style || term.white)(padded);
        row++;
        globalRow++;
        lineIndex++;
        if (lineIndex >= heights[itemIndex]) {
          itemIndex++;
          lineIndex = 0;
        }
      }
      try {
        onHighlight && onHighlight({ highlightedIndex: selectedIndex });
      } catch {}
    };
    const cleanup = type => {
      term.removeListener('key', onKeyHandler);
      resolve({ type, index: selectedIndex });
    };
    const onKeyHandler = key => {
      if (onKey && onKey(key) === true) return;
      switch (key) {
        case 'q':
        case 'Q':
          return cleanup('cancel');
        case 'ENTER':
        case 'KP_ENTER':
          return cleanup('submit');
        case 'UP':
        case 'k':
        case 'K':
          selectedIndex = Math.max(0, selectedIndex - 1);
          ensureVisible();
          return render();
        case 'DOWN':
        case 'j':
        case 'J':
          selectedIndex = Math.min(labels.length - 1, selectedIndex + 1);
          ensureVisible();
          return render();
        case 'PAGE_UP':
        case 'u':
        case 'CTRL_U':
          scrollRow = Math.max(0, scrollRow - h);
          return render();
        case 'PAGE_DOWN':
        case 'd':
        case 'CTRL_D':
          scrollRow = Math.min(maxScroll, scrollRow + h);
          return render();
        case 'HOME':
        case 'g':
          selectedIndex = 0;
          ensureVisible();
          return render();
        case 'END':
        case 'G':
          selectedIndex = labels.length - 1;
          ensureVisible();
          return render();
      }
    };
    ensureVisible();
    render();
    term.on('key', onKeyHandler);
  });
}

// Backward-compat shim: keep named export but route to listMenu with wrap=true
export function listMenuWrapped(labels, opts = {}) {
  return listMenu(labels, { ...opts, wrap: true });
}

// Factory for simple list search behavior shared by CLIs
// Returns handlers suitable for listMenu: { onHighlight, onKey, getHighlightQuery }
// - Supports: '/' to enter search, live highlight while typing, Enter to accept, ESC to cancel, n/N next/prev match
export function makeListSearch(
  items,
  { prompt = 'Search', footerKeys = ['q=quit', '/ find', 'n/N next/prev'] } = {},
) {
  let inSearch = false;
  let searchBuffer = '';
  let lastQuery = '';
  const labels = Array.isArray(items) ? items.map(x => String(x ?? '')) : [];
  const onHighlight = () => {
    inSearch ? statusSearch(prompt, searchBuffer || '') : statusKeys(footerKeys);
  };
  const onKey = (key, { selectedIndex = 0, total = labels.length } = {}) => {
    if (inSearch) {
      if (key === 'ESCAPE') {
        inSearch = false;
        onHighlight();
        return true;
      }
      if (key === 'BACKSPACE') {
        searchBuffer = searchBuffer.slice(0, -1);
        onHighlight();
        return true;
      }
      if (key === 'ENTER' || key === 'KP_ENTER') {
        lastQuery = searchBuffer;
        inSearch = false;
        onHighlight();
        return true;
      }
      if (typeof key === 'string' && key.length === 1 && key >= ' ' && key <= '~') {
        searchBuffer += key;
        onHighlight();
        return true;
      }
      return true; // consume other keys while in search mode
    }
    if (key === '/') {
      inSearch = true;
      searchBuffer = '';
      onHighlight();
      return true;
    }
    if ((key === 'n' || key === 'N') && lastQuery) {
      const q = lastQuery.toLowerCase();
      const dir = key === 'n' ? +1 : -1;
      let i = selectedIndex;
      for (let steps = 0; steps < total; steps++) {
        i += dir;
        if (i < 0) i = total - 1;
        if (i >= total) i = 0;
        if ((labels[i] || '').toLowerCase().includes(q)) return { selectIndex: i };
      }
      statusSearch(prompt, lastQuery, { error: true, hint: '(no match)' });
      return true;
    }
    return false;
  };
  const getHighlightQuery = () => (inSearch ? searchBuffer : lastQuery);
  return { onHighlight, onKey, getHighlightQuery };
}
