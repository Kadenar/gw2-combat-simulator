import { access, readFile, readdir } from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';

const siteRoot = path.resolve('dist', 'site');
const pages = [
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
const runtimeAssets = [
  path.join('Builds', 'elementalist', 'manifest.json'),
  path.join('Rotations', 'elementalist', 'r-power-tempest-sword.json')
];
const sourceAssetPattern = /(?:src|href)=["'](?:\.\/)?(?:css|js)\//;

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
for (const worker of ['modifier-contribution-worker-', 'random-distribution-worker-']) {
  if (!bundledAssets.some((asset) => asset.startsWith(worker) && asset.endsWith('.js'))) {
    throw new Error(`${worker} worker chunk is missing from the site build.`);
  }
}

console.log(`Verified ${pages.length} bundled pages and ${runtimeAssets.length} runtime asset roots.`);
