import { createServer } from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import path from 'node:path';
import { promisify } from 'node:util';
import { fileURLToPath } from 'node:url';
import { brotliCompress, constants as zlibConstants, gzip } from 'node:zlib';

const root = path.dirname(fileURLToPath(import.meta.url));
const buildRoot = path.join(root, 'dist');
const siteRoot = path.join(buildRoot, 'site');
const port = Number(process.env.PORT || 4173);
const contentTypes = {
  '.csv': 'text/csv; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.map': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml'
};
const compressibleExtensions = new Set(['.csv', '.css', '.html', '.js', '.json', '.map', '.svg']);
const brotli = promisify(brotliCompress);
const gzipBody = promisify(gzip);
const compressedBodies = new Map();

function isWithin(directory, target) {
  return target === directory || target.startsWith(`${directory}${path.sep}`);
}

async function resolveFile(relative) {
  for (const directory of [siteRoot, buildRoot, root]) {
    const target = path.resolve(directory, relative);

    if (!isWithin(directory, target)) return null;
    try {
      const metadata = await stat(target);

      return metadata.isDirectory() ? path.join(target, 'index.html') : target;
    } catch {
      // Continue through the bundled, compiled-module, and source roots.
    }
  }

  throw new Error('Not found');
}

function acceptedEncoding(header = '') {
  const accepted = new Map(
    header.split(',').map((entry) => {
      const [name, ...parameters] = entry.trim().toLowerCase().split(';');
      const quality = parameters.map((parameter) => parameter.trim()).find((parameter) => parameter.startsWith('q='));

      return [name, quality ? Number(quality.slice(2)) : 1];
    })
  );

  if ((accepted.get('br') || 0) > 0) return 'br';

  if ((accepted.get('gzip') || 0) > 0) return 'gzip';

  return null;
}

function cacheControl(file, extension) {
  if (extension === '.html') return 'no-cache';
  const relative = path.relative(siteRoot, file);

  if (isWithin(siteRoot, file) && relative.split(path.sep)[0] === 'assets') {
    return 'public, max-age=31536000, immutable';
  }

  return 'no-cache';
}

async function encodeBody(file, metadata, body, encoding) {
  if (!encoding || body.length < 1024) return body;
  const key = `${file}:${metadata.mtimeMs}:${encoding}`;
  const cached = compressedBodies.get(key);

  if (cached) return cached;
  const encoded =
    encoding === 'br'
      ? await brotli(body, {
          params: {
            [zlibConstants.BROTLI_PARAM_QUALITY]: 4
          }
        })
      : await gzipBody(body);

  if (compressedBodies.size >= 64) compressedBodies.clear();
  compressedBodies.set(key, encoded);

  return encoded;
}

createServer(async (request, response) => {
  try {
    const pathname = decodeURIComponent(new URL(request.url, 'http://local').pathname);
    const relative = pathname === '/' ? 'index.html' : pathname.slice(1);
    const file = await resolveFile(relative);

    if (!file) {
      response.writeHead(403).end('Forbidden');

      return;
    }

    const metadata = await stat(file);
    const extension = path.extname(file);
    const etag = `W/"${metadata.size.toString(16)}-${Math.trunc(metadata.mtimeMs).toString(16)}"`;
    const headers = {
      'Content-Type': contentTypes[extension] || 'application/octet-stream',
      'Cache-Control': cacheControl(file, extension),
      ETag: etag,
      Vary: 'Accept-Encoding'
    };

    if (request.headers['if-none-match'] === etag) {
      response.writeHead(304, headers).end();

      return;
    }

    const body = await readFile(file);
    const encoding =
      compressibleExtensions.has(extension) && !request.headers.range
        ? acceptedEncoding(request.headers['accept-encoding'])
        : null;
    const encoded = await encodeBody(file, metadata, body, encoding);

    if (encoding && encoded !== body) headers['Content-Encoding'] = encoding;
    headers['Content-Length'] = String(encoded.length);
    response.writeHead(200, headers);
    response.end(request.method === 'HEAD' ? undefined : encoded);
  } catch {
    response.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
    response.end('Not found');
  }
}).listen(port, '127.0.0.1', () => {
  console.log(`GW2 Combat Simulator: http://127.0.0.1:${port}`);
});
