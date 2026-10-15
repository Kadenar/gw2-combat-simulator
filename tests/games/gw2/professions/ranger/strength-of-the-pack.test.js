import assert from 'node:assert/strict';
import test from 'node:test';
import { RANGER_SKILL_IDS as ID } from '#gw2/professions/ranger/data/ids.js';
import { runRanger } from '#tests/helpers/ranger-simulation.js';

// The same active shout routes on-hit Might to the live pet or to its merged Soulbeast owner.
for (const specialization of ['Core', 'Soulbeast']) {
  test(`Strength of the Pack routes on-hit Might without requiring an absent pet (${specialization})`, () => {
    const result = runRanger(['"Strength of the Pack!"', 'Long Range Shot'], {
      specialization,
      primaryWeapon: 'Longbow',
      selectedTraitIds: [],
      boons: {}
    });
    assert.deepEqual(result.warnings, []);
    const might = result.events.filter(
      (event) => event.type === 'buff' && event.skillId === ID.STRENGTH_OF_THE_PACK && event.kind === 'might'
    );
    assert.ok(might.length > 0);
    for (const event of might) {
      assert.equal(event.resolvedAudience.includesSelf, specialization === 'Soulbeast');
      assert.equal(event.resolvedAudience.companionIds.length, specialization === 'Core' ? 1 : 0);
    }
  });
}
