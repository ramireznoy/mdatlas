import { readFile, access } from 'fs/promises';
import { extname, join, resolve } from 'path';
import { isAuthorized } from './auth.js';
import { PROJECT_DIR } from './config.js';

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.css':  'text/css; charset=utf-8',
  '.js':   'application/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg':  'image/svg+xml',
  '.png':  'image/png',
  '.ico':  'image/x-icon',
  '.woff2':'font/woff2',
};

const routes   = new Map();
const PUB_DIR  = join(PROJECT_DIR, 'public');
const MAX_BODY = 10 * 1024 * 1024;

// Defence in depth for rendered markdown: no inline scripts or event handlers.
// 'unsafe-eval' is needed by Vue's in-browser template compiler.
const CSP = [
  "default-src 'self'",
  "script-src 'self' 'unsafe-eval'",
  "style-src 'self' 'unsafe-inline'",
  "font-src 'self' data:",
  'img-src * data: blob:',
  "connect-src 'self'",
  "object-src 'none'",
  "base-uri 'none'",
  "form-action 'none'",
  "frame-ancestors 'none'",
].join('; ');

const SECURITY_HEADERS = {
  'X-Content-Type-Options': 'nosniff',
  'Referrer-Policy':        'no-referrer',
};

function sendJson(res, data, status = 200) {
  const body = JSON.stringify(data);
  res.writeHead(status, {
    'Content-Type': 'application/json',
    'Content-Length': Buffer.byteLength(body),
    ...SECURITY_HEADERS,
  });
  res.end(body);
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    let size = 0;
    req.on('data', c => {
      size += c.length;
      if (size > MAX_BODY) return reject(Object.assign(new Error('Request body too large'), { status: 413 }));
      chunks.push(c);
    });
    req.on('end', () => {
      if (size > MAX_BODY) return;
      try { resolve(JSON.parse(Buffer.concat(chunks).toString())); }
      catch (e) { reject(Object.assign(e, { status: 400 })); }
    });
    req.on('error', reject);
  });
}

export const router = {
  get:  (path, fn) => routes.set(`GET ${path}`,    fn),
  put:  (path, fn) => routes.set(`PUT ${path}`,    fn),
  post: (path, fn) => routes.set(`POST ${path}`,   fn),
  del:  (path, fn) => routes.set(`DELETE ${path}`, fn),

  async handle(req, res) {
    req.json = () => readBody(req);
    res.json = (data, status) => sendJson(res, data, status);

    const { pathname } = new URL(req.url, 'http://x');

    if (pathname.startsWith('/api/') && !isAuthorized(req))
      return sendJson(res, { error: 'Unauthorized' }, 401);

    const fn = routes.get(`${req.method} ${pathname}`);
    if (fn) {
      try   { await fn(req, res); }
      catch (err) {
        if (err.status) return sendJson(res, { error: err.message }, err.status);
        console.error(err);
        sendJson(res, { error: 'Internal server error' }, 500);
      }
      return;
    }

    if (req.method === 'GET') {
      const target   = pathname === '/' ? '/index.html' : pathname;
      const filePath = resolve(PUB_DIR, '.' + target);
      if (filePath.startsWith(PUB_DIR + '/')) {
        try {
          await access(filePath);
          const data = await readFile(filePath);
          const mime = MIME[extname(filePath)] ?? 'application/octet-stream';
          const headers = { 'Content-Type': mime, 'Content-Length': data.length, ...SECURITY_HEADERS };
          if (mime.startsWith('text/html')) headers['Content-Security-Policy'] = CSP;
          res.writeHead(200, headers);
          res.end(data);
          return;
        } catch {}
      }
    }

    res.writeHead(404);
    res.end('Not found');
  },
};
