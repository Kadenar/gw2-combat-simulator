import assert from 'node:assert/strict';
import test from 'node:test';

import { revenantAvailability } from '#gw2/professions/revenant/core/mechanics/availability.js';
import { clearRevenantLegendFlips } from '#gw2/professions/revenant/core/mechanics/upkeep.js';
import { REVENANT_SKILL_IDS as ID, REVENANT_LEGEND_IDS as LEGEND } from '#gw2/professions/revenant/data/ids.js';
import { observedRuntime } from '#tests/helpers/observed-runtime.js';
import { runRevenant } from '#tests/helpers/revenant-simulation.js';

/** Use live resource and catalog queries while varying only the gate state under test. */
function fixture(initialEnergy = 0) {
  const result = runRevenant([], { initialEnergy });
  assert.deepEqual(result.warnings, []);
  const runtime = observedRuntime(result);
  return {
    core: runtime.profession.core,
    armFlip: runtime.armFlip,
    check: (id, patch = {}) =>
      revenantAvailability(runtime.mechanics.queries, { ...runtime.helpers.skillsById.get(id), ...patch })
  };
}

test('Demon follow-up state takes precedence over legend and Energy denials', () => {
  const { core, check, armFlip } = fixture();
  assert.equal(check(ID.UNYIELDING_IMPACT).code, 'revenant.unyielding-impact-inactive');
  armFlip(ID.UNYIELDING_IMPACT, { availableAt: 0 });
  assert.equal(check(ID.CALL_TO_ANGUISH).code, 'revenant.unyielding-impact-ready');
  assert.equal(check(ID.UNYIELDING_IMPACT).code, 'revenant.inactive-legend');
  core.activeLegendId = LEGEND.DEMON;
  assert.equal(check(ID.UNYIELDING_IMPACT).code, 'revenant.insufficient-energy');
});

test('Imperial Guard keeps its specific reasons ahead of generic weapon flips and Energy', () => {
  const { check, armFlip } = fixture();
  assert.equal(check(ID.TRUE_STRIKE).code, 'revenant.imperial-guard-inactive');
  armFlip(ID.TRUE_STRIKE, { availableAt: 0 });
  assert.equal(check(ID.IMPERIAL_GUARD).code, 'revenant.true-strike-ready');
});

test('legend ownership precedes upkeep state, which precedes Energy readiness', () => {
  const { core, check, armFlip } = fixture();
  core.activeLegendId = LEGEND.DEMON;
  assert.equal(check(ID.RELINQUISH_POWER).code, 'revenant.inactive-legend');
  core.activeLegendId = LEGEND.ASSASSIN;
  assert.equal(check(ID.RELINQUISH_POWER).code, 'revenant.upkeep-inactive');
  assert.equal(check(ID.IMPOSSIBLE_ODDS).code, 'revenant.insufficient-energy');
  core.activeUpkeeps.push({ skillId: ID.IMPOSSIBLE_ODDS, upkeepCost: 6, startsAt: 0, empoweredNextPulse: false });
  assert.equal(check(ID.IMPOSSIBLE_ODDS).code, 'revenant.upkeep-active');
  armFlip(ID.RELINQUISH_POWER, { availableAt: 0 });
  assert.deepEqual(check(ID.RELINQUISH_POWER), { ready: true });
});

test('a legal legend swap bypasses resource gates but still requires two legal legends', () => {
  const { core, check } = fixture();
  // Even a patched cost must not override the legend swap's explicit resource exemption.
  assert.deepEqual(check(ID.SWAP_LEGENDS, { energyCost: 100 }), { ready: true });
  core.selectedLegendIds = [LEGEND.ASSASSIN];
  assert.equal(check(ID.SWAP_LEGENDS).code, 'revenant.legend-pair');
  core.selectedLegendIds = [LEGEND.ASSASSIN, LEGEND.DRAGON];
  assert.equal(check(ID.SWAP_LEGENDS).code, 'revenant.legend-pair');
});

// Leaving a legend retires whole grants, while weapon choices keep their own use count and lifetime.
test('legend teardown clears every use without replacing weapon windows or reusing identities', () => {
  const runtime = observedRuntime(runRevenant([]));
  const legend = runtime.armFlip(ID.UNYIELDING_IMPACT, { uses: 3 });
  const weapon = runtime.armFlip(ID.TRUE_STRIKE, { uses: 2 });
  clearRevenantLegendFlips(runtime.mechanics);
  assert.equal(runtime.flips[ID.UNYIELDING_IMPACT], undefined);
  assert.equal(runtime.flips[ID.TRUE_STRIKE], weapon);
  assert.ok(runtime.armFlip(ID.UNYIELDING_IMPACT).identity > legend.identity);
});
