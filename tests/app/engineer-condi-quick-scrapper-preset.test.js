import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

import { loadProfessionAppAdapter } from '#gw2/app/profession/registry.js';

test('Condition Quickness Scrapper preset preserves the submitted spear build', async () => {
  const manifest = JSON.parse(
    await readFile(new URL('../../data/gw2/builds/engineer/manifest.json', import.meta.url), 'utf8')
  );
  const scrapper = manifest.find((section) => section.section === 'Scrapper');
  const preset = scrapper.presets.find((candidate) => candidate.label === 'Condition Quickness (Spear)');
  const saved = JSON.parse(await readFile(new URL(`../../${preset.build}`, import.meta.url), 'utf8'));
  const adapter = await loadProfessionAppAdapter('engineer');
  const build = adapter.toApplicationBuild(saved);

  // This contract protects the submitted equipment and loadout without pinning the EVTC rotation's report shape.
  assert.deepEqual(build.specializations, [
    { name: 'Explosives', traits: '3-1-2' },
    { name: 'Firearms', traits: '1-2-3' },
    { name: 'Scrapper', traits: '3-3-2' }
  ]);
  assert.deepEqual(build.weapons, ['Spear', '']);
  assert.deepEqual(build.alternateWeapons, ['', '']);
  assert.deepEqual(build.weaponSigils[0], ['Bursting', 'Earth']);
  assert.equal(build.rune, 'Trapper');
  assert.equal(build.relic, 'Steamshrieker');
  assert.equal(build.food, 'Cilantro and Cured Meat Flatbread');
  assert.equal(build.utility, 'Tuning Icicle');
  assert.equal(build.gear.Shoulders, 'Sinister');
  assert.equal(build.gear.Gloves, 'Sinister');
  assert.equal(build.gear.Back, 'Sinister');
  assert.equal(build.infusions.find(({ stat }) => stat === 'Condition Damage').count, 18);
  assert.deepEqual(build.selectedSkills, {
    Heal: 'Medic Gyro',
    Utility1: 'Grenade Kit',
    Utility2: 'Bomb Kit',
    Utility3: 'Flamethrower',
    Elite: 'Elite Mortar Kit'
  });
});
