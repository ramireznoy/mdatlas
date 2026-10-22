import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { EventEmitter } from 'node:events';
import { mkdtemp, mkdir, writeFile, readFile, rm, stat, utimes } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

// ROOT is read from argv when config.js loads, so point it at a temp dir
// before importing the routes.
const root = await mkdtemp(join(tmpdir(), 'mdatlas-files-'));
process.argv[2] = root;

await import('../src/routes/files.js');
const { router }        = await import('../src/router.js');
const { SESSION_TOKEN } = await import('../src/auth.js');

function mockReq({ method = 'GET', url = '/', body = null, raw = null } = {}) {
  const req = new EventEmitter();
  req.method  = method;
  req.url     = url;
  req.headers = { authorization: `Bearer ${SESSION_TOKEN}` };
  setImmediate(() => {
    if (raw !== null) req.emit('data', raw);
    else if (body !== null) req.emit('data', Buffer.from(JSON.stringify(body)));
    req.emit('end');
  });
  return req;
}

function mockRes() {
  return {
    statusCode: 200,
    headers: {},
    body: '',
    writeHead(code, hdrs = {}) { this.statusCode = code; Object.assign(this.headers, hdrs); },
    end(data = '') { this.body = typeof data === 'string' ? data : data?.toString() ?? ''; },
  };
}

async function call(opts) {
  const res = mockRes();
  await router.handle(mockReq(opts), res);
  return { status: res.statusCode, data: JSON.parse(res.body) };
}

const get = path        => call({ url: `/api/file?path=${encodeURIComponent(path)}` });
const put = (path, body) => call({ method: 'PUT', url: `/api/file?path=${encodeURIComponent(path)}`, body });

before(async () => {
  await mkdir(join(root, '.git'));
  await writeFile(join(root, 'doc.md'), '# Doc');
  await writeFile(join(root, '.env'),   'SECRET=1');
});

after(() => rm(root, { recursive: true, force: true }));

describe('GET /api/file', () => {
  it('returns content and mtime for a markdown file', async () => {
    const { status, data } = await get('doc.md');
    assert.equal(status, 200);
    assert.equal(data.content, '# Doc');
    assert.equal(data.mtime, (await stat(join(root, 'doc.md'))).mtimeMs);
  });

  it('refuses to read non-markdown files', async () => {
    assert.equal((await get('.env')).status, 403);
  });

  it('returns 404 without an absolute path for a missing file', async () => {
    const { status, data } = await get('nope.md');
    assert.equal(status, 404);
    assert.ok(!data.error.includes(root));
  });
});

describe('PUT /api/file', () => {
  it('writes an existing markdown file and returns the new mtime', async () => {
    const { status, data } = await put('doc.md', { content: '# Edited' });
    assert.equal(status, 200);
    assert.equal(await readFile(join(root, 'doc.md'), 'utf8'), '# Edited');
    assert.equal(data.mtime, (await stat(join(root, 'doc.md'))).mtimeMs);
  });

  it('refuses to write non-markdown files', async () => {
    assert.equal((await put('.git/hooks-pre-commit', { content: 'echo pwned' })).status, 403);
  });

  it('refuses to write markdown inside hidden directories', async () => {
    assert.equal((await put('.git/notes.md', { content: 'x' })).status, 403);
  });

  it('does not create files that do not exist', async () => {
    assert.equal((await put('new.md', { content: 'x' })).status, 404);
    await assert.rejects(stat(join(root, 'new.md')));
  });

  it('returns 400 when content is not a string', async () => {
    assert.equal((await put('doc.md', { content: 42 })).status, 400);
  });

  it('returns 400 for a malformed JSON body', async () => {
    const res = await call({ method: 'PUT', url: '/api/file?path=doc.md', raw: Buffer.from('{nope') });
    assert.equal(res.status, 400);
  });

  it('returns 413 for an oversized body', async () => {
    const raw = Buffer.alloc(10 * 1024 * 1024 + 1, 'a');
    assert.equal((await call({ method: 'PUT', url: '/api/file?path=doc.md', raw })).status, 413);
  });

  it('saves when the client mtime matches the file on disk', async () => {
    const { data: { mtime } } = await get('doc.md');
    assert.equal((await put('doc.md', { content: '# Fresh', mtime })).status, 200);
  });

  it('returns 409 and leaves the file alone when it changed on disk', async () => {
    const { data: { mtime } } = await get('doc.md');
    await writeFile(join(root, 'doc.md'), '# Changed elsewhere');
    await utimes(join(root, 'doc.md'), new Date(), new Date(mtime + 5000));

    const { status, data } = await put('doc.md', { content: '# Stale', mtime });
    assert.equal(status, 409);
    assert.equal(data.conflict, true);
    assert.equal(await readFile(join(root, 'doc.md'), 'utf8'), '# Changed elsewhere');
  });

  it('overwrites a changed file when mtime is omitted', async () => {
    assert.equal((await put('doc.md', { content: '# Forced' })).status, 200);
    assert.equal(await readFile(join(root, 'doc.md'), 'utf8'), '# Forced');
  });
});
