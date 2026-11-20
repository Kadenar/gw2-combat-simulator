// Strike facts summarize coefficients across hits and group ticks by the formula each inherits.
import assert from 'node:assert/strict';
import test from 'node:test';

import { simulationEffectFacts } from '#gw2/app/shared/simulation-tooltip.js';

test('coefficient summaries distinguish changes to hit count and total', () => {
  const summary = (coefficients) =>
    simulationEffectFacts([{ type: 'strike', ticks: coefficients.map((coefficient, atMs) => ({ atMs, coefficient })) }])
      .facts[0].detail;
  assert.equal(summary([1, 3]), summary([2, 2]));
  assert.notEqual(summary([1, 3]), summary([4]));
  assert.notEqual(summary([1, 3]), summary([1, 4]));
});

test('flat strike facts preserve tick overrides and group matching formulas', () => {
  const parent = { type: 'strike', canCrit: false, flatStrikeBase: 100, flatStrikePowerCoeff: 0.2 };
  const override = { flatStrikeBase: 150, flatStrikePowerCoeff: 0.3 };
  const tick = { atMs: 0, coefficient: 0 };
  const facts = (ticks) => simulationEffectFacts([{ ...parent, ticks }]).facts;
  const [base] = facts([tick]);
  const [changed] = facts([{ ...tick, ...override }]);
  const explicit = (fields) => simulationEffectFacts([{ type: 'strike', ticks: [{ ...tick, ...fields }] }]).facts[0];
  assert.deepEqual(
    base,
    explicit({
      canCrit: false,
      flatStrikeBase: parent.flatStrikeBase,
      flatStrikePowerCoeff: parent.flatStrikePowerCoeff
    })
  );
  assert.deepEqual(changed, explicit({ canCrit: false, ...override }));
  assert.notEqual(base.detail, changed.detail);
  assert.deepEqual(facts([tick, { ...tick, atMs: 500 }, { ...tick, atMs: 1000, ...override }]), [
    { ...base, applications: 2 },
    changed
  ]);
});
