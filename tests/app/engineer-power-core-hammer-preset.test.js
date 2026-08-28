import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

import { loadProfessionAppAdapter } from '../../js/games/gw2/app/profession/registry.js';

test('Power Core Engineer Hammer preset preserves the submitted build and equipment', async () => {
  const manifest = JSON.parse(
    await readFile(new URL('../../data/gw2/builds/engineer/manifest.json', import.meta.url), 'utf8')
  );
  const core = manifest.find((section) => section.section === 'Core');
  const preset = core.presets.find((candidate) => candidate.label === 'Power (Hammer)');
  const saved = JSON.parse(await readFile(new URL(`../../${preset.build}`, import.meta.url), 'utf8'));
  const adapter = await loadProfessionAppAdapter('engineer');
  const build = adapter.toApplicationBuild(saved);

  // This contract protects the requested build without coupling it to the imported EVTC report shape.
  assert.deepEqual(build.specializations, [
    { name: 'Explosives', traits: '3-2-3' },
    { name: 'Firearms', traits: '3-3-1' },
    { name: 'Tools', traits: '1-3-3' }
  ]);
  assert.deepEqual(build.weapons, ['Hammer', '']);
  assert.deepEqual(build.weaponSigils[0], ['Force', 'Impact']);
  assert.equal(build.rune, 'Dragonhunter');
  assert.equal(build.relic, 'Bloodstone');
  assert.equal(build.food, 'Cilantro Lime Sous-Vide Steak');
  assert.equal(build.utility, 'Superior Sharpening Stone');
  assert.equal(build.gear.Leggins, "Dragon's");
  assert.equal(build.gear.Ring1, "Dragon's");
  assert.equal(build.gear.Back, "Dragon's");
  assert.equal(build.gear.Accessory1, "Berserker's");
  assert.equal(build.infusions.find(({ stat }) => stat === 'Power').count, 18);
  assert.deepEqual(build.selectedSkills, {
    Heal: 'A.E.D.',
    Utility1: 'Grenade Kit',
    Utility2: 'Throw Mine',
    Utility3: 'Bomb Kit',
    Elite: 'Elite Mortar Kit'
  });
});
