import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { createServer } from 'vite';

/** Evaluate source modules server-side so generation never relies on stale compiled dist modules. */
export async function createPreviewGenerator(root) {
  const runner = await createServer({
    configFile: false,
    root,
    publicDir: false,
    appType: 'custom',
    server: { middlewareMode: true, watch: null, hmr: false, ws: false },
    optimizeDeps: { noDiscovery: true, include: [] },
    resolve: {
      alias: {
        '#gw2': path.join(root, 'js/games/gw2'),
        '#kernel': path.join(root, 'js/kernel'),
        '#ui': path.join(root, 'js/ui'),
        '#browser': path.join(root, 'js/browser'),
        '@images': path.join(root, 'images')
      }
    }
  });
  return {
    close: () => runner.close(),
    async generate() {
      runner.moduleGraph.invalidateAll();
      const { professionRegistry } = await runner.ssrLoadModule('/js/games/gw2/profession-registry.ts');
      const { readBenchmarks } = await runner.ssrLoadModule('/js/games/gw2/app/page/benchmarks.ts');
      const { createBenchmarkPreview } = await runner.ssrLoadModule(
        '/js/games/gw2/app/page/benchmark-preview-generation.ts'
      );
      const { benchmarkPreviewPath, validateBenchmarkPreview } = await runner.ssrLoadModule(
        '/js/games/gw2/app/page/benchmark-preview-data.ts'
      );
      const assets = new Map();
      for (const entry of professionRegistry) {
        const manifest = JSON.parse(
          await readFile(path.join(root, 'data/gw2/builds', entry.id, 'manifest.json'), 'utf8')
        );
        const rows = readBenchmarks(entry, manifest);
        if (!rows.length) continue;
        const adapter = await entry.loadAppAdapter();
        for (const row of rows) {
          const fileName = benchmarkPreviewPath(row.build);
          if (assets.has(fileName)) continue;
          const candidate = JSON.parse(await readFile(path.join(root, row.build), 'utf8'));
          const preview = createBenchmarkPreview(adapter, candidate, row.build);
          validateBenchmarkPreview(preview, row.build);
          assets.set(fileName, JSON.stringify(preview));
        }
      }

      return assets;
    }
  };
}

/** Publish the same generated JSON in production and dev, rebuilding on preset or source changes. */
export function benchmarkPreviews() {
  let root;
  let closeGenerator;
  return {
    name: 'benchmark-previews',
    configResolved(config) {
      root = config.root;
    },
    async generateBundle() {
      const generator = await createPreviewGenerator(root);
      try {
        for (const [fileName, source] of await generator.generate()) {
          this.emitFile({ type: 'asset', fileName, source });
        }
      } finally {
        await generator.close();
      }
    },
    async configureServer(server) {
      const generator = await createPreviewGenerator(root);
      let assets;
      try {
        assets = await generator.generate();
      } catch (error) {
        await generator.close();
        throw error;
      }

      // Serialize refreshes so an older generation cannot replace a newer source edit.
      let refresh = Promise.resolve();
      let generationError;
      let timer;
      const onChange = (_event, file) => {
        const relative = path.relative(root, file).replaceAll('\\', '/');
        if (!/^(data\/gw2\/builds\/|js\/(games\/gw2|kernel|ui|browser)\/)/.test(relative)) return;
        clearTimeout(timer);
        timer = setTimeout(() => {
          refresh = refresh.then(async () => {
            try {
              assets = await generator.generate();
              generationError = undefined;
            } catch (error) {
              generationError = error;
              server.config.logger.error(`Benchmark preview generation failed: ${error.message}`);
            }

            // Reload also clears the browser's promise cache after a saved build changes.
            server.ws.send({ type: 'full-reload' });
          });
        }, 50);
      };

      server.watcher.add(path.join(root, 'data/gw2/builds'));
      server.watcher.on('all', onChange);
      server.middlewares.use(async (request, response, next) => {
        const pathname = new URL(request.url ?? '/', 'http://local').pathname.slice(1);
        if (!pathname.startsWith('data/gw2/benchmark-previews/')) return next();
        await refresh;
        response.setHeader('Content-Type', 'application/json; charset=utf-8');
        response.setHeader('Cache-Control', 'no-store');
        if (generationError) {
          response.statusCode = 500;
          return response.end(JSON.stringify({ error: 'Benchmark preview generation failed' }));
        }

        const source = assets.get(pathname);
        response.statusCode = source === undefined ? 404 : 200;
        response.end(source ?? JSON.stringify({ error: 'Benchmark preview unavailable' }));
      });
      // Vite closes plugin resources even when used in middleware mode without an HTTP listener.
      closeGenerator = async () => {
        clearTimeout(timer);
        server.watcher.off('all', onChange);
        await refresh;
        await generator.close();
      };
    },
    async closeBundle() {
      await closeGenerator?.();
    }
  };
}
