import { thiefCatalog } from '#gw2/professions/thief/profession.js';
import assert from 'node:assert/strict';
import test from 'node:test';
import { runThief } from '#tests/helpers/thief-simulation.js';
import { withProfile, withSkill } from '#tests/helpers/catalog-overrides.js';
import { THIEF_SKILL_IDS as ID, THIEF_TRAIT_IDS as TRAIT } from '#gw2/professions/thief/data/ids.js';

// Resource rewards belong to acceptance, survive interruption, and read the selected profile.
for (const [trait, specialization, resource, skillIds] of [
  [
    TRAIT.SIGNETS_OF_POWER,
    'Core',
    'initiative',
    [ID.ASSASSINS_SIGNET, ID.SIGNET_OF_MALICE, ID.SIGNET_OF_AGILITY, ID.INFILTRATORS_SIGNET]
  ],
  [TRAIT.BRAWLERS_TENACITY, 'Daredevil', 'endurance', [ID.FIST_FLURRY]]
]) {
  test(`${resource} start rewards survive interrupted casts and honor profile changes`, () => {
    for (const id of skillIds) {
      const values = [false, true].map((selected) => {
        const result = runThief(
          [{ skillId: id, interruptMs: 100 }],
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
        assert.equal(result.events.find((event) => event.type === 'action' && event.skillId === id).cancelled, true);
        return resource === 'initiative'
          ? result.planningState.profession.initiative.value
          : result.planningState.profession.endurance;
      });
      assert.ok(Math.abs(values[1] - values[0] - 7) < 1e-9, `${id}: ${values}`);
    }
  });
}
