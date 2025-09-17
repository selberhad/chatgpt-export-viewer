# Changelog

All notable changes to this project are documented here.

This project adheres to Semantic Versioning and follows the spirit of Keep a Changelog.

## [Unreleased]

- Planned: export-all conversations command
- Planned: CI workflow for lint/format checks
- Planned: small demo (GIF/asciinema) and expanded troubleshooting

## [1.0.0] - 2025-09-17

- Added: `gptbrowser` — conversation list + reader with live search (`/`, `n/N`) and plain-text export (`e`).
- Added: `browsezip` — two-pane ZIP browser with metadata panel, inline JSON preview, and external open.
- Added: `zipmeta`, `listzip`, `jsontree`, `tuilist`, `mapping-reduce` utilities for composable workflows.
- Added: cross-platform external open helper (macOS/Linux/Windows) and shared TUI search (`makeListSearch`).
- Added: transcript export helper (`exportConversationPlain`) and shared wrapping (`wrapLines`).
- Added: ESLint (flat config) + Prettier, and publishing polish (bin entries, files whitelist, repo links).
- Added: documentation — README with Quick Start, CODE_MAP, BLOG_POST, and kickoff context.

---

[Unreleased]: https://github.com/selberhad/chatgpt-export-viewer/compare/v1.0.0...HEAD
[1.0.0]: https://github.com/selberhad/chatgpt-export-viewer/releases/tag/v1.0.0

