import { baseAttributeInputs } from '#gw2/platform/builds/attribute-inputs.js';
import assert from 'node:assert/strict';
import test from 'node:test';
import { runElementalist } from '#tests/helpers/elementalist-simulation.js';
import {
  ELEMENTALIST_SKILL_IDS as ID,
  ELEMENTALIST_TRAIT_IDS as TRAIT
} from '#gw2/professions/elementalist/data/ids.js';

// Sample live precision across activation and recovery so the passive cannot drift from the shared cooldown owner.
test('Signet of Fire precision follows recharge and resets unless Written in Stone preserves it', () => {
  for (const traited of [false, true]) {
    for (const interrupted of [false, true]) {
      for (const reset of [false, true]) {
        const samples = [];
        const result = runElementalist(
          [
            { type: 'wait', durationMs: 100 },
            { type: 'cast', skillId: ID.SIGNET_OF_FIRE, ...(interrupted ? { interruptAfterMs: 100 } : {}) },
            { type: 'wait', durationMs: 1000 },
            ...(reset ? [{ type: 'cooldown-reset' }] : []),
            { type: 'wait', durationMs: 15000 }
          ],
          {
            attributeInputs: baseAttributeInputs({ precision: 1000 }),
            selectedSkillIds: [5542],
            selectedTraitIds: traited ? [TRAIT.WRITTEN_IN_STONE] : []
          },
          {
            timeline: [0.05, 0.15, 1, reset ? 3 : 15].map((at) => ({
              at,
              run(runtime) {
                samples.push(runtime.combat.statsAt(runtime.time, null, runtime).precision);
              }
            }))
          }
        );
        assert.deepEqual(result.warnings, []);
        assert.deepEqual(
          samples,
          [1180, 1180, traited ? 1180 : 1000, 1180],
          JSON.stringify({ traited, interrupted, reset })
        );
      }
    }
  }
});
