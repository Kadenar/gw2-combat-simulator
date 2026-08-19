import { createReadStream } from 'node:fs';
import { cp, stat } from 'node:fs/promises';
import path from 'node:path';
import { defineConfig } from 'vite';

const pageEntries = [
  'index.html',
  'patch-preview.html',
  'elementalist.html',
  'engineer.html',
  'guardian.html',
  'mesmer.html',
  'necromancer.html',
  'ranger.html',
  'revenant.html',
  'thief.html',
  'warrior.html'
];

const runtimeDirectories = ['Builds', 'Rotations'];

const runtimeContentTypes = {
  '.csv': 'text/csv; charset=utf-8',
  '.json': 'application/json; charset=utf-8'
};

function copyRuntimeData() {
  return {
    name: 'copy-runtime-data',
    async writeBundle() {
      await Promise.all(
        runtimeDirectories.map((directory) =>
          cp(path.resolve(directory), path.resolve('dist', 'site', directory), {
            recursive: true
          })
        )
      );
    }
  };
}

// Dev counterpart to copyRuntimeData: serve Builds/ and Rotations/ raw so the
// dev server matches the built site layout, bypassing Vite's .json transform.
function serveRuntimeData() {
  const roots = runtimeDirectories.map((directory) => path.resolve(directory));
  return {
    name: 'serve-runtime-data',
    apply: 'serve',
    configureServer(server) {
      server.middlewares.use(async (request, response, next) => {
        if (!request.url) return next();
        const { pathname } = new URL(request.url, 'http://local');
        const segment = pathname.split('/')[1];
        if (!runtimeDirectories.includes(segment)) return next();
        const target = path.resolve('.' + decodeURIComponent(pathname));
        if (!roots.some((root) => target === root || target.startsWith(`${root}${path.sep}`))) {
          return next();
        }
        try {
          if ((await stat(target)).isDirectory()) return next();
          response.setHeader(
            'Content-Type',
            runtimeContentTypes[path.extname(target)] || 'application/octet-stream'
          );
          response.setHeader('Cache-Control', 'no-cache');
          createReadStream(target).pipe(response);
        } catch {
          next();
        }
      });
    }
  };
}

export default defineConfig(({ command, mode }) => ({
  base: command === 'serve' ? '/' : './',
  publicDir: false,
  plugins: [copyRuntimeData(), serveRuntimeData()],
  worker: {
    format: 'es'
  },
  build: {
    outDir: 'dist/site',
    emptyOutDir: true,
    minify: mode !== 'development',
    sourcemap: mode === 'development',
    rolldownOptions: {
      input: pageEntries.map((page) => path.resolve(page))
    }
  }
}));
