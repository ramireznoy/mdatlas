# mdatlas

A zero-dependency Node.js markdown browser and editor. Run it against any directory and get a local web UI to browse and edit your `.md` files.

---

Modern projects accumulate a lot of markdown: architecture decision records, module READMEs, runbooks, API specs, onboarding guides. In a monorepo this gets scattered across dozens of packages, and it's easy to lose track of what documentation exists, let alone keep it up to date.

AI coding assistants have made this even more relevant. Tools like Claude Code, Copilot, and Cursor read your markdown to understand context, your `CLAUDE.md` files, your `ARCHITECTURE.md`, your per-package READMEs. The quality of that documentation directly affects the quality of the code they help you write. But editing raw markdown files one at a time through a file tree or a terminal is friction that makes it easy to skip.

`mdatlas` removes that friction. Point it at your repo root and you get a clean, browsable interface to all your markdown files, across every package, every service, every layer of your monorepo, in your browser, in seconds, with no install and no config. Edit any file in place and save. Use it as your documentation hub while you work, or leave it running alongside your AI assistant so your context docs are always one tab away.

---

## Usage

No install needed, run directly with `npx`:

```bash
npx mdatlas [dir] [port]
```

| Argument | Default | Description |
|---|---|---|
| `dir` | `.` (current directory) | Root directory to serve |
| `port` | `3344` | Port to listen on |

**Example:**

```bash
npx mdatlas ~/notes 4000
```

Then open the URL printed in the terminal:

```
mdatlas running at http://localhost:4000/?token=<session-token>
root: /Users/you/notes
```

## Install globally

```bash
npm install -g mdatlas
mdatlas ~/notes
```

## Security

`mdatlas` is meant to run on your own machine, against directories you trust it to edit.

- **Loopback only.** The server listens on `127.0.0.1`, so it can't be reached from other machines unless you set `MDATLAS_HOST`.
- **Session token.** Every API request must include a token, either as a URL query parameter (`?token=…`) or as a `Bearer` token in the `Authorization` header. The URL printed on startup includes it, so just open it in your browser. The token is stored in `~/.mdatlas/token` (readable only by you) and reused across restarts. Delete that file to generate a new one.
- **Markdown files only.** The file API reads and writes only existing `.md` files inside the root. It refuses anything else, including dotfiles, anything under hidden directories such as `.git`, and excluded directories such as `node_modules`. Symlinks are followed and rejected if they lead outside the root. It never creates files.
- **Sanitized rendering.** Rendered markdown is passed through [DOMPurify](https://github.com/cure53/DOMPurify), and the page sends a Content Security Policy that blocks inline scripts. A hostile `.md` file in a cloned repo can't run scripts in the UI.
- **No silent overwrites.** If a file changes on disk while you're editing it (for example, your AI assistant edited it), saving asks before overwriting those changes.

The UI's libraries (Vue, marked, DOMPurify, CodeMirror, highlight.js, Mermaid, Tabler) are bundled with the package and served from your machine. Nothing is loaded from the internet, so it works offline.

## Configuration

| Environment variable | Default | Description |
|---|---|---|
| `MDATLAS_EXCLUDE` | `README.md,CHANGELOG.md,LICENSE.md,CODE_OF_CONDUCT.md` | Comma-separated filenames to hide from the tree |
| `MDATLAS_EXCLUDE_DIRS` | `node_modules` | Comma-separated directory names to skip entirely |
| `MDATLAS_HOST` | `127.0.0.1` | Interface to listen on. `0.0.0.0` exposes the server to your network |

```bash
MDATLAS_EXCLUDE=CONTRIBUTING.md MDATLAS_EXCLUDE_DIRS=node_modules,dist npx mdatlas .
```

## Roadmap

`mdatlas` is intentionally scoped to reading and editing existing files. This keeps it safe to run in any project as it won't create, rename, or delete anything you didn't already have.

Future versions may expand on this with opt-in capabilities:

- **Create files** add a new `.md` file directly from the UI, at any path within the root
- **Delete files** remove a file with a confirmation step, for cleanup workflows

These are deliberately left out for now. In a shared repo or alongside an AI assistant that's already writing files, a read-and-edit-only tool is the right default it respects the structure the project already has and doesn't step outside its lane.

## Requirements

Node.js >= 18. No dependencies.

## Development

```bash
npm test          # run the test suite
npm run vendor    # re-download the bundled frontend libraries
```

The frontend libraries live in `public/vendor/` and are committed. To upgrade one, change its version in `scripts/vendor.js`, run `npm run vendor`, and commit the result.

## License

MIT
