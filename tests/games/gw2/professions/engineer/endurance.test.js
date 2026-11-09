import assert from 'node:assert/strict';
import test from 'node:test';

import { ENGINEER_TRAIT_IDS as TRAIT } from '#gw2/professions/engineer/data/ids.js';
import { PROFESSION_STATE_IDS as STATE } from '#gw2/professions/state-ids.js';
import { withProfile } from '#tests/helpers/catalog-overrides.js';
import { runEngineer } from '#tests/helpers/engineer-simulation.js';

const vigor = (at, duration, self = true) => ({
  type: 'buff',
  source: 'test',
  sourceId: 'vigor',
  actorType: 'player',
  kind: 'vigor',
  stacks: 1,
  at,
  duration,
  audience: { recipients: self ? 'self' : 'summons', affectsSelf: self }
});

/** Endurance advances across actual boon boundaries from a zeroed pool. */
function recover(waits, events, config = {}) {
  return runEngineer(
    waits.map((durationMs) => ({ type: 'wait', durationMs })),
    config,
    {
      initialize(runtime) {
        runtime.profession.core.endurance.value = 0;
        for (const event of events) runtime.effects.emit({ kind: 'packet', event: event });
      }
    }
  );
}

test('Engineer preserves Adrenal Implant, permanent Vigor and its endurance cap', () => {
  const traits = { selectedTraitIds: [TRAIT.ADRENAL_IMPLANT] };
  assert.equal(recover([6000], [vigor(2, 2)], traits).planningState.profession[STATE.ENDURANCE].value, 42.5);
  const config = { ...traits, boons: { vigor: true } };
  assert.equal(recover([6000], [vigor(2, 2)], config).planningState.profession[STATE.ENDURANCE].value, 52.5);
  assert.equal(recover([30000], [], config).planningState.profession[STATE.ENDURANCE].value, 100);
});

test('Adrenal Implant owns its patchable bonus alongside shared base endurance rules', () => {
  // Changing the selected trait's bonus must affect recovery without a profession resource profile.
  for (const bonus of [0, 0.5]) {
    const result = runEngineer(
      [{ type: 'wait', durationMs: 4000 }],
      {
        selectedTraitIds: [TRAIT.ADRENAL_IMPLANT],
        boons: { vigor: true }
      },
      {
        extend: (native) => ({
          catalog: withProfile(native.catalog, TRAIT.ADRENAL_IMPLANT, { enduranceRegenerationBonus: bonus })
        }),
        initialize(runtime) {
          runtime.profession.core.endurance.value = 0;
        }
      }
    );
    assert.equal(result.planningState.profession[STATE.ENDURANCE].value, 4 * 5 * (1.5 + bonus));
  }
});
