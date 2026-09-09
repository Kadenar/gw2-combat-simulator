import { access, readFile, readdir } from 'node:fs/promises';
import path from 'node:path';

const siteRoot = path.resolve('dist', 'site');
// Production artifacts must omit local authoring; opt in when validating npm run build:dev.
const development = process.argv.includes('--development');
const pages = [
  'index.html',
  ...(development ? ['patch-preview.html'] : []),
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
const runtimeAssets = [
  path.join('data', 'gw2', 'builds', 'elementalist', 'manifest.json'),
  path.join('data', 'gw2', 'rotations', 'elementalist', 'r-power-tempest-sword.json'),
  path.join('Builds', 'elementalist', 'manifest.json'),
  path.join('Rotations', 'elementalist', 'r-power-tempest-sword.json')
];
const sourceAssetPattern = /(?:src|href)=["'](?:\.\/)?(?:css|js)\//;

if (!development && (await readdir(siteRoot)).includes('patch-preview.html')) {
  throw new Error('Production site must not include the local patch-preview.html authoring page.');
}

for (const page of pages) {
  const source = await readFile(path.join(siteRoot, page), 'utf8');

  if (sourceAssetPattern.test(source)) {
    throw new Error(`${page} still references an unbundled source asset.`);
  }

  if (!source.includes('assets/')) {
    throw new Error(`${page} does not reference a bundled asset.`);
  }

  if (page !== 'index.html' && page !== 'patch-preview.html') {
    const professionId = path.basename(page, '.html');
    if (
      !source.includes(`data-profession="${professionId}"`) ||
      !source.includes('id="rotation-warnings"') ||
      source.includes('{{')
    ) {
      throw new Error(`${page} was not expanded from the shared profession template.`);
    }
  }
}

await Promise.all(runtimeAssets.map((asset) => access(path.join(siteRoot, asset))));

const bundledAssets = await readdir(path.join(siteRoot, 'assets'));
// Dedicated chunks prove Vite recognized the static Worker constructors instead of embedding raw TypeScript assets.
for (const worker of ['modifier-contribution-worker-', 'random-distribution-worker-', 'gear-optimizer-worker-']) {
  if (!bundledAssets.some((asset) => asset.startsWith(worker) && asset.endsWith('.js'))) {
    throw new Error(`${worker} worker chunk is missing from the site build.`);
  }
}

// Worker entries must stay out of shared imports: WebKit can reevaluate them and register a second message handler.
const optimizerWorker = bundledAssets.find(
  (asset) => asset.startsWith('gear-optimizer-worker-') && asset.endsWith('.js')
);
const optimizerImport = new RegExp(
  `(?:\\bfrom\\s*|\\bimport\\s*(?:\\(\\s*)?)["']\\./${optimizerWorker.replaceAll('.', '\\.')}["']`
);
for (const asset of bundledAssets.filter((asset) => asset.endsWith('.js'))) {
  if (optimizerImport.test(await readFile(path.join(siteRoot, 'assets', asset), 'utf8'))) {
    throw new Error(`${asset} imports the optimizer worker entry instead of shared code.`);
  }
}

console.log(`Verified ${pages.length} bundled pages and ${runtimeAssets.length} runtime asset roots.`);
