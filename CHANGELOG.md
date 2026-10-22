# Changelog

All notable changes to this project will be documented in this file.
Format based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/).

## [3.1.0] - 2026-10-22

### Added
- Create new `.md` files from the UI: a **+** in the sidebar header and on each folder opens a New File dialog
- The dialog browses folders one level at a time (capped at 100 per level, filtered as you type), so it works in large repos and in folders without any markdown yet
- Missing folders in the path are created, and the dialog says which ones before you confirm
- New files open in the editor with a heading taken from the file name
- Folders in the tree expand to show the selected file
- `POST /api/file` creates a file (409 if it already exists, never overwrites) and `GET /api/dirs` lists a folder's subfolders

### Changed
- Header actions redesigned to match the sidebar's icon buttons: an icon Read/Edit switch, and an icon Save button that turns blue with a dot when there are unsaved changes. Save keeps its place in read mode, so the switch doesn't move
- The light/dark theme toggle moved to the sidebar header, next to New file and Refresh

### Fixed
- `Ctrl/⌘+I` didn't switch back to read mode while the cursor was in the editor (the shortcut fired twice and cancelled itself out)

## [3.0.0] - 2026-10-22

Version 2.1.0 was tagged but never published to npm; its changes are included here.

### Breaking changes
- The server listens on `127.0.0.1` only. To reach it from another machine, set `MDATLAS_HOST=0.0.0.0`
- The file API serves only existing `.md` files outside hidden and excluded directories. Requests for other files return 403, and saving a file that doesn't exist returns 404 instead of creating it

### Added
- Mermaid diagram rendering for ` ```mermaid ` fenced code blocks in read mode
- Diagrams follow the light/dark theme toggle
- Mermaid loads only when a document contains a diagram
- Save conflict detection: if a file changed on disk since it was opened, saving asks before overwriting it
- `MDATLAS_HOST` environment variable to choose the listen interface

### Changed
- All frontend libraries are bundled in `public/vendor/` and served locally. The UI no longer contacts any CDN, loads instantly and works offline
- `npm run vendor` (`scripts/vendor.js`) downloads the pinned library versions, the single place to upgrade them
- Icons are bundled as SVGs for only the icons the UI uses (10 KB) instead of the full Tabler icon font (about 890 KB)
- Vue pinned to 3.5.13 (was the floating `vue@3`), loaded through a module shim instead of an inline import map
- Server errors without a known status return a generic 500 message instead of the raw error
- Invalid port arguments exit with a clear message

### Fixed
- Session token now uses `node:crypto`, so the server starts on Node 18 as `engines` declares
- Opening the browser on Windows (`start` was treating the URL as the window title)
- Path guard uses the platform path separator, so it works on Windows
- Missing files return 404 instead of a 500 that included the absolute path
- The logo icon on the login screen and in the empty "select a file" state was blank (`ti-brand-markdown` doesn't exist in Tabler Icons)
- The refresh button's loading spin animation was never defined

### Security
- Rendered markdown is sanitized with DOMPurify; raw HTML in a `.md` file could previously run scripts in the UI
- The page sends a Content Security Policy allowing only same-origin scripts, styles and fonts (no inline scripts), plus `X-Content-Type-Options: nosniff` and `Referrer-Policy: no-referrer`
- File API restricted as described above; it previously allowed reading and writing any file under the root (e.g. `.env`, `.git/hooks/*`)
- Symlinks are resolved and rejected if they point outside the root
- Token file is written with `0600` permissions (existing files are tightened on startup)
- Token comparison is constant-time
- Request bodies are limited to 10 MB

## [2.0.0] - 2026-04-29

### Added
- Sticky page header — stays visible while scrolling
- Per-document scroll position memory (restored when switching back to a file)
- Auto-open browser on server launch with Enter-to-confirm prompt
- Server disconnect overlay — informs user when the server stops
- Persistent session token stored in `~/.mdatlas/token` (survives server restarts)
- Custom SVG logo in the sidebar
- Keyboard shortcuts: `Ctrl/Cmd+S` save, `Ctrl/Cmd+I` toggle edit/read, `F1` shortcuts modal
- Shortcuts modal using Tabler modal component
- Syntax highlighting for fenced code blocks via highlight.js (auto-detects language when unspecified)
- CodeMirror list bullet markers rendered in a distinct color from list text

### Changed
- All rendered markdown links open in a new tab
- Action buttons reorganised as a proper Tabler button group
- Sidebar and page headers aligned to a consistent height using a shared CSS variable
- Sidebar header uses custom SVG logo replacing the default icon
- Markdown theme extracted into a swappable CSS file (`/css/markdown/`)
- highlight.js loaded from cdnjs to ensure the UMD browser bundle is served

### Fixed
- `min-w-0` missing from Tabler — added explicitly to fix flex truncation on long file paths
- `h2` page title not truncating — fixed with `d-block` to override Tabler's flex display
- Page header shadow bleeding above sticky position — switched to `page-header-border` class
- CodeMirror blank editor on first open — added missing `overlay.min.js` addon

## [1.0.0] - 2026-04-29

Initial release.

### Added
- File tree sidebar with collapsible folders and drag-to-resize
- Markdown read mode with GitHub-style rendering
- CodeMirror editor with Dracula dark theme
- Light / dark mode toggle
- Save via API with unsaved-changes indicator (dirty dot)
- Token-based auth gate
- Server-Sent Events keepalive
