# Changelog

All notable changes to this project will be documented in this file.
Format based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/).

## [2.1.0] - 2026-10-09

### Added
- Mermaid diagram rendering for ` ```mermaid ` fenced code blocks in read mode
- Diagrams follow the light/dark theme toggle
- Mermaid is lazy-loaded from CDN only when a document contains a diagram

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
