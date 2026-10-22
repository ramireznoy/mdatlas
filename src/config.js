import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

export const ROOT        = resolve(process.argv[2] || '.');
export const PORT        = Number(process.argv[3] || 3344);
// Loopback only by default; set MDATLAS_HOST=0.0.0.0 to expose on the network
export const HOST        = process.env.MDATLAS_HOST || '127.0.0.1';
export const PROJECT_DIR = resolve(dirname(fileURLToPath(import.meta.url)), '..');

// Filenames to hide from the tree, override with MDATLAS_EXCLUDE=A.md,B.md
const raw = process.env.MDATLAS_EXCLUDE ?? 'README.md,CHANGELOG.md,LICENSE.md,CODE_OF_CONDUCT.md';
export const EXCLUDE_NAMES = new Set(raw.split(',').map(s => s.trim().toLowerCase()).filter(Boolean));

// Directory names to skip entirely, override with MDATLAS_EXCLUDE_DIRS=node_modules,dist
const rawDirs = process.env.MDATLAS_EXCLUDE_DIRS ?? 'node_modules';
export const EXCLUDE_DIRS = new Set(rawDirs.split(',').map(s => s.trim().toLowerCase()).filter(Boolean));
