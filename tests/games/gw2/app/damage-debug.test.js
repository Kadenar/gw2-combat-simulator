import assert from 'node:assert/strict';
import test from 'node:test';

import { damageDebugPayload } from '#gw2/app/results/damage-debug.js';
import { calculateBaselineSimulation } from '#gw2/app/simulation/baseline/baseline-simulation.js';
import { baseAttributeInputs } from '#gw2/platform/attributes/inputs.js';
import { createCanonicalCatalog } from '#gw2/platform/skills/catalog.js';
import { defineTestProfession } from '#tests/helpers/profession.js';

// One hit isolates capture and export contracts from saved rotations and profession-specific timing.
const profession = defineTestProfession({
  id: 'debug-fixture',
  name: 'Debug fixture',
  catalog: createCanonicalCatalog(),
  hooks: {
    initialize(context) {
      context.effects.emit({
        kind: 'packet',
        event: {
          type: 'damage',
          at: 0.1,
          source: 'fixture',
          sourceId: 'strike',
          actorType: 'player',
          coefficient: 1,
          weaponStrength: 1000
        }
      });
    }
  }
});

const request = () => ({
  gameId: 'gw2',
  contentId: profession.id,
  rotation: [{ type: 'wait', durationMs: 1000 }],
  baseConfig: {
    attributeInputs: baseAttributeInputs({ power: 1500, precision: 1700 }),
    randomness: { mode: 'stochastic', seed: 42 }
  },
  selectedPatchId: 'current'
});

test('baseline debug capture preserves seeded combat and snapshots export inputs', () => {
  const input = request();
  const plain = calculateBaselineSimulation(input, profession).result;
  assert.equal(damageDebugPayload(plain), null);
  assert.ok(plain.resolvedEvents.every((event) => !event.damageCalculation));
  const captured = calculateBaselineSimulation({ ...input, damageDiagnostics: true }, profession).result;
  assert.equal(captured.totalDamage, plain.totalDamage);
  assert.deepEqual(captured.randomness, plain.randomness);
  assert.deepEqual(
    captured.resolvedEvents.map(({ didCrit }) => didCrit),
    plain.resolvedEvents.map(({ didCrit }) => didCrit)
  );

  // Later editor mutations cannot pair old hit calculations with new run inputs.
  input.rotation[0].durationMs = 9000;
  input.baseConfig.attributeInputs.weaponSets[0].commonTotals.power = 9000;
  input.baseConfig.randomness.seed = 99;
  const exported = JSON.parse(JSON.stringify(damageDebugPayload(captured)));
  assert.equal(exported.rotation[0].durationMs, 1000);
  assert.equal(exported.config.attributeInputs.weaponSets[0].commonTotals.power, 1500);
  assert.equal(exported.config.randomness.seed, 42);
  assert.equal(exported.config.patchId, 'current');
  assert.deepEqual(exported.observationPolicy, { kind: 'rotation' });
  assert.equal(exported.result.damageEvents[0].damageCalculation.power, 1500);
});

// Switching or editing recaptures only the selected patch; no implicit comparison execution is allowed.
test('each baseline executes only its selected balance version', () => {
  const calculated = [];
  const tracked = {
    ...profession,
    runtimeFor(config) {
      calculated.push(config.patchId);
      return profession.runtimeFor(config);
    }
  };
  for (const patchId of ['current', 'current', 'preview', 'preview', 'current']) {
    const input = request();
    calculateBaselineSimulation(
      { ...input, selectedPatchId: patchId, baseConfig: { ...input.baseConfig, patchId } },
      tracked
    );
  }

  assert.deepEqual(calculated, ['current', 'current', 'preview', 'preview', 'current']);
});

test('selected patch and reference baselines retain their own capture context', () => {
  const output = calculateBaselineSimulation(
    {
      ...request(),
      damageDiagnostics: true,
      selectedPatchId: 'preview',
      baseConfig: { ...request().baseConfig, patchId: 'preview' },
      referenceRotation: [{ type: 'wait', durationMs: 2000 }]
    },
    profession
  );
  assert.equal(damageDebugPayload(output.result).config.patchId, 'preview');
  const reference = damageDebugPayload(output.referenceResult);
  assert.equal(reference.config.patchId, 'preview');
  assert.equal(reference.rotation[0].durationMs, 2000);
  assert.ok(reference.result.damageEvents[0].damageCalculation);
});

// Analysis explicitly requests the opposite patch; it never replaces the selected result or reference configuration.
test('Analysis comparison executes only its requested opposite patch and captures each result independently', () => {
  const calculated = [];
  const tracked = {
    ...profession,
    runtimeFor(config) {
      calculated.push(config.patchId);
      return profession.runtimeFor(config);
    }
  };
  const input = request();
  const output = calculateBaselineSimulation(
    {
      ...input,
      collectChartData: true,
      damageDiagnostics: true,
      baseConfig: { ...input.baseConfig, patchId: 'current' },
      comparisonConfig: { ...input.baseConfig, patchId: 'preview' }
    },
    tracked
  );
  assert.deepEqual(calculated, ['current', 'preview']);
  assert.equal(damageDebugPayload(output.result).config.patchId, 'current');
  assert.equal(output.comparisonResult.patchId, 'preview');
  assert.equal(damageDebugPayload(output.comparisonResult.result).config.patchId, 'preview');
  assert.ok(output.result.effectReport);
  assert.equal(output.comparisonResult.result.effectReport, null);
});
