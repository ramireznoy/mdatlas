import { readFileSync, writeFileSync, mkdirSync, chmodSync } from 'fs';
import { createHash, randomUUID, timingSafeEqual } from 'crypto';
import { join } from 'path';
import { homedir } from 'os';

const TOKEN_DIR  = join(homedir(), '.mdatlas');
const TOKEN_FILE = join(TOKEN_DIR, 'token');

// The token is reused across restarts; delete ~/.mdatlas/token to rotate it.
function loadOrCreateToken() {
  mkdirSync(TOKEN_DIR, { recursive: true, mode: 0o700 });
  try {
    const token = readFileSync(TOKEN_FILE, 'utf8').trim();
    if (token) {
      chmodSync(TOKEN_FILE, 0o600); // tighten files written by older versions
      return token;
    }
  } catch {}
  const token = randomUUID();
  writeFileSync(TOKEN_FILE, token, { encoding: 'utf8', mode: 0o600 });
  return token;
}

export const SESSION_TOKEN = loadOrCreateToken();

// Hashing first gives equal-length buffers, so timingSafeEqual never throws.
const digest = s => createHash('sha256').update(s).digest();
const TOKEN_DIGEST = digest(SESSION_TOKEN);
const matches = candidate => timingSafeEqual(digest(candidate), TOKEN_DIGEST);

export function isAuthorized(req) {
  const auth = (req.headers['authorization'] ?? '').trim();
  if (auth.startsWith('Bearer ')) return matches(auth.slice(7).trim());
  return matches(new URL(req.url, 'http://x').searchParams.get('token') ?? '');
}
