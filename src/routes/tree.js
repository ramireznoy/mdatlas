import { router } from '../router.js';
import { buildTree, listDirs } from '../fs.js';
import { ROOT } from '../config.js';

router.get('/api/tree', async (req, res) => {
  const tree = await buildTree();
  res.json({ tree, root: ROOT });
});

router.get('/api/dirs', async (req, res) => {
  const params = new URL(req.url, 'http://x').searchParams;
  res.json(await listDirs(params.get('path') ?? '', params.get('q') ?? ''));
});
