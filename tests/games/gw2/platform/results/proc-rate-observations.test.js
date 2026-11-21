import assert from 'node:assert/strict';
import test from 'node:test';

import { baseAttributeInputs } from '#gw2/platform/attributes/inputs.js';
import { createLiveEffects } from '#gw2/platform/combat/live-effects.js';
import { createProcRegistry } from '#gw2/platform/combat/procs/registry.js';
import { createGw2ComboController } from '#gw2/platform/combos/resolution.js';
import { SIGIL_IDS } from '#gw2/platform/equipment/sigils/data.js';
import { SEVERANCE_PROC_RATE } from '#gw2/platform/equipment/sigils/severance.js';
import { criticalProcHandler } from '#gw2/platform/profession-definition/critical-proc-handler.js';
import { createGw2ResolverRuntimeState } from '#gw2/platform/resolver/runtime-state.js';
import { createProcRollRecorder, projectProcRateObservations } from '#gw2/platform/results/proc-rate-observations.js';
import { runGw2Runtime } from '#gw2/platform/simulation/runtime.js';
import { loadProfession } from '#gw2/profession-registry.js';
import { createSimulationRandom } from '#kernel/core/simulation-random.js';
import { createTestConditionResolution } from '#tests/helpers/condition-resolution.js';
import { captureEffectEmissions } from '#tests/helpers/effect-emission.js';
import { enteredCombat } from '#tests/helpers/engagement.js';

// Observation must be invisible to gameplay: the same seed yields the same outcomes with or without it.
test('observed rolls keep the seeded sequence and count certain and impossible chances', () => {
  const recorder = createProcRollRecorder();
  const observed = recorder.observe(createSimulationRandom({ mode: 'stochastic', seed: 7 }));
  const reference = createSimulationRandom({ mode: 'stochastic', seed: 7 });
  const chances = [0.25, 0, 1, 0.25, 0.75];
  const outcomes = chances.map((chance) => observed.roll(chance, 'fixture.proc'));
  assert.deepEqual(
    outcomes,
    chances.map((chance) => reference.roll(chance, 'fixture.proc'))
  );
  assert.deepEqual(recorder.tallies().get('fixture.proc'), {
    rolls: 5,
    successes: outcomes.filter(Boolean).length,
    expectedSuccesses: 2.25,
    successVariance: 0.1875 * 3,
    cooldownBlocked: 0
  });
});

// A 100% override still counts its triggers; critical hits during the ICD are reported instead of rolled.
test('critical procs count declared-chance triggers and cooldown-blocked hits', () => {
  const recorder = createProcRollRecorder();
  const context = {
    procRollRecorder: recorder,
    random: recorder.observe(createSimulationRandom()),
    procs: createProcRegistry(() => context)
  };
  const rewards = [];
  const declared = criticalProcHandler({
    id: 'fixture.declared',
    chanceOnCriticalHit: 1,
    internalCooldown: { key: 'fixture', duration: 2 },
    handler: (_context, event) => rewards.push(event.at)
  });
  const certain = criticalProcHandler({ id: 'fixture.certain', handler() {} });
  const critical = { hitContext: { critical: { chance: 1, didCrit: true } } };
  const normal = { hitContext: { critical: { chance: 1, didCrit: false } } };
  for (const at of [0, 1, 1.5, 3]) declared(context, { actorType: 'player', at }, critical);
  declared(context, { actorType: 'player', at: 6 }, normal);
  certain(context, { actorType: 'player', at: 0 }, critical);
  assert.deepEqual(rewards, [0, 3]);
  assert.deepEqual(recorder.tallies().get('fixture.declared'), {
    rolls: 2,
    successes: 2,
    expectedSuccesses: 2,
    successVariance: 0,
    cooldownBlocked: 2
  });
  assert.equal(recorder.tallies().has('fixture.certain'), false);
});

const runElementalist = (profession, profile, overrides, selected = true) =>
  runGw2Runtime({
    profession: profession.runtimeFor({ specialization: 'Core' }),
    rotation: Array(12).fill('Fireball'),
    config: {
      specialization: 'Core',
      primaryWeapon: 'Staff',
      startAttunement: 'Fire',
      attributeInputs: baseAttributeInputs({ power: 2000, precision: 3000 }),
      selectedTraitIds: selected ? [profile.procRate.traitId] : [],
      procRateOverrides: overrides
    }
  });

test('detailed results list selected overridable procs with their triggers, procs, and ICD-blocked hits', async () => {
  const profession = await loadProfession('elementalist');
  const profile = profession.catalog.balanceProfiles.find((entry) => entry.name === 'Burning Precision');
  const { id } = profile.procRate;

  const certain = runElementalist(profession, profile, { [id]: 1 });
  assert.deepEqual(certain.warnings, []);
  const applications = certain.resolvedEvents.filter(
    (event) => event.type === 'condition' && event.sourceId === profile.id
  );
  const [row] = certain.procRates;
  assert.equal(certain.procRates.length, 1);
  assert.equal(row.id, id);
  assert.equal(row.chance, 1);
  assert.equal(row.custom, true);
  assert.equal(row.defaultChance, profile[profile.procRate.field]);
  assert.ok(applications.length > 1);
  assert.equal(row.procs, applications.length);
  assert.equal(row.triggers, row.procs);
  assert.equal(row.expectedProcs, row.triggers);
  assert.ok(row.cooldownBlocked > 0);

  // Unset overrides report the balance default; expected counts follow the chance of each roll.
  const defaults = runElementalist(profession, profile, {});
  const [fallback] = defaults.procRates;
  assert.equal(fallback.custom, false);
  assert.equal(fallback.chance, profile[profile.procRate.field]);
  assert.ok(Math.abs(fallback.expectedProcs - fallback.triggers * fallback.chance) < 1e-9);

  assert.deepEqual(runElementalist(profession, profile, { [id]: 1 }, false).procRates, []);
});

/** Runs a control at 0, then controls at fractions of the cooldown it claimed, and projects the build's proc rates. */
function severanceProcRates(sigilSets, procRateOverrides, laterControls) {
  const config = { sigilSets, procRateOverrides, randomness: { seed: 42 } };
  const runtime = createGw2ResolverRuntimeState({
    liveEffects: createLiveEffects(config),
    combo: createGw2ComboController(),
    conditions: createTestConditionResolution(),
    helpers: { balanceProfilesById: new Map() },
    procRollRecorder: createProcRollRecorder(),
    config
  });
  runtime.engagement = enteredCombat();
  runtime.effects = captureEffectEmissions().effects;
  const control = (at) => runtime.sigil.control(runtime, { type: 'control', at, skillName: 'Control' });
  control(0);
  // Offsets scale the cooldown the first accepted control claimed, so the test never restates it.
  const readyAt = runtime.procs.deadline(`sigil.${SIGIL_IDS.SEVERANCE}`);
  for (const fraction of laterControls) control(readyAt * fraction);
  return projectProcRateObservations(runtime);
}

test('equipped Severance reports rolled controls, cooldown-blocked controls, and its default chance', () => {
  const [row, ...rest] = severanceProcRates([{ names: ['Severance'] }, { names: [] }], {}, [0.5, 2]);
  assert.deepEqual(rest, []);
  assert.equal(row.id, SEVERANCE_PROC_RATE.id);
  assert.equal(row.chance, SEVERANCE_PROC_RATE.defaultChance);
  assert.equal(row.custom, false);
  assert.deepEqual([row.triggers, row.procs, row.cooldownBlocked], [2, 2, 1]);

  // A 0% override still counts every ready control and never claims the cooldown.
  const [zero] = severanceProcRates([{ names: ['Severance'] }, { names: [] }], { [SEVERANCE_PROC_RATE.id]: 0 }, [0]);
  assert.deepEqual([zero.chance, zero.defaultChance, zero.custom], [0, SEVERANCE_PROC_RATE.defaultChance, true]);
  assert.deepEqual([zero.triggers, zero.procs, zero.cooldownBlocked], [2, 0, 0]);

  // Severance on the inactive set still lists the proc so a missing opportunity stays visible.
  const [inactive] = severanceProcRates([{ names: [] }, { names: ['Severance'] }], {}, []);
  assert.deepEqual([inactive.id, inactive.triggers], [SEVERANCE_PROC_RATE.id, 0]);
  assert.deepEqual(severanceProcRates([{ names: [] }, { names: [] }], {}, []), []);
});
