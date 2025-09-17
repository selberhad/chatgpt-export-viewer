# ChatGPT Archive Browser (Terminal)

A fast, keyboard-friendly terminal browser for ChatGPT export ZIPs. Ships as small CLI tools you can compose or run directly.

## Requirements

- Node.js 18+ (tested on macOS)
- Dependencies: `terminal-kit`, `yauzl`, `string-kit` (already in package-lock if you ran install)

## Install deps

```
npm install
```

## Linting & Formatting

- Lint: `npm run lint` (ESLint)
- Auto-fix: `npm run lint:fix`
- Format: `npm run format` (Prettier)
- Check format: `npm run format:check`

## Tools

### 1) `zipmeta` — emit ZIP metadata as JSON

- Usage:
  - `npm run zipmeta -- zips/export.zip > entries.json`
  - or `printf '{"zip_path":"zips/export.zip"}' | npm run zipmeta -- > entries.json`
- Output: JSON array of entries with fields:
  - `name`, `compressed_size`, `uncompressed_size`, `method`, `crc32`, `is_directory`, `last_modified`

### 2) `listzip` — scrollable list of ZIP entries

- Usage:
  - `npm run listzip -- zips/export.zip`
  - or `printf '{"zip_path":"zips/export.zip"}' | npm run listzip --`
- Keys: arrows to move; Enter exits.

### 3) `browsezip` — list + metadata + preview/open

- Usage:
  - `npm run browsezip -- zips/export.zip`
- Behavior:
  - Left: instant-scroll list of entries
  - Right: live-updating metadata panel
  - Enter: inline JSON tree (extracts to temp, opens viewer, cleans up on exit)
  - o: open highlighted entry externally (uses system opener on your OS; caches under `/tmp/archive-browser/...`)
  - Search in list: `/` find with live highlight, `n/N` jump next/prev match
  - v: GPT archive view (if `conversations.json` exists at the ZIP root)
  - q: quit

### 4) `jsontree` — JSON tree viewer

- Usage:
  - `npm run jsontree -- some.json`
  - or `cat some.json | npm run jsontree -- -`
- Keys (universal + laptop friendly):
  - Move: arrows or `j`/`k`
  - Expand/Collapse: arrows or `l`/`h` (Enter/Space toggles)
  - Top/Bottom: `g` / `G`
  - Page up/down: `u`/`d` (or Ctrl+U/Ctrl+D)
  - Quit: `q`

### 5) `tuilist` — render a list from stdin JSON

- Usage:
  - `echo '["a.json","b.json"]' | npm run tuilist --`
- Keys: arrows to move; Enter exits.

### 6) `gptbrowser` — browse and read ChatGPT conversations

- Usage:
  - `npm run gptbrowser -- zips/export.zip`
- Conversation list:
  - Loads titles from `conversations.json` and shows a fast, scrollable list.
  - Keys: `↑/↓` or `j/k` move, `Enter` open, `e` export, `q` quit.
  - Search: `/` enter search mode (live, case-insensitive), `ESC` cancel, `Enter` accept; `n`/`N` jump next/prev match.
  - Match highlighting: yellow background on matching substrings while typing and after accepting a query.
- Conversation view (message reader):
  - Renders the whole conversation as one large, wrapped text panel.
  - Colors: user in cyan, assistant in magenta.
  - Keys: `↑/↓` or `j/k` scroll, `u/d` or `Ctrl-U/Ctrl-D` page, `g/G` top/bottom, `]`/`[` next/prev message, `e` export, `q` back.
  - Search in text: `/` enter search mode, live matches with yellow highlight, `ESC` cancel, `Enter` accept; `n/N` jump next/prev match.
  - Export: saves plain text to `<title>.txt` using the same formatting shown in the viewer (no colors).

## Notes

- Cursor restore: all tools restore the cursor on exit (even on Ctrl-C) to avoid a hidden cursor in your terminal.
- Temp files:
  - Inline JSON preview extracts the selected file to a unique temp dir and cleans it up after you exit the viewer.
  - External open (`o`) extracts to `/tmp/archive-browser/...` and leaves files in place as a convenience cache.
- External open: cross-platform support via system openers (`open`, `xdg-open`, `start`).
- Determinism:
  - CLIs favor JSON I/O and streaming where possible. Errors print structured JSON to stderr on fatal failures.

## Examples

- List first three entries as JSON:

```
npm run zipmeta -- zips/export.zip | node -e "let d='';process.stdin.on('data',c=>d+=c).on('end',()=>{const a=JSON.parse(d);console.log(a.slice(0,3))})"
```

- Browse and open externally:

```
npm run browsezip -- zips/export.zip   # arrows to navigate, Enter for inline JSON tree, 'o' to open, 'q' to quit
```

## Troubleshooting

- Arrow keys don’t work: ensure your terminal is in normal mode and keys aren’t remapped.
- Hidden cursor after crash: run `reset` or any tool again; cursor restore is installed globally in these tools.
- Large JSON: inline viewer uses a file on disk and parses it in the viewer; for huge/complex HTML/images, use `o` to open externally.

---

You can run the CLIs directly after a global install, or via npx:

- Global: `npm i -g chatgpt-export-viewer` then run `gptbrowser`, `browsezip`, etc.
- npx: `npx -y -p chatgpt-export-viewer gptbrowser zips/export.zip`
