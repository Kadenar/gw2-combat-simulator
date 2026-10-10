import { thiefCatalog } from '#gw2/professions/thief/profession.js';
import assert from 'node:assert/strict';
import test from 'node:test';
import { runThief } from '#tests/helpers/thief-simulation.js';
import { withProfile, withSkill } from '#tests/helpers/catalog-overrides.js';
import { THIEF_SKILL_IDS as ID, THIEF_TRAIT_IDS as TRAIT } from '#gw2/professions/thief/data/ids.js';

// Cast one lengthened skill with and without the trait; the difference in the pool is the trait's own reward, read
// from an overridden profile so the test also proves the selected profile is honored.
function traitReward(trait, specialization, resource, id, interrupted) {
  const values = [false, true].map((selected) => {
    const result = runThief(
      [interrupted ? { skillId: id, interruptMs: 100 } : { skillId: id }],
      {
        specialization,
        initialInitiative: 0,
        initialEndurance: 0,
        selectedSkillIds: [thiefCatalog.skillsById.get(id).id],
        selectedTraitIds: selected ? [trait] : []
      },
      {
        catalog: (catalog) =>
          withProfile(
            withSkill(catalog, id, {
              castTimeMs: 1000,
              interruptMode: 'commit',
              effects: []
            }),
            trait,
            { resourceGain: 7 }
          )
      }
    );
    assert.deepEqual(result.warnings, []);
    assert.equal(
      result.events.some((event) => event.type === 'action' && event.skillId === id && event.cancelled === true),
      interrupted
    );
    return resource === 'initiative'
      ? result.planningState.profession.initiative.value
      : result.planningState.profession.endurance.value;
  });

  return values[1] - values[0];
}

// Brawler's Tenacity belongs to acceptance: its reward survives interruption.
test('endurance start rewards survive interrupted casts and honor profile changes', () => {
  const reward = traitReward(TRAIT.BRAWLERS_TENACITY, 'Daredevil', 'endurance', ID.FIST_FLURRY, true);
  assert.ok(Math.abs(reward - 7) < 1e-9, String(reward));
});

// Signets of Power belongs to completion: only a signet cast that reaches its end restores initiative.
test('Signets of Power grants initiative only when the signet cast completes', () => {
  for (const id of [ID.ASSASSINS_SIGNET, ID.SIGNET_OF_MALICE, ID.SIGNET_OF_AGILITY, ID.INFILTRATORS_SIGNET]) {
    const completed = traitReward(TRAIT.SIGNETS_OF_POWER, 'Core', 'initiative', id, false);
    assert.ok(Math.abs(completed - 7) < 1e-9, `${id}: ${completed}`);
    assert.equal(traitReward(TRAIT.SIGNETS_OF_POWER, 'Core', 'initiative', id, true), 0, String(id));
  }
});
