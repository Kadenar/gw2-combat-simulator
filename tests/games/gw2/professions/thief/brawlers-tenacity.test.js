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
      selectedSkills: rotation.slice(0, 1)
    });
    assert.deepEqual(result.warnings, []);
    return result.planningState.profession.endurance;
  };

  return endurance([TRAIT.BRAWLERS_TENACITY]) - endurance([]);
}

test("Brawler's Tenacity grants 15 endurance for each physical skill activation", () => {
  for (const [rotation, activations] of [
    [['Channeled Vigor'], 1],
    [["Bandit's Defense"], 1],
    // The follow-up is a separate physical activation.
    [["Bandit's Defense", 'Reflexive Strike'], 2],
    [['Distracting Daggers'], 1],
    [['Fist Flurry'], 1],
    [['Impairing Daggers'], 1]
  ]) {
    const gain = brawlersTenacityEnduranceGain(rotation);

    assert.ok(Math.abs(gain - 15 * activations) < 1e-9, `${rotation.join(' → ')}: ${gain}`);
  }
});

test("Pulmonary Impact does not trigger Brawler's Tenacity", () => {
  assert.equal(brawlersTenacityEnduranceGain(['Pulmonary Impact (trait skill)']), 0);
});
