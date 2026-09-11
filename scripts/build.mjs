import { cp, mkdir, readdir, readFile, rm } from 'node:fs/promises';
import { extname, join } from 'node:path';

// Service pause: only archived presentation files are published.
// Original application sources remain in Git for intentional future restoration.
const allowed = new Set(['.html', '.css', '.png', '.svg', '.webp', '.ico']);
async function validate(dir) {
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    const path = join(dir, entry.name);
    if (entry.isSymbolicLink()) throw new Error(`Symlink in archive: ${path}`);
    if (entry.isDirectory()) { await validate(path); continue; }
    if (!allowed.has(extname(path))) throw new Error(`Unexpected archive file: ${path}`);
    if (['.html', '.css', '.svg'].includes(extname(path))) {
      const content = await readFile(path, 'utf8');
      if (/<script\b|<iframe\b|<form\b|\bon[a-z]+\s*=|javascript:|supabase\.co|sb_secret_/i.test(content)) {
        throw new Error(`Active application content is not allowed: ${path}`);
      }
    }
  }
}
await rm('dist', { recursive: true, force: true });
await mkdir('dist', { recursive: true });
await cp('archive', 'dist', { recursive: true });
await cp('public/styles.css', 'dist/styles.css');
await cp('public/assets', 'dist/assets', { recursive: true });
await validate('dist');
console.log('Built Jasmy Run static archive. No scripts, functions or backend connection.');
