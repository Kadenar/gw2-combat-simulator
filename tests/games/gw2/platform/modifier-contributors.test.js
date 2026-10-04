import assert from 'node:assert/strict';
import test from 'node:test';

import { simulateGw2 } from '#gw2/platform/simulation/simulate.js';
import { WARRIOR_SKILL_IDS as WARRIOR } from '#gw2/professions/warrior/data/ids.js';
import { headlessApp } from '#tests/helpers/skill-damage.js';

const BLADESWORN = 'data/gw2/builds/warrior/b-power-bladesworn-sword-pistol.json';

/** (1 + Σ additive) × Π multipliers, the way GW2 combines one outgoing bucket with separate multipliers. */
function combined(contributors) {
  let additive = 0;
  let multiplier = 1;
  for (const contribution of contributors) {
    if (contribution.bucket === 'additive') additive += contribution.value;
    else multiplier *= contribution.value;
  }

  return (1 + additive) * multiplier;
}

async function bladesworn() {
  const app = await headlessApp('warrior', BLADESWORN);
  const config = { ...app.adapter.simulationConfig(app), randomness: { mode: 'deterministic', seed: 7 } };
  const rotation = [WARRIOR.SEVER_ARTERY, WARRIOR.GASH, WARRIOR.HAMSTRING].map((skillId) => ({
    type: 'cast',
    skillId
  }));
  const run = (damageDiagnostics) =>
    simulateGw2({
      profession: app.profession,
      rotation,
      config,
      damageDiagnostics,
      observationPolicy: { kind: 'tail', durationMs: 15_000 }
    });
  return { run };
}

test('tracing modifier contributors never changes simulated damage', async () => {
  const { run } = await bladesworn();
  const plain = run(false);
  const traced = run(true);
  assert.equal(traced.totalDamage, plain.totalDamage);
  assert.deepEqual(
    traced.resolvedEvents.map((event) => event.damage),
    plain.resolvedEvents.map((event) => event.damage)
  );
});

test('traced strike, condition, and duration factors reproduce the multipliers they explain', async () => {
  const { run } = await bladesworn();
  const result = run(true);
  const strikes = result.resolvedEvents.filter((event) => event.damageCalculation?.outgoingContributors);
  const conditions = result.resolvedEvents.filter((event) => event.conditionCalculation?.multiplier != null);
  assert.ok(strikes.length > 0);
  assert.ok(conditions.length > 0);
  for (const strike of strikes) {
    const { outgoingContributors, outgoingMultiplier } = strike.damageCalculation;
    assert.ok(Math.abs(combined(outgoingContributors) / outgoingMultiplier - 1) < 1e-9, strike.name);
  }

  for (const application of conditions) {
    const facts = application.conditionCalculation;
    assert.ok(Math.abs(combined(facts.damageContributors) / facts.multiplier - 1) < 1e-9, application.name);
    assert.ok(Math.abs(combined(facts.durationContributors) / facts.durationMultiplier - 1) < 1e-9, application.name);
  }
});
