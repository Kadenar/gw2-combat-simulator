import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

test('native build manifests and assets stay profession-scoped', async () => {
  const professions = [
    'engineer',
    'elementalist',
    'guardian',
    'mesmer',
    'necromancer',
    'ranger',
    'revenant',
    'thief',
    'warrior'
  ];

  for (const profession of professions) {
    const manifest = JSON.parse(
      await readFile(new URL(`../../Builds/${profession}/manifest.json`, import.meta.url), 'utf8')
    );
    const presets = manifest.flatMap((section) => section.presets);

    assert.ok(presets.length > 0, profession);
    for (const preset of presets) {
      assert.match(preset.build, new RegExp(`^Builds/${profession}/[^/]+\\.json$`));
      const build = JSON.parse(await readFile(new URL(`../../${preset.build}`, import.meta.url), 'utf8'));

      assert.equal(build.profession, profession);
      assert.equal(Number.isInteger(build.schemaVersion), true, profession);
      assert.equal(build.schemaVersion > 0, true, profession);

      if (preset.rotation) {
        assert.match(preset.rotation, new RegExp(`^Rotations/${profession}/[^/]+\\.json$`));
        const rotation = JSON.parse(await readFile(new URL(`../../${preset.rotation}`, import.meta.url), 'utf8'));

        assert.ok(Array.isArray(rotation.rotation));
        assert.ok(rotation.rotation.length > 0);
      }
    }
  }
});
