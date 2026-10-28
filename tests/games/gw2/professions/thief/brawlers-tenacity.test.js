import assert from 'node:assert/strict';
import test from 'node:test';

import { PROFESSION_STATE_IDS as STATE } from '#gw2/professions/state-ids.js';
import { thiefCatalog } from '#gw2/professions/thief/catalog.js';
import { THIEF_TRAIT_IDS as TRAIT } from '#gw2/professions/thief/data/ids.js';
import { runThief } from '#tests/helpers/thief-simulation.js';

// Starting empty keeps every grant below capacity; the same rotation without the trait isolates its grants.
function brawlersTenacityEnduranceGain(rotation) {
  const endurance = (selectedTraitIds) => {
    const result = runThief(rotation, {
      specialization: 'Daredevil',
      initialEndurance: 0,
      selectedTraitIds,
      selectedSkillIds: rotation
        .slice(0, 1)
        .map((name) => thiefCatalog.skills.find((candidate) => candidate.name === name).id)
    });
    assert.deepEqual(result.warnings, []);
    return result.planningState.profession[STATE.ENDURANCE].value;
  };

  return endurance([TRAIT.BRAWLERS_TENACITY]) - endurance([]);
}

test("Pulmonary Impact does not trigger Brawler's Tenacity", () => {
  assert.equal(brawlersTenacityEnduranceGain(['Pulmonary Impact (trait skill)']), 0);
});
