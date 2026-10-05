import assert from 'node:assert/strict';
import test from 'node:test';
import { thiefProfession } from '#gw2/professions/thief/profession.js';
import { elementalistProfession } from '#gw2/professions/elementalist/profession.js';
import { ELEMENTALIST_SKILL_IDS as ID } from '#gw2/professions/elementalist/data/ids.js';
import { runElementalist } from '#tests/helpers/elementalist-simulation.js';
import { runGw2Runtime } from '#gw2/platform/simulation/runtime.js';
import { THIEF_SKILL_IDS as THIEF_ID } from '#gw2/professions/thief/data/ids.js';
import { professionRegistry } from '#gw2/profession-registry.js';
import { isStandardBoon } from '#gw2/platform/combat/boons.js';

test('Antiquary replacement owners emit their own packets instead of the authored effects', () => {
  // Skritt Scuffle and Forged Surfer author packets that their live owners replace with pilfers and a timed sequence.
  const config = { specialization: 'Antiquary', selectedSkillIds: [77255] };
  const result = runGw2Runtime({
    profession: thiefProfession.runtimeFor(config),
    rotation: ['Skritt Scuffle', 'Skritt Swipe', 'Forged Surfer Dash', { type: 'wait', durationMs: 500 }],
    config
  });
  assert.deepEqual(result.warnings, []);
  for (const skillId of [THIEF_ID.SKRITT_SCUFFLE, THIEF_ID.FORGED_SURFER_DASH])
    assert.equal(
      result.events.some(
        (event) => ['damage', 'condition', 'control'].includes(event.type) && event.skillId === skillId
      ),
      false,
      String(skillId)
    );
});

test('Grand Finale selects one delayed projectile for one consumed orb', () => {
  // Authored effects capture the orb before completion consumes it.
  const result = runElementalist(
    ['Flame Wheel', 'Grand Finale', { type: 'wait', durationMs: 1000 }],
    { specialization: 'Core', primaryWeapon: 'Hammer', startAttunement: 'Fire', selectedTraitIds: [] },
    { profession: elementalistProfession }
  );
  assert.deepEqual(result.warnings, []);
  const packets = result.events.filter((event) => event.type === 'damage' && event.skillId === ID.GRAND_FINALE);
  assert.equal(packets.length, 1);
  assert.equal(packets[0].coefficient, 1.4);
  assert.equal(result.planningState.profession.hammerOrbs.Fire, null);
});

test('GW2 catalogs separate standard boons from generic timed buffs', async () => {
  for (const entry of professionRegistry) {
    const catalog = (await entry.loadProfession()).catalog;
    const records = [...catalog.skills, ...(catalog.balanceProfiles || [])];
    for (const record of records) {
      for (const status of record.effects || []) {
        if (status.type === 'boon') {
          assert.equal(
            isStandardBoon(status.boon),
            true,
            `${entry.id}: ${record.name} uses nonstandard boon ${status.boon}`
          );
        } else if (status.type === 'buff') {
          assert.equal(
            isStandardBoon(status.kind),
            false,
            `${entry.id}: ${record.name} authors standard boon ${status.kind} as a generic buff`
          );
        }
      }
    }
  }
});

test('native profession weapon swaps share timing policy except Elementalist', async () => {
  for (const entry of professionRegistry) {
    const catalog = (await entry.loadProfession()).catalog;
    const skill = catalog.skillsByName.get('Swap Weapons');

    if (entry.id === 'elementalist') {
      assert.equal(skill, undefined, entry.id);
      continue;
    }

    assert.ok(skill, entry.id);
    assert.equal(skill.rechargeAnchor, 'castStart', entry.id);
  }
});
