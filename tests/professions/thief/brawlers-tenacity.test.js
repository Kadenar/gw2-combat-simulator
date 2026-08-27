import assert from 'node:assert/strict';
import test from 'node:test';

import { simulateGw2 } from '../../../js/games/gw2/platform/simulation/simulate.js';
import { thiefProfession } from '../../../js/games/gw2/content/professions/thief/definition.js';
import { THIEF_TRAIT_IDS as TRAIT } from '../../../js/games/gw2/content/professions/thief/data/ids.js';

function simulate(rotation, selectedTraitIds = []) {
  return simulateGw2({
    profession: thiefProfession,
    rotation,
    config: {
      specialization: 'Daredevil',
      selectedTraitIds
    }
  });
}

function brawlersTenacityEnduranceGain(rotation) {
  const result = simulate(rotation, [TRAIT.BRAWLERS_TENACITY]);

  assert.deepEqual(result.warnings, []);
  const states = result.events.filter((event) => event.type === 'thief.state');
  const traitIndex = states.findIndex((event) => event.reason === 'brawlers-tenacity');

  if (traitIndex < 0) return 0;

  return states[traitIndex].state.endurance - states[traitIndex - 1].state.endurance;
}

test("Brawler's Tenacity grants 15 endurance for each physical skill activation", () => {
  for (const skill of [
    'Channeled Vigor',
    "Bandit's Defense",
    'Reflexive Strike',
    'Distracting Daggers',
    'Fist Flurry',
    'Impairing Daggers'
  ]) {
    const gain = brawlersTenacityEnduranceGain(['Dodge', skill]);

    assert.ok(Math.abs(gain - 15) < 1e-9, `${skill}: ${gain}`);
  }
});

test("Pulmonary Impact does not trigger Brawler's Tenacity", () => {
  assert.equal(brawlersTenacityEnduranceGain(['Dodge', 'Pulmonary Impact (trait skill)']), 0);
});
