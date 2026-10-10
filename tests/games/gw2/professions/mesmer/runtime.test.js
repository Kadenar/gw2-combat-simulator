import { baseAttributeInputs } from '#gw2/platform/builds/attribute-inputs.js';
import assert from 'node:assert/strict';
import test from 'node:test';
import { runMesmer } from '#tests/helpers/mesmer-simulation.js';
import { MESMER_TRAIT_IDS as TRAIT } from '#gw2/professions/mesmer/data/ids.js';

test('retired clone packets cannot grant accepted critical conditions', () => {
  // Cancellation happens before impact; the surviving owner's sampled hit alone can trigger Sharper Images.
  const result = runMesmer(
    [{ type: 'wait', durationMs: 1200 }],
    {
      specialization: 'Core',
      selectedTraitIds: [TRAIT.SHARPER_IMAGES],
      attributeInputs: baseAttributeInputs({ precision: 4000 }),
      target: { armor: 2597 }
    },
    {
      initialize(runtime) {
        for (const id of [0, 1])
          runtime.effects.emit({
            kind: 'packet',
            event: {
              type: 'damage',
              at: 1,
              source: 'Clone',
              sourceId: 'clone-test',
              actorType: 'summon',
              summonKind: 'clone',
              summonOwner: `mesmer.clone:${id}`,
              metadata: { cloneId: id },
              coefficient: 1,
              weaponStrength: 1000
            },
            owner: { id: `mesmer.clone:${id}`, generation: 0 }
          });
        runtime.cancelOwner({ id: 'mesmer.clone:0', generation: 0 });
      }
    }
  );
  assert.deepEqual(result.warnings, []);
  assert.equal(result.resolvedEvents.filter((event) => event.type === 'damage').length, 1);
  assert.equal(result.events.filter((event) => event.type === 'condition' && event.condition === 'Bleeding').length, 1);
});
