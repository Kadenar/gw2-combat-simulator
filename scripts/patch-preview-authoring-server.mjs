import { createServer } from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { createPatchPreviewAuthoringApi } from './patch-preview-authoring-api.mjs';

const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const buildRoot = path.join(root, 'dist');
const siteRoot = path.join(buildRoot, 'site');
const port = Number(process.env.PATCH_PREVIEW_PORT || 4174);
const contentTypes = {
  '.css': 'text/css; charset=utf-8',
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.map': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.svg': 'image/svg+xml'
};
const handlePatchPreviewAuthoring = createPatchPreviewAuthoringApi({
  root,
  buildRoot
});

function isWithin(directory, target) {
  return target === directory || target.startsWith(`${directory}${path.sep}`);
}

async function resolveAuthoringFile(pathname) {
  const relative = pathname === '/' || pathname === '/patch-preview.html' ? 'patch-preview.html' : pathname.slice(1);
  if (relative !== 'patch-preview.html' && !relative.startsWith('assets/')) {
    throw new Error('Not found');
  }
  const target = path.resolve(siteRoot, relative);
  if (!isWithin(siteRoot, target)) throw new Error('Forbidden');
  const metadata = await stat(target);
  if (!metadata.isFile()) throw new Error('Not found');
  return { target, metadata };
}

createServer(async (request, response) => {
  try {
    const pathname = decodeURIComponent(new URL(request.url, 'http://local').pathname);
    if (await handlePatchPreviewAuthoring(request, response, pathname)) return;
    if (request.method !== 'GET' && request.method !== 'HEAD') {
      response.writeHead(405, {
        'Content-Type': 'text/plain; charset=utf-8',
        Allow: 'GET, HEAD'
      });
      response.end('Method not allowed');
      return;
    }
    const { target, metadata } = await resolveAuthoringFile(pathname);
    const body = await readFile(target);
    response.writeHead(200, {
      'Content-Type': contentTypes[path.extname(target)] || 'application/octet-stream',
      'Cache-Control': 'no-store',
      'Content-Length': String(metadata.size)
    });
    response.end(request.method === 'HEAD' ? undefined : body);
  } catch {
    response.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
    response.end('Not found');
  }
}).listen(port, '127.0.0.1', () => {
  console.log(`Patch preview authoring: http://127.0.0.1:${port}`);
  console.log('The simulator server remains separate and read-only.');
});
