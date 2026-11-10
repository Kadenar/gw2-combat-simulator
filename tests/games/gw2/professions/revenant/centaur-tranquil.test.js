import assert from 'node:assert/strict';
import test from 'node:test';

import { REVENANT_SKILL_IDS as ID, REVENANT_LEGEND_IDS as LEGEND } from '#gw2/professions/revenant/data/ids.js';
import { PROFESSION_STATE_IDS as STATE } from '#gw2/professions/state-ids.js';
import { runRevenant } from '#tests/helpers/revenant-simulation.js';

const config = {
  selectedLegends: [LEGEND.CENTAUR, LEGEND.ASSASSIN],
  startingLegend: LEGEND.CENTAUR,
  initialEnergy: 100
};
const stability = (result) =>
  result.events.filter((event) => event.kind === 'stability' && event.skillId === ID.ENERGY_EXPULSION);

// Empowerment alternates through the three replenishing skills without destroying the tablet control.
test('Centaur unempowered skills restore Tranquil for the next cast', () => {
  for (const skill of [ID.NATURAL_HARMONY, ID.PURIFYING_ESSENCE, ID.ENERGY_EXPULSION]) {
    const once = runRevenant([skill], config);
    const twice = runRevenant([skill, skill], config);
    assert.deepEqual(once.warnings, []);
    assert.deepEqual(twice.warnings, []);
    assert.equal(once.planningState.profession[STATE.TRANQUIL], false);
    assert.equal(twice.planningState.profession[STATE.TRANQUIL], true);
    const moved = runRevenant([skill, ID.VENTARIS_WILL], config);
    assert.deepEqual(moved.warnings, []);
    assert.equal(moved.planningState.profession[STATE.TRANQUIL], false);
  }
});

test('Energy Expulsion grants Stability only from existing Tranquil', () => {
  const empowered = runRevenant([ID.ENERGY_EXPULSION], config);
  const unempowered = runRevenant([ID.NATURAL_HARMONY, ID.ENERGY_EXPULSION], config);
  assert.deepEqual(empowered.warnings, []);
  assert.deepEqual(unempowered.warnings, []);
  assert.ok(stability(empowered).length > 0);
  assert.equal(stability(unempowered).length, 0);
  assert.equal(unempowered.planningState.profession[STATE.TRANQUIL], true);
});

test('invoking another legend clears Tranquil and returning to Centaur restores it', () => {
  const away = runRevenant([ID.SWAP_LEGENDS], config);
  const back = runRevenant([ID.NATURAL_HARMONY, ID.SWAP_LEGENDS, ID.SWAP_LEGENDS, ID.ENERGY_EXPULSION], config);
  assert.deepEqual(away.warnings, []);
  assert.deepEqual(back.warnings, []);
  assert.equal(away.planningState.profession[STATE.TRANQUIL], false);
  assert.ok(stability(back).length > 0);
});
