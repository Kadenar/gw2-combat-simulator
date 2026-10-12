import fs from 'node:fs/promises';
import { registerHooks, syncBuiltinESMExports } from 'node:module';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

let revision = 0;

/** Capture publication and provide fresh virtual identity modules without modifying repository fixtures. */
export function mockGeneratorFiles(context, { emptyIdentities = true } = {}) {
  const writes = [];
  const published = new Map();
  const logs = [];
  const fixture = ++revision;
  const readFile = fs.readFile;
  const virtualSource = (target) => {
    if (published.has(target)) return published.get(target);
    if (!emptyIdentities || path.basename(target) !== 'ids.ts') return undefined;
    const profession = path.basename(path.dirname(path.dirname(target))).toUpperCase();
    return `// Fixture ${fixture}\nexport const ${profession}_SKILL_IDS = {}; export const ${profession}_TRAIT_IDS = {};`;
  };

  const hooks = registerHooks({
    load(url, options, nextLoad) {
      const source = url.startsWith('file:') ? virtualSource(fileURLToPath(url)) : undefined;
      return source === undefined
        ? nextLoad(url, options)
        : { format: 'module-typescript', source, shortCircuit: true };
    }
  });
  context.mock.method(
    fs,
    'readFile',
    async (target, ...options) =>
      virtualSource(target instanceof URL ? fileURLToPath(target) : target) ?? readFile(target, ...options)
  );
  context.mock.method(fs, 'mkdir', async () => {});
  context.mock.method(fs, 'writeFile', async (target, source) => {
    published.set(target, source);
    writes.push({ target, file: path.basename(target), source });
  });
  context.mock.method(console, 'log', (message) => logs.push(message));
  syncBuiltinESMExports();
  context.after(() => {
    hooks.deregister();
    context.mock.restoreAll();
    syncBuiltinESMExports();
  });
  return { writes, published, logs };
}

/** Load source or prepared TypeScript with source-only aliases and a fresh module graph, never compiled dist IDs. */
export async function importGeneratorSource(target, files = []) {
  const sources = new Map(files.map((file) => [path.resolve(file.target), file.source]));
  const current = String(++revision);
  const hooks = registerHooks({
    resolve(specifier, options, nextResolve) {
      const resolved = specifier.startsWith('#gw2/')
        ? {
            url: new URL(`../../js/games/gw2/${specifier.slice(5).replace(/\.js$/, '.ts')}`, import.meta.url).href,
            shortCircuit: true
          }
        : nextResolve(specifier, options);
      const url = new URL(resolved.url);
      if (url.protocol === 'file:' && /\/dist\//.test(url.pathname))
        throw new Error(`Compiled fixture dependency: ${url}`);
      if (url.pathname.endsWith('.ts')) url.searchParams.set('fixture', current);
      return { ...resolved, url: url.href };
    },
    load(url, options, nextLoad) {
      const source = url.startsWith('file:') ? sources.get(fileURLToPath(url)) : undefined;
      return source === undefined
        ? nextLoad(url, options)
        : { format: 'module-typescript', source, shortCircuit: true };
    }
  });
  try {
    return await import(target instanceof URL ? target.href : pathToFileURL(target).href);
  } finally {
    hooks.deregister();
  }
}

/** Centralize inline CLI preloads so subprocess tests share the same encoding boundary. */
export function generatorPreload(source) {
  return `data:text/javascript,${encodeURIComponent(source)}`;
}
