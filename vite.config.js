import { createReadStream, readFileSync } from 'node:fs';
import { cp, stat } from 'node:fs/promises';
import path from 'node:path';
import { defineConfig } from 'vite';

// Defines the entry points for the application's pages.
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

// Copies runtime data directories (Builds/ and Rotations/) to the built site output directory.
const runtimeDirectories = ['Builds', 'Rotations'];

// Defines the content types for runtime data files.
const runtimeContentTypes = {
  '.csv': 'text/csv; charset=utf-8',
  '.json': 'application/json; charset=utf-8'
};

// Copies runtime data directories (Builds/ and Rotations/) to the built site output directory.
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

          response.setHeader('Content-Type', runtimeContentTypes[path.extname(target)] || 'application/octet-stream');
          response.setHeader('Cache-Control', 'no-cache');
          createReadStream(target).pipe(response);
        } catch {
          next();
        }
      });
    }
  };
}

// Inlines js/app/github-pages-redirect.js as a blocking <script> at the top of
// each hosted page's <head> so it runs before first paint (zero flicker). Skips
// patch-preview.html, which is a local-only authoring page and never hosted.
function injectGithubPagesRedirect() {
  const snippetPath = path.resolve('js', 'app', 'github-pages-redirect.js');

  return {
    name: 'inject-github-pages-redirect',
    transformIndexHtml: {
      order: 'pre',
      handler(html, ctx) {
        const page = (ctx.filename || ctx.path || '').replace(/\\/g, '/');

        if (page.endsWith('patch-preview.html')) return html;

        return {
          html,
          tags: [
            {
              tag: 'script',
              children: readFileSync(snippetPath, 'utf8'),
              injectTo: 'head-prepend'
            }
          ]
        };
      }
    }
  };
}

// Vite configuration for building the site, including copying runtime data and serving it during development.
export default defineConfig(({ command, mode }) => ({
  base: command === 'serve' ? '/' : './',
  publicDir: false,
  plugins: [copyRuntimeData(), serveRuntimeData(), injectGithubPagesRedirect()],
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
