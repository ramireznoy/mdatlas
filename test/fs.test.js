import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { mkdir, writeFile, readFile, rm, symlink, realpath, stat, readdir } from 'node:fs/promises';
import { join, basename } from 'node:path';
import { tmpdir } from 'node:os';
import { buildTree, guardPath, resolveDocPath, listDirs, createDoc } from '../src/fs.js';

let root, outside;

before(async () => {
  root = join(tmpdir(), `mdatlas-test-${Date.now()}`);
  await mkdir(join(root, 'docs'), { recursive: true });
  await mkdir(join(root, 'empty-dir'), { recursive: true });
  await mkdir(join(root, '.hidden-dir'), { recursive: true });
  await writeFile(join(root, 'intro.md'),        '# Intro');
  await writeFile(join(root, 'notes.md'),        '# Notes');
  await writeFile(join(root, 'ignore.txt'),      'not markdown');
  await writeFile(join(root, 'README.md'),       '# Readme');
  await writeFile(join(root, 'changelog.md'),    '# Changelog');
  await writeFile(join(root, '.hidden.md'),      'hidden');
  await writeFile(join(root, 'docs', 'guide.md'), '# Guide');
  await writeFile(join(root, 'docs', 'api.md'),   '# API');
  await mkdir(join(root, '.git'), { recursive: true });
  await mkdir(join(root, 'node_modules', 'pkg'), { recursive: true });
  await writeFile(join(root, '.git', 'notes.md'),               'hidden');
  await writeFile(join(root, 'node_modules', 'pkg', 'doc.md'),  'excluded');

  // A sibling directory whose name starts with the root's name, plus symlinks
  outside = root + '-evil';
  await mkdir(outside, { recursive: true });
  await writeFile(join(outside, 'secret.md'), 'secret');
  await symlink(join(outside, 'secret.md'), join(root, 'escape.md'));
  await symlink(outside, join(root, 'escape-dir'));
  await symlink(join(root, 'docs', 'guide.md'), join(root, 'alias.md'));
});

after(async () => {
  await rm(root,    { recursive: true, force: true });
  await rm(outside, { recursive: true, force: true });
});

describe('guardPath', () => {
  it('returns the resolved absolute path for a valid relative path', () => {
    assert.equal(guardPath('readme.md', root), join(root, 'readme.md'));
  });

  it('resolves nested relative paths', () => {
    assert.equal(guardPath('docs/guide.md', root), join(root, 'docs', 'guide.md'));
  });

  it('throws 403 for a ../ traversal', () => {
    assert.throws(() => guardPath('../outside.md', root), { message: 'Path outside root' });
  });

  it('sets status 403 on the thrown error', () => {
    try {
      guardPath('../../etc/passwd', root);
      assert.fail('expected an error');
    } catch (e) {
      assert.equal(e.status, 403);
    }
  });
});

describe('resolveDocPath', () => {
  const rejects = (rel, status, message) =>
    assert.rejects(resolveDocPath(rel, root), { status, ...(message && { message }) });

  it('resolves an existing .md file to its real path', async () => {
    assert.equal(await resolveDocPath('docs/guide.md', root), await realpath(join(root, 'docs', 'guide.md')));
  });

  it('rejects non-markdown files', () => rejects('ignore.txt', 403, 'Only .md files are accessible'));

  it('rejects files with no extension, like .env', () => rejects('.env', 403));

  it('rejects files inside hidden directories', () => rejects('.git/notes.md', 403, 'Path is hidden or excluded'));

  it('rejects hidden markdown files', () => rejects('.hidden.md', 403, 'Path is hidden or excluded'));

  it('rejects files inside excluded directories', () => rejects('node_modules/pkg/doc.md', 403, 'Path is hidden or excluded'));

  it('rejects ../ traversal', () => rejects('../outside.md', 403, 'Path outside root'));

  it('rejects a sibling directory that shares the root name as a prefix', () =>
    rejects(`../${basename(outside)}/secret.md`, 403, 'Path outside root'));

  it('rejects a symlinked file that points outside root', () => rejects('escape.md', 403, 'Path outside root'));

  it('rejects a file reached through a symlinked directory outside root', () =>
    rejects('escape-dir/secret.md', 403, 'Path outside root'));

  it('allows a symlink that stays inside root', async () => {
    assert.equal(await resolveDocPath('alias.md', root), await realpath(join(root, 'docs', 'guide.md')));
  });

  it('returns 404 for a missing file without leaking its absolute path', () =>
    rejects('missing.md', 404, 'File not found'));
});

describe('buildTree', () => {
  it('includes .md files at the root level', async () => {
    const tree = await buildTree(root, root);
    const names = tree.filter(n => n.type === 'file').map(n => n.name).sort();
    assert.deepEqual(names, ['intro.md', 'notes.md']);
  });

  it('excludes non-markdown files', async () => {
    const tree = await buildTree(root, root);
    assert.ok(!tree.some(n => n.name === 'ignore.txt'));
  });

  it('excludes hidden files (dot-prefixed)', async () => {
    const tree = await buildTree(root, root);
    assert.ok(!tree.some(n => n.name === '.hidden.md'));
  });

  it('excludes hidden directories', async () => {
    const tree = await buildTree(root, root);
    assert.ok(!tree.some(n => n.name === '.hidden-dir'));
  });

  it('omits empty directories', async () => {
    const tree = await buildTree(root, root);
    assert.ok(!tree.some(n => n.name === 'empty-dir'));
  });

  it('sorts directories before files', async () => {
    const tree = await buildTree(root, root);
    const firstDir = tree.findIndex(n => n.type === 'dir');
    const firstFile = tree.findIndex(n => n.type === 'file');
    assert.ok(firstDir < firstFile, 'dirs should come before files');
  });

  it('recursively includes files in subdirectories', async () => {
    const tree = await buildTree(root, root);
    const docs = tree.find(n => n.name === 'docs');
    assert.ok(docs, 'docs directory should be present');
    assert.deepEqual(docs.children.map(f => f.name).sort(), ['api.md', 'guide.md']);
  });

  it('uses paths relative to root', async () => {
    const tree = await buildTree(root, root);
    const docs = tree.find(n => n.name === 'docs');
    const guide = docs.children.find(f => f.name === 'guide.md');
    assert.equal(guide.path, join('docs', 'guide.md'));
  });

  it('excludes filenames in EXCLUDE_NAMES regardless of case', async () => {
    const tree = await buildTree(root, root);
    const names = tree.map(n => n.name);
    assert.ok(!names.includes('README.md'),    'README.md should be excluded');
    assert.ok(!names.includes('changelog.md'), 'changelog.md should be excluded');
  });

  it('returns an empty array for a non-existent directory', async () => {
    assert.deepEqual(await buildTree('/no/such/path', '/no/such/path'), []);
  });
});

describe('listDirs', () => {
  it('lists direct subfolders, sorted, without hidden, excluded or symlinked ones', async () => {
    assert.deepEqual(await listDirs('', '', root), { dirs: ['docs', 'empty-dir'], truncated: false, missing: '' });
  });

  it('filters by a case-insensitive prefix', async () => {
    assert.deepEqual((await listDirs('', 'D', root)).dirs, ['docs']);
  });

  it('caps the list and flags it as truncated', async () => {
    assert.deepEqual(await listDirs('', '', root, 1), { dirs: ['docs'], truncated: true, missing: '' });
  });

  it('reports the part of the path that does not exist yet', async () => {
    assert.deepEqual(await listDirs('docs/adr/2026', '', root), { dirs: [], truncated: false, missing: 'adr/2026' });
  });

  it('rejects hidden folders', () => assert.rejects(listDirs('.git', '', root), { status: 403 }));

  it('rejects ../ traversal', () => assert.rejects(listDirs('..', '', root), { status: 403 }));

  it('rejects a symlinked folder that points outside root', () =>
    assert.rejects(listDirs('escape-dir', '', root), { status: 403, message: 'Path outside root' }));

  it('rejects a path through a file', () => assert.rejects(listDirs('intro.md', '', root), { status: 400 }));
});

describe('createDoc', () => {
  const rejects = (rel, status, message) =>
    assert.rejects(createDoc(rel, 'x', root), { status, ...(message && { message }) });

  it('creates a file and returns its tree path and mtime', async () => {
    const { path, mtime } = await createDoc('docs/new.md', '# New', root);
    assert.equal(path, join('docs', 'new.md'));
    assert.equal(await readFile(join(root, 'docs', 'new.md'), 'utf8'), '# New');
    assert.equal(mtime, (await stat(join(root, 'docs', 'new.md'))).mtimeMs);
  });

  it('creates missing folders', async () => {
    await createDoc('docs/adr/2026/0001-decision.md', '', root);
    assert.ok((await stat(join(root, 'docs', 'adr', '2026', '0001-decision.md'))).isFile());
  });

  it('returns 409 and leaves an existing file untouched', async () => {
    await rejects('intro.md', 409, 'File already exists');
    assert.equal(await readFile(join(root, 'intro.md'), 'utf8'), '# Intro');
  });

  it('rejects non-markdown files', () => rejects('new.txt', 403, 'Only .md files are accessible'));

  it('rejects files inside hidden folders', () => rejects('.git/new.md', 403));

  it('rejects files inside excluded folders', () => rejects('node_modules/new.md', 403));

  it('rejects names hidden by MDATLAS_EXCLUDE', () => rejects('docs/README.md', 403));

  for (const rel of ['what?.md', 'a:b.md', 'con.md', 'docs/trailing./x.md', 'tab\there.md'])
    it(`rejects the invalid name ${JSON.stringify(rel)}`, () => rejects(rel, 400));

  it('rejects ../ traversal', () => rejects('../new.md', 403, 'Path outside root'));

  it('rejects a symlinked folder that points outside root, without writing', async () => {
    await rejects('escape-dir/new.md', 403, 'Path outside root');
    assert.deepEqual(await readdir(outside), ['secret.md']);
  });

  it('rejects a path through a file', () => rejects('intro.md/x.md', 400));
});
