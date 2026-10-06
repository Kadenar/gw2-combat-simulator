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
    invalidate: () => runner.moduleGraph.invalidateAll(),
    async generate(requestedPath) {
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
        // Dev requests load only the requested profession and a manifest-listed build.
        if (requestedPath && !requestedPath.startsWith(`data/gw2/benchmark-previews/${entry.id}/`)) continue;
        const manifest = JSON.parse(
          await readFile(path.join(root, 'data/gw2/builds', entry.id, 'manifest.json'), 'utf8')
        );
        const rows = readBenchmarks(entry, manifest).filter(
          (row) => !requestedPath || benchmarkPreviewPath(row.build) === requestedPath
        );
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

/** Build every production preview, but defer dev generation until a preview is requested. */
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
    configureServer(server) {
      let generator;
      const assets = new Map();
      let generation = 0;
      let loadedGeneration = 0;
      let pending = Promise.resolve();
      let closed = false;
      let timer;

      // Share concurrent requests and serialize SSR work; retry if an edit overtakes generation.
      async function preview(pathname) {
        while (!closed) {
          const requestedGeneration = generation;
          let result = assets.get(pathname);
          if (!result) {
            result = pending.then(async () => {
              generator ??= await createPreviewGenerator(root);
              if (loadedGeneration !== requestedGeneration) {
                generator.invalidate();
                loadedGeneration = requestedGeneration;
              }

              return (await generator.generate(pathname)).get(pathname);
            });
            pending = result.catch(() => {});
            assets.set(pathname, result);
          }

          try {
            const source = await result;
            if (requestedGeneration === generation) return source;
          } catch (error) {
            if (requestedGeneration !== generation) continue;
            if (assets.get(pathname) === result) assets.delete(pathname);
            throw error;
          }
        }
      }

      const onChange = (_event, file) => {
        const relative = path.relative(root, file).replaceAll('\\', '/');
        if (!/^(data\/gw2\/builds\/|js\/(games\/gw2|kernel|ui|browser)\/)/.test(relative)) return;
        // Invalidate immediately, but do no generation until another preview request arrives.
        generation += 1;
        assets.clear();
        clearTimeout(timer);
        timer = setTimeout(() => {
          // Reload also clears the browser's promise cache after a saved build changes.
          server.ws.send({ type: 'full-reload' });
        }, 50);
      };

      server.watcher.add(path.join(root, 'data/gw2/builds'));
      server.watcher.on('all', onChange);
      server.middlewares.use(async (request, response, next) => {
        const pathname = new URL(request.url ?? '/', 'http://local').pathname.slice(1);
        if (!pathname.startsWith('data/gw2/benchmark-previews/')) return next();
        response.setHeader('Content-Type', 'application/json; charset=utf-8');
        response.setHeader('Cache-Control', 'no-store');
        if (!/^data\/gw2\/benchmark-previews\/[a-z]+\/[a-zA-Z0-9_-]+\.json$/.test(pathname)) {
          response.statusCode = 404;
          return response.end(JSON.stringify({ error: 'Benchmark preview unavailable' }));
        }

        try {
          const source = await preview(pathname);
          response.statusCode = source === undefined ? 404 : 200;
          response.end(source ?? JSON.stringify({ error: 'Benchmark preview unavailable' }));
        } catch (error) {
          server.config.logger.error(`Benchmark preview generation failed: ${error.message}`);
          response.statusCode = 500;
          response.end(JSON.stringify({ error: 'Benchmark preview generation failed' }));
        }
      });
      // Vite closes plugin resources even when used in middleware mode without an HTTP listener.
      closeGenerator = async () => {
        closed = true;
        clearTimeout(timer);
        server.watcher.off('all', onChange);
        await pending;
        await generator?.close();
      };
    },
    async closeBundle() {
      await closeGenerator?.();
    }
  };
}
