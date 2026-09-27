import assert from 'node:assert/strict';
import test from 'node:test';
import { runMesmer } from '#tests/helpers/mesmer-simulation.js';
import { emitMesmerPacket } from '#gw2/professions/mesmer/core/events.js';
import { MESMER_TRAIT_IDS as TRAIT } from '#gw2/professions/mesmer/data/ids.js';

test('retired clone packets cannot grant accepted critical conditions', () => {
  // Cancellation happens before impact; the surviving owner's sampled hit alone can trigger Sharper Images.
  const result = runMesmer({
    config: {
      specialization: 'Core',
      selectedTraitIds: [TRAIT.SHARPER_IMAGES],
      stats: { precision: 4000 },
      target: { armor: 2597 }
    },
    rotation: [{ type: 'wait', durationMs: 1200 }],
    initialize(runtime) {
      for (const id of [0, 1])
        emitMesmerPacket(runtime, {
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
        });
      runtime.cancelOwner({ id: 'mesmer.clone:0', generation: 0 });
    }
  });
  assert.deepEqual(result.warnings, []);
  assert.equal(result.resolvedEvents.filter((event) => event.type === 'damage').length, 1);
  assert.equal(result.events.filter((event) => event.type === 'condition' && event.condition === 'Bleeding').length, 1);
});
