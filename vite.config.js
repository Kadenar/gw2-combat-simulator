import { createReadStream, readFileSync } from 'node:fs';
import { cp, stat } from 'node:fs/promises';
import path from 'node:path';
import { defineConfig } from 'vite';

// The game-owned manifest is the one source for namespaced runtime data and temporary public aliases.
const gameDataManifest = JSON.parse(readFileSync(path.resolve('data', 'games.json'), 'utf8'));
const runtimeData = gameDataManifest.games.flatMap((game) =>
  game.runtimeData.map((entry) => ({ ...entry, gameId: game.id }))
);
const runtimeRoutes = runtimeData.flatMap((entry) =>
  [entry.publicPath, ...(entry.legacyPublicPaths || [])].map((publicPath) => ({
    publicPath: publicPath.replaceAll('\\', '/').replace(/^\/+|\/+$/g, ''),
    source: path.resolve(entry.source)
  }))
);

// Defines the content types for runtime data files.
const runtimeContentTypes = {
  '.csv': 'text/csv; charset=utf-8',
  '.json': 'application/json; charset=utf-8'
};

// Supplies the profession-specific copy and display differences used by the shared simulator page template.
const professionPages = {
  elementalist: {
    snapshot: 'Elementalist PvE API snapshot: August 12, 2026',
    attributeNote:
      'Values are calculated for the equipped weapon set. Dynamic Elementalist modifiers resolve during simulation.',
    singleWeaponSet: true
  },
  engineer: {
    snapshot: 'Engineer PvE API snapshot: July 28, 2026',
    attributeNote:
      'Values are calculated for the selected weapon set. Dynamic Engineer modifiers resolve during simulation.'
  },
  guardian: {
    snapshot: 'Guardian PvE API snapshot: July 25, 2026',
    attributeNote:
      'Values are calculated for the selected weapon set. The simulation changes sigil bonuses on weapon swap. Boons and conditional Guardian modifiers are resolved during simulation.'
  },
  mesmer: {
    snapshot: 'Mesmer PvE data snapshot: July 23, 2026',
    attributeNote:
      'Values are calculated for the selected weapon set. The simulation changes sigil bonuses when weapons are swapped. Boons are applied during simulation, not baked into the equipment totals above.'
  },
  necromancer: {
    snapshot: 'Necromancer PvE API snapshot: July 25, 2026',
    attributeNote:
      'Values are calculated for the selected weapon set. Dynamic Necromancer modifiers resolve during simulation.'
  },
  ranger: {
    snapshot: 'Ranger PvE API snapshot: August 8, 2026',
    attributeNote:
      'Values are calculated for the selected weapon set. Dynamic Ranger modifiers resolve during simulation.'
  },
  revenant: {
    snapshot: 'Revenant PvE API snapshot: July 28, 2026',
    attributeNote: 'Dynamic Revenant modifiers resolve during simulation.'
  },
  thief: {
    snapshot: 'Thief PvE API snapshot: July 28, 2026',
    attributeNote: 'Dynamic Thief modifiers resolve during simulation.'
  },
  warrior: {
    snapshot: 'Warrior PvE API snapshot: August 8, 2026',
    attributeNote:
      'Values are calculated for the selected weapon set. Dynamic Warrior modifiers resolve during simulation.'
  }
};

const professionPageTemplate = readFileSync(path.resolve('templates', 'profession.html'), 'utf8');

// Defines the entry points for the application's pages.
const pageEntries = [
  'index.html',
  'patch-preview.html',
  ...Object.keys(professionPages).map((professionId) => `${professionId}.html`)
];

// Expands each thin profession entry into the shared simulator document before Vite processes its assets.
function renderProfessionPages() {
  return {
    name: 'render-profession-pages',
    transformIndexHtml: {
      order: 'pre',
      handler(html, ctx) {
        const professionId = path.basename(ctx.filename || '', '.html');
        const page = professionPages[professionId];

        if (!page) return html;
        if (!html.includes(`data-profession="${professionId}"`)) {
          throw new Error(`${professionId}.html must identify itself with data-profession="${professionId}".`);
        }

        if (!html.includes('data-game="gw2"') || !html.includes(`data-content="${professionId}"`)) {
          throw new Error(`${professionId}.html must identify game "gw2" and content "${professionId}".`);
        }

        const name = professionId[0].toUpperCase() + professionId.slice(1);
        return professionPageTemplate
          .replaceAll('{{profession-id}}', professionId)
          .replaceAll('{{profession-name}}', name)
          .replaceAll('{{attribute-note}}', page.attributeNote)
          .replaceAll('{{weapon-set-hidden}}', page.singleWeaponSet ? ' hidden' : '')
          .replaceAll('{{weapon-set-two}}', page.singleWeaponSet ? '' : '<option value="2">2</option>')
          .replaceAll('{{loadout-theme}}', page.singleWeaponSet ? '' : ' profession-loadout-theme');
      }
    }
  };
}

// Copies each game-owned runtime directory to its canonical path and compatibility aliases.
function copyRuntimeData() {
  return {
    name: 'copy-runtime-data',
    async writeBundle() {
      await Promise.all(
        runtimeRoutes.map(({ publicPath, source }) =>
          cp(source, path.resolve('dist', 'site', publicPath), {
            recursive: true
          })
        )
      );
    }
  };
}

// Dev counterpart to copyRuntimeData: serve canonical and legacy paths raw so JSON bypasses Vite transforms.
function serveRuntimeData() {
  return {
    name: 'serve-runtime-data',
    apply: 'serve',
    configureServer(server) {
      server.middlewares.use(async (request, response, next) => {
        if (!request.url) return next();
        const { pathname } = new URL(request.url, 'http://local');
        const requestedPath = decodeURIComponent(pathname).replace(/^\/+/, '');
        const route = runtimeRoutes.find(
          ({ publicPath }) => requestedPath === publicPath || requestedPath.startsWith(`${publicPath}/`)
        );
        if (!route) return next();
        const relative = requestedPath.slice(route.publicPath.length).replace(/^\/+/, '');
        const target = path.resolve(route.source, relative);
        if (target !== route.source && !target.startsWith(`${route.source}${path.sep}`)) return next();

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
  plugins: [renderProfessionPages(), copyRuntimeData(), serveRuntimeData(), injectGithubPagesRedirect()],
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
