import { readFile, writeFile, stat } from 'fs/promises';
import { router } from '../router.js';
import { resolveDocPath } from '../fs.js';

router.get('/api/file', async (req, res) => {
  const rel = new URL(req.url, 'http://x').searchParams.get('path');
  if (!rel) return res.json({ error: 'path required' }, 400);
  const full = await resolveDocPath(rel);
  const [content, { mtimeMs }] = await Promise.all([readFile(full, 'utf-8'), stat(full)]);
  res.json({ content, mtime: mtimeMs });
});

// Only existing files can be written. When the client sends the mtime it read,
// a newer mtime on disk means someone else changed the file: reply 409 instead
// of overwriting. Omitting mtime skips the check (explicit overwrite).
router.put('/api/file', async (req, res) => {
  const rel = new URL(req.url, 'http://x').searchParams.get('path');
  if (!rel) return res.json({ error: 'path required' }, 400);
  const { content, mtime } = await req.json();
  if (typeof content !== 'string') return res.json({ error: 'content must be a string' }, 400);

  const full = await resolveDocPath(rel);
  if (mtime !== undefined && (await stat(full)).mtimeMs !== mtime)
    return res.json({ error: 'File changed on disk', conflict: true }, 409);

  await writeFile(full, content, 'utf-8');
  res.json({ ok: true, mtime: (await stat(full)).mtimeMs });
});
