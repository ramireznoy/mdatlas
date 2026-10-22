#!/usr/bin/env node
// Downloads the pinned frontend libraries into public/vendor/ so the UI works
// offline and loads from localhost. To upgrade a library, change its version
// here, run `npm run vendor`, and commit the result.
import { mkdir, writeFile, rm } from 'fs/promises';
import { dirname, join, resolve } from 'path';
import { fileURLToPath } from 'url';

const VENDOR_DIR = resolve(dirname(fileURLToPath(import.meta.url)), '..', 'public', 'vendor');
const NPM   = 'https://cdn.jsdelivr.net/npm';
const CDNJS = 'https://cdnjs.cloudflare.com/ajax/libs';

// dir: folder under public/vendor/, files: { localName: sourceUrl }
const LIBS = [
  {
    dir: 'vue',
    files: {
      'vue.esm-browser.prod.js': `${NPM}/vue@3.5.13/dist/vue.esm-browser.prod.js`,
      'LICENSE':                 `${NPM}/vue@3.5.13/LICENSE`,
    },
  },
  {
    dir: 'marked',
    files: {
      'marked.min.js': `${NPM}/marked@9.1.6/marked.min.js`,
      'LICENSE':       `${NPM}/marked@9.1.6/LICENSE.md`,
    },
  },
  {
    dir: 'dompurify',
    files: {
      'purify.min.js': `${CDNJS}/dompurify/3.1.6/purify.min.js`,
      'LICENSE':       `${NPM}/dompurify@3.1.6/LICENSE`,
    },
  },
  {
    dir: 'highlight.js',
    files: {
      'highlight.min.js':   `${CDNJS}/highlight.js/11.9.0/highlight.min.js`,
      'github.min.css':     `${CDNJS}/highlight.js/11.9.0/styles/github.min.css`,
      'github-dark.min.css':`${CDNJS}/highlight.js/11.9.0/styles/github-dark.min.css`,
      'LICENSE':            `${NPM}/highlight.js@11.9.0/LICENSE`,
    },
  },
  {
    dir: 'codemirror',
    files: {
      'codemirror.min.js':       `${CDNJS}/codemirror/5.65.16/codemirror.min.js`,
      'codemirror.min.css':      `${CDNJS}/codemirror/5.65.16/codemirror.min.css`,
      'theme/dracula.min.css':   `${CDNJS}/codemirror/5.65.16/theme/dracula.min.css`,
      'mode/markdown.min.js':    `${CDNJS}/codemirror/5.65.16/mode/markdown/markdown.min.js`,
      'addon/overlay.min.js':    `${CDNJS}/codemirror/5.65.16/addon/mode/overlay.min.js`,
      'LICENSE':                 `${NPM}/codemirror@5.65.16/LICENSE`,
    },
  },
  {
    dir: 'mermaid',
    files: {
      'mermaid.min.js': `${NPM}/mermaid@11.4.1/dist/mermaid.min.js`,
      'LICENSE':        `${NPM}/mermaid@11.4.1/LICENSE`,
    },
  },
  {
    dir: 'tabler',
    files: {
      'tabler.min.css': `${NPM}/@tabler/core@1.0.0-beta21/dist/css/tabler.min.css`,
      'LICENSE':        `${NPM}/@tabler/core@1.0.0-beta21/LICENSE`,
    },
  },
  {
    // The CSS references ./fonts/ relative to itself, so keep that layout.
    // woff2 is listed first and supported by every browser that runs the UI,
    // so the 3 MB of woff/ttf fallbacks are left out.
    dir: 'tabler-icons',
    files: {
      'tabler-icons.min.css':      `${NPM}/@tabler/icons-webfont@3.0.0/dist/tabler-icons.min.css`,
      'fonts/tabler-icons.woff2':  `${NPM}/@tabler/icons-webfont@3.0.0/dist/fonts/tabler-icons.woff2`,
      'LICENSE':                   `${NPM}/@tabler/icons-webfont@3.0.0/LICENSE`,
    },
  },
];

async function download(url, dest) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`${res.status} ${res.statusText}: ${url}`);
  const data = Buffer.from(await res.arrayBuffer());
  await mkdir(dirname(dest), { recursive: true });
  await writeFile(dest, data);
  return data.length;
}

await rm(VENDOR_DIR, { recursive: true, force: true });

let total = 0;
for (const { dir, files } of LIBS) {
  for (const [name, url] of Object.entries(files)) {
    const size = await download(url, join(VENDOR_DIR, dir, name));
    total += size;
    console.log(`  ${(size / 1024).toFixed(0).padStart(6)} KB  ${dir}/${name}`);
  }
}
console.log(`\n  ${(total / 1024 / 1024).toFixed(2)} MB written to public/vendor/`);
