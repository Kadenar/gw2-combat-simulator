import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import { loadProfessionAppAdapter } from '#gw2/app/profession/registry.js';

// Protect the submitted loadout and its total-DPS tolerance without freezing the recorded rotation's shape.
test('Condition Fox Pistol/Focus preset loads the submitted build and stays within 1% of the log DPS', async () => {
  const readJson = async (path) => JSON.parse(await readFile(new URL(`../../${path}`, import.meta.url), 'utf8'));
  const manifest = await readJson('data/gw2/builds/elementalist/manifest.json');
  const preset = manifest
    .find((section) => section.section === 'Evoker')
    .presets.find((entry) => entry.label === 'Condition Fox - (Pistol/Focus)');
  assert.ok(preset);
  const [saved, rotation, adapter] = await Promise.all([
    readJson(preset.build),
    readJson(preset.rotation),
    loadProfessionAppAdapter('elementalist')
  ]);
  const build = adapter.toApplicationBuild({ ...saved, rotation: rotation.rotation });
  assert.deepEqual(build.specializations, [
    { name: 'Fire', traits: '1-1-2' },
    { name: 'Earth', traits: '2-1-2' },
    { name: 'Evoker', traits: '1-1-2' }
  ]);
  assert.deepEqual(build.weapons, ['Pistol', 'Focus']);
  for (const [slot, prefix] of Object.entries(build.gear))
    assert.equal(prefix, slot === 'Back' ? 'Sinister' : "Viper's", slot);
  assert.deepEqual(build.weaponSigils[0], ['Bursting', 'Smoldering']);
  assert.equal(build.rune, 'Trapper');
  assert.equal(build.relic, 'Fractal');
  assert.equal(build.food, 'Cilantro and Cured Meat Flatbread');
  assert.equal(build.utility, 'Toxic Tuning Crystal');
  assert.equal(build.infusions.find(({ stat }) => stat === 'Condition Damage').count, 18);
  const app = {
    build,
    adapter,
    profession: adapter.profession,
    skillByName: adapter.profession.catalog.skillsByName,
    skillById: adapter.profession.catalog.skillsById,
    attributeWeaponSet: 1
  };
  adapter.recalculate(app);
  const result = adapter.simulateBuild(build.rotation, adapter.simulationConfig(app));
  assert.deepEqual(result.warnings, []);
  assert.ok(Math.abs(result.dps / preset.benchmarkDps - 1) <= 0.01, `${result.dps} versus ${preset.benchmarkDps} DPS`);
});
