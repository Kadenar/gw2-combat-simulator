import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

import { loadProfessionAppAdapter } from '#gw2/app/profession/registry.js';

test('Power Quickness Herald preset preserves the submitted build and equipment', async () => {
  const manifest = JSON.parse(
    await readFile(new URL('../../data/gw2/builds/revenant/manifest.json', import.meta.url), 'utf8')
  );
  const herald = manifest.find((section) => section.section === 'Herald');
  const preset = herald.presets.find((candidate) => candidate.label === 'Power Quickness (Greatsword - Sword/Sword)');
  const saved = JSON.parse(await readFile(new URL(`../../${preset.build}`, import.meta.url), 'utf8'));
  const adapter = await loadProfessionAppAdapter('revenant');
  const build = adapter.toApplicationBuild(saved);

  assert.deepEqual(build.specializations, [
    { name: 'Devastation', traits: '2-2-2' },
    { name: 'Invocation', traits: '2-1-3' },
    { name: 'Herald', traits: '2-1-1' }
  ]);
  assert.deepEqual(build.weapons, ['Greatsword', '']);
  assert.deepEqual(build.alternateWeapons, ['Sword', 'Sword']);
  assert.deepEqual(build.weaponSigils, [
    ['Force', 'Air'],
    ['Force', 'Air']
  ]);
  assert.equal(build.rune, 'Dragonhunter');
  assert.equal(build.relic, 'Thief');
  assert.equal(build.food, 'Cilantro Lime Sous-Vide Steak');
  assert.equal(build.utility, 'Superior Sharpening Stone');
  assert.equal(build.gear.Back, "Dragon's");
  assert.equal(build.infusions.find(({ stat }) => stat === 'Power').count, 18);
  assert.deepEqual(build.selectedLegends, ['LegendaryDragon', 'LegendaryAssassin']);
  assert.equal(build.startingLegend, 'LegendaryDragon');
  assert.equal(build.startingWeaponSet, 1);
});
