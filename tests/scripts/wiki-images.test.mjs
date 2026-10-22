import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFile, readdir } from 'node:fs/promises';
import test from 'node:test';
import { SPECIALIZATION_BACKGROUNDS } from '#gw2/app/shared/specialization-backgrounds.js';

const root = new URL('../../', import.meta.url);
const manifest = JSON.parse(await readFile(new URL('images/wiki/manifest.json', root), 'utf8'));

// Catch missing/corrupted backups and accidental HTML error responses without any network dependency.
test('every Wiki image backup matches its recorded PNG and checksum', async () => {
  const paths = new Set();
  for (const asset of manifest.images) {
    assert.match(asset.localPath, /^images\/wiki\/[a-z0-9-]+\.png$/);
    assert.equal(paths.has(asset.localPath), false, `Duplicate asset: ${asset.localPath}`);
    paths.add(asset.localPath);
    const bytes = await readFile(new URL(asset.localPath, root));
    assert.equal(bytes.subarray(0, 8).toString('hex'), '89504e470d0a1a0a', asset.localPath);
    assert.equal(bytes.length, asset.bytes, asset.localPath);
    assert.equal(createHash('sha256').update(bytes).digest('hex'), asset.sha256, asset.localPath);
    assert.equal(bytes.readUInt32BE(16), asset.width, asset.localPath);
    assert.equal(bytes.readUInt32BE(20), asset.height, asset.localPath);
  }
});

// Guard both runtime and generator inputs: a future data refresh must not reintroduce Wiki hotlinks.
test('runtime and generator image references are local and inventoried', async () => {
  const paths = new Set(manifest.images.map(({ localPath }) => localPath));
  const used = new Set();
  for (const directory of ['js', 'scripts/data', 'css', 'templates', 'data']) {
    for (const entry of await readdir(new URL(`${directory}/`, root), { recursive: true })) {
      if (!/\.(?:ts|js|mjs|css|html|json)$/.test(entry)) continue;

      const file = `${directory}/${entry}`;
      const source = await readFile(new URL(file, root), 'utf8');
      assert.doesNotMatch(
        source,
        /https?:\/\/wiki(?:-[a-z]+)?\.guildwars2\.com\/(?:images\/|wiki\/Special:(?:FilePath|Redirect\/file))/i,
        `${file} must not depend on Wiki image hosting`
      );
      for (const [alias] of source.matchAll(/@images\/wiki\/[a-z0-9-]+\.png/g)) {
        const path = alias.slice(1);
        assert.ok(paths.has(path), `${file}: ${path} is missing from the backup inventory`);
        used.add(path);
      }
    }
  }

  assert.deepEqual([...used].sort(), [...paths].sort(), 'Every backup must have a local consumer');
});

// The old URL template hid these dependencies from literal-URL scans; cover all current profession catalogs.
test('every specialization has a bundled trait-line background', async () => {
  const names = new Set();
  for (const profession of [
    'elementalist',
    'engineer',
    'guardian',
    'mesmer',
    'necromancer',
    'ranger',
    'revenant',
    'thief',
    'warrior'
  ]) {
    const { SPECIALIZATIONS } = await import(`#gw2/professions/${profession}/data/${profession}-api-metadata.js`);
    for (const { name } of SPECIALIZATIONS) {
      names.add(name);
      assert.ok(SPECIALIZATION_BACKGROUNDS[name], `${profession}: ${name}`);
    }
  }

  assert.deepEqual(Object.keys(SPECIALIZATION_BACKGROUNDS).sort(), [...names].sort());
});
