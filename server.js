#!/usr/bin/env node
import http from 'http';
import readline from 'readline';
import { exec } from 'child_process';
import './src/routes/auth.js';
import './src/routes/tree.js';
import './src/routes/files.js';
import './src/routes/events.js';

import { router } from './src/router.js';
import { PORT, HOST, ROOT } from './src/config.js';
import { SESSION_TOKEN } from './src/auth.js';

function openBrowser(url) {
  // On Windows the first quoted argument to `start` is the window title
  const cmd = process.platform === 'win32' ? 'start ""' :
              process.platform === 'darwin' ? 'open' : 'xdg-open';
  exec(`${cmd} "${url}"`);
}

if (!Number.isInteger(PORT) || PORT < 1 || PORT > 65535) {
  console.error(`\n  Invalid port: ${process.argv[3]}\n`);
  process.exit(1);
}

const server = http.createServer((req, res) => router.handle(req, res));

server.on('error', err => {
  if (err.code === 'EADDRINUSE') {
    console.error(`\n  Port ${PORT} is already in use.\n`);
    process.exit(1);
  }
  throw err;
});

server.listen(PORT, HOST, () => {
  const url = `http://localhost:${PORT}/?token=${SESSION_TOKEN}`;
  console.log(`\n  mdatlas running at ${url}`);
  console.log(`  root: ${ROOT}\n`);

  if (!process.stdin.isTTY) return;

  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  rl.question('  Press ENTER to open in the browser… ', () => {
    rl.close();
    openBrowser(url);
  });
});
