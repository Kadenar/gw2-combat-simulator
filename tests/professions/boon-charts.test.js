import assert from 'node:assert/strict';
import test from 'node:test';
import { professionRegistry } from '#gw2/app/profession/registry.js';
import { buildChartSeries } from '#gw2/app/results/model.js';
import { simulateGw2 } from '#gw2/platform/simulation/simulate.js';

// Minimal native casts cover scheduled and resolver-generated boons across all nine professions.
const cases = {
  elementalist: [
    'Frost Aura',
    { primaryWeapon: 'Dagger', secondaryWeapon: 'Dagger', startAttunement: 'Water' },
    ["Zephyr's Boon"],
    ['Fury', 'Swiftness']
  ],
  mesmer: ['Mind Slash', { primaryWeapon: 'Sword' }, ['Master Fencer'], ['Fury']],
  necromancer: ['Extirpate', { primaryWeapon: 'Spear' }, [], ['Might']],
  ranger: ['Ricochet', { primaryWeapon: 'Axe' }, [], ['Might']],
  thief: ['Steal', {}, ['Thrill of the Crime'], ['Fury', 'Might', 'Swiftness']],
  engineer: ['Puncturing Jab', { primaryWeapon: 'Spear' }, ['No Scope'], ['Fury']],
  guardian: ['Symbol of Resolution', { primaryWeapon: 'Greatsword' }, ['Righteous Instincts'], ['Resolution', 'Might']],
  warrior: ['Signet of Rage', {}, [], ['Fury', 'Might', 'Swiftness']],
  revenant: ['Unrelenting Assault', { primaryWeapon: 'Sword' }, [], ['Might']]
};

for (const entry of professionRegistry) {
  test(`${entry.id} generated boons appear in the effects chart`, async () => {
    const profession = await entry.loadProfession();
    const [skill, config, traits, boons] = cases[profession.id];
    const result = simulateGw2({
      profession,
      rotation: [skill, { type: 'wait', durationMs: 1000 }],
      config: {
        specialization: 'Core',
        ...config,
        stats: { power: 2000, precision: 4000, vitality: 1000 },
        selectedTraitIds: traits.map((name) => profession.catalog.traits.find((trait) => trait.name === name).id)
      }
    });
    assert.deepEqual(result.warnings, []);
    const series = buildChartSeries(result);
    for (const boon of boons) {
      assert.equal(series.effectTypes[boon], 'boon', boon);
      assert.ok(
        series.effects[boon].some((point) => point.v > 0),
        boon
      );
    }

    // A trait generated after hit resolution must be visible despite having no scheduled buff record.
    if (profession.id === 'engineer') {
      assert.equal(
        result.events.some((event) => event.type === 'buff' && event.kind === 'fury'),
        false
      );
      assert.equal(result.resolvedEvents.filter((event) => event.type === 'buff' && event.kind === 'fury').length, 1);
    }
  });
}
