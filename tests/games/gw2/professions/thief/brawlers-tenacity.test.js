import { thiefCatalog } from '#gw2/professions/thief/catalog.js';
import assert from 'node:assert/strict';
import test from 'node:test';

import { THIEF_TRAIT_IDS as TRAIT } from '#gw2/professions/thief/data/ids.js';
import { runThief } from '#tests/helpers/thief-simulation.js';

// Starting empty keeps every grant below capacity; the same rotation without the trait isolates its grants.
function brawlersTenacityEnduranceGain(rotation) {
  const endurance = (selectedTraitIds) => {
    const result = runThief(rotation, {
      specialization: 'Daredevil',
      initialEndurance: 0,
      selectedTraitIds,
      selectedSkillIds: rotation.slice(0, 1).map((name) => thiefCatalog.skillsByName.get(name).id)
    });
    assert.deepEqual(result.warnings, []);
    return result.planningState.profession.endurance.value;
  };

  return endurance([TRAIT.BRAWLERS_TENACITY]) - endurance([]);
}

test("Pulmonary Impact does not trigger Brawler's Tenacity", () => {
  assert.equal(brawlersTenacityEnduranceGain(['Pulmonary Impact (trait skill)']), 0);
});
