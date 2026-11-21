import assert from 'node:assert/strict';
import test from 'node:test';

import {
  REVENANT_SKILL_IDS as ID,
  REVENANT_LEGEND_IDS as LEGEND,
  REVENANT_TRAIT_IDS as TRAIT
} from '#gw2/professions/revenant/data/ids.js';
import { PROFESSION_STATE_IDS as STATE } from '#gw2/professions/state-ids.js';
import { wait } from '#tests/helpers/commands.js';
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

// Holding the shield past Swiftness expiry distinguishes the opening boon from an upkeep pulse.
test('Solace grants Swiftness on opening and adds Protection only when it spends Tranquil', () => {
  const result = runRevenant([ID.PROTECTIVE_SOLACE, wait(6000), ID.DIMINISH_SOLACE, ID.PROTECTIVE_SOLACE, wait(6000)], {
    ...config,
    selectedTraitIds: [TRAIT.SERENE_REJUVENATION]
  });
  assert.deepEqual(result.warnings, []);
  const openings = result.steps.filter((step) => step.skillId === ID.PROTECTIVE_SOLACE);
  const grants = (kind) => result.events.filter((event) => event.kind === kind).map((event) => event.at);
  assert.equal(openings.length, 2);
  assert.deepEqual(
    grants('swiftness'),
    openings.map((step) => step.end / 1000)
  );
  assert.deepEqual(grants('protection'), [openings[0].end / 1000]);
  assert.equal(result.planningState.profession[STATE.TRANQUIL], false);
});

// A later cast can deliver its boon first. Each application still belongs to the cast that selected it.
test('Serene Rejuvenation keeps the originating cast when Centaur boons arrive out of order', () => {
  for (const [skill, boon] of [
    [ID.NATURAL_HARMONY, 'vigor'],
    [ID.ENERGY_EXPULSION, 'resistance']
  ]) {
    const result = runRevenant([skill, ID.PURIFYING_ESSENCE, wait(2000)], {
      ...config,
      selectedTraitIds: [TRAIT.SERENE_REJUVENATION]
    });
    assert.deepEqual(result.warnings, []);
    const grants = result.events.filter((event) => event.sourceId === TRAIT.SERENE_REJUVENATION);
    assert.deepEqual(
      grants.map((event) => [event.kind, event.activationId]),
      [
        ['regeneration', result.steps.find((step) => step.skillId === ID.PURIFYING_ESSENCE).activationId],
        [boon, result.steps.find((step) => step.skillId === skill).activationId]
      ]
    );
  }
});

test('invoking another legend clears Tranquil and returning to Centaur restores it', () => {
  const away = runRevenant([ID.SWAP_LEGENDS], config);
  const back = runRevenant([ID.NATURAL_HARMONY, ID.SWAP_LEGENDS, ID.SWAP_LEGENDS, ID.ENERGY_EXPULSION], config);
  assert.deepEqual(away.warnings, []);
  assert.deepEqual(back.warnings, []);
  assert.equal(away.planningState.profession[STATE.TRANQUIL], false);
  assert.ok(stability(back).length > 0);
});
