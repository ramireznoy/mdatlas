import { readdir, realpath, stat, mkdir, writeFile } from 'fs/promises';
import { join, relative, extname, resolve, sep, dirname, basename } from 'path';
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
const isHidden = segment => segment.startsWith('.') || EXCLUDE_DIRS.has(segment.toLowerCase());

// Names that break on some OS: reserved characters, Windows device names,
// and trailing dots or spaces (Windows strips them).
const INVALID_CHARS  = /[<>:"|?*\\\x00-\x1f]/;
const RESERVED_NAMES = /^(con|prn|aux|nul|com[1-9]|lpt[1-9])(\..*)?$/i;
const isInvalidName  = s => INVALID_CHARS.test(s) || RESERVED_NAMES.test(s) || /[. ]$/.test(s);

const segmentsOf = (full, root) => relative(root, full).split(sep).filter(Boolean);

async function assertRealInside(path, root) {
  if (!isInside(await realpath(path), await realpath(root))) throw httpError(403, 'Path outside root');
}

// Walks up from `full` to the nearest path that exists. `missing` holds the
// segments below it that would have to be created.
async function splitExisting(full) {
  const missing = [];
  for (let path = full; ; path = dirname(path)) {
    try {
      return { existing: path, isDir: (await stat(path)).isDirectory(), missing };
    } catch (err) {
      if (err.code !== 'ENOENT' && err.code !== 'ENOTDIR') throw err;
    }
    missing.unshift(basename(path));
  }
}

// Lexical check only: rejects paths that resolve outside root.
export function guardPath(rel, root = ROOT) {
  const full = resolve(root, rel);
  if (!isInside(full, root)) throw httpError(403, 'Path outside root');
  return full;
}

// Lexical checks shared by every file operation: inside root, a .md file, and
// not under a hidden or excluded directory.
function checkDocPath(rel, root) {
  const full = guardPath(rel, root);
  if (extname(full).toLowerCase() !== '.md')
    throw httpError(403, 'Only .md files are accessible');

  const segments = segmentsOf(full, root);
  if (segments.some(isHidden)) throw httpError(403, 'Path is hidden or excluded');
  return { full, segments };
}

// Resolves a path the file API may read or write: an existing .md file that
// passes checkDocPath, with symlinks followed so they cannot point outside root.
export async function resolveDocPath(rel, root = ROOT) {
  const { full } = checkDocPath(rel, root);

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

// Lists the direct subfolders of one folder, for the New File dialog. Reading a
// single level keeps this cheap in large repos. If the folder doesn't exist
// yet, `missing` is the part of the path that creating a file would add.
export async function listDirs(rel = '', prefix = '', root = ROOT, limit = 100) {
  const full = guardPath(rel, root);
  if (segmentsOf(full, root).some(isHidden)) throw httpError(403, 'Path is hidden or excluded');

  const { existing, isDir, missing } = await splitExisting(full);
  await assertRealInside(existing, root);
  if (!isDir) throw httpError(400, `Not a folder: ${relative(root, existing)}`);
  if (missing.length) return { dirs: [], truncated: false, missing: missing.join('/') };

  const lower = prefix.toLowerCase();
  const names = (await readdir(full, { withFileTypes: true }))
    .filter(e => e.isDirectory() && !isHidden(e.name) && e.name.toLowerCase().startsWith(lower))
    .map(e => e.name)
    .sort((a, b) => a.localeCompare(b));
  return { dirs: names.slice(0, limit), truncated: names.length > limit, missing: '' };
}

// Creates a new .md file, adding any missing folders. Never overwrites: an
// existing file gives 409, including one created between the check and the write.
export async function createDoc(rel, content, root = ROOT) {
  const { full, segments } = checkDocPath(rel, root);
  const invalid = segments.find(isInvalidName);
  if (invalid !== undefined) throw httpError(400, `Invalid name: "${invalid}"`);
  const name = segments.at(-1);
  if (EXCLUDE_NAMES.has(name.toLowerCase()))
    throw httpError(403, `${name} is hidden from the tree by MDATLAS_EXCLUDE`);

  const { existing, isDir, missing } = await splitExisting(full);
  if (!missing.length) throw httpError(409, 'File already exists');
  if (!isDir) throw httpError(400, `Not a folder: ${relative(root, existing)}`);
  await assertRealInside(existing, root);

  const target = join(await realpath(existing), ...missing);
  await mkdir(dirname(target), { recursive: true });
  try {
    await writeFile(target, content, { encoding: 'utf-8', flag: 'wx' });
  } catch (err) {
    if (err.code === 'EEXIST') throw httpError(409, 'File already exists');
    throw err;
  }
  return { path: relative(root, full), mtime: (await stat(target)).mtimeMs };
}
