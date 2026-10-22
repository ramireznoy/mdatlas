import { readdir, realpath } from 'fs/promises';
import { join, relative, extname, resolve, sep } from 'path';
import { ROOT, EXCLUDE_NAMES, EXCLUDE_DIRS } from './config.js';

const httpError = (status, message) => Object.assign(new Error(message), { status });

export async function buildTree(dir = ROOT, root = ROOT) {
  let entries;
  try {
    entries = await readdir(dir, { withFileTypes: true });
  } catch {
    return [];
  }

  const items = [];
  for (const entry of entries) {
    if (entry.name.startsWith('.')) continue;
    if (EXCLUDE_NAMES.has(entry.name.toLowerCase())) continue;
    const fullPath = join(dir, entry.name);
    const relPath  = relative(root, fullPath);

    if (entry.isDirectory()) {
      if (EXCLUDE_DIRS.has(entry.name.toLowerCase())) continue;
      const children = await buildTree(fullPath, root);
      if (children.length)
        items.push({ type: 'dir', name: entry.name, path: relPath, children });
    } else if (entry.isFile() && extname(entry.name).toLowerCase() === '.md') {
      items.push({ type: 'file', name: entry.name, path: relPath });
    }
  }

  return items.sort((a, b) => {
    if (a.type !== b.type) return a.type === 'dir' ? -1 : 1;
    return a.name.localeCompare(b.name);
  });
}

const isInside = (full, root) => full === root || full.startsWith(root + sep);

// Lexical check only: rejects paths that resolve outside root.
export function guardPath(rel, root = ROOT) {
  const full = resolve(root, rel);
  if (!isInside(full, root)) throw httpError(403, 'Path outside root');
  return full;
}

// Resolves a path the file API may read or write: an existing .md file inside
// root, not under a hidden or excluded directory, with symlinks followed so
// they cannot point outside root.
export async function resolveDocPath(rel, root = ROOT) {
  const full = guardPath(rel, root);
  if (extname(full).toLowerCase() !== '.md')
    throw httpError(403, 'Only .md files are accessible');

  const segments = relative(root, full).split(sep);
  if (segments.some(s => s.startsWith('.') || EXCLUDE_DIRS.has(s.toLowerCase())))
    throw httpError(403, 'Path is hidden or excluded');

  let real;
  try {
    real = await realpath(full);
  } catch (err) {
    if (err.code === 'ENOENT' || err.code === 'ENOTDIR') throw httpError(404, 'File not found');
    throw err;
  }
  if (!isInside(real, await realpath(root))) throw httpError(403, 'Path outside root');
  return real;
}
