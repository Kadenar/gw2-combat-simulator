import assert from 'node:assert/strict';
import test from 'node:test';
import { runEngineer } from '#tests/helpers/engineer-simulation.js';
import { runtimeFor } from '#tests/helpers/live-runtime.js';
import { ENGINEER_TRAIT_IDS as TRAIT } from '#gw2/professions/engineer/data/ids.js';

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

/** Endurance advances across actual boon boundaries, independently of how authored waits are partitioned. */
function recover(waits, events, config = {}) {
  return runEngineer(
    waits.map((durationMs) => ({ type: 'wait', durationMs })),
    config,
    {
      initialize(runtime) {
        runtime.profession.core.endurance = 0;
        for (const event of events) runtime.emit(event);
      }
    }
  );
}

test('Engineer endurance uses self Vigor applications and expiry across split waits', () => {
  for (const waits of [[6000], [2000, 1000, 1000, 2000]]) {
    const result = recover(waits, [vigor(2, 2), vigor(0, 20, false)]);
    assert.equal(result.planningState.profession.endurance, 35);
    assert.equal(runtimeFor(result).endurance.readyAt(50), 9);
  }
});

test('Engineer endurance uses pooled Vigor duration and actual extensions', () => {
  const result = recover(
    [8000],
    [
      vigor(2, 2),
      vigor(3, 2),
      {
        type: 'boon_extension',
        source: 'test',
        sourceId: 'extension',
        actorType: 'player',
        at: 4,
        kind: 'vigor',
        duration: 1
      }
    ]
  );
  assert.equal(result.planningState.profession.endurance, 52.5);
});

test('Engineer preserves Adrenal Implant, permanent Vigor and its endurance cap', () => {
  const traits = { selectedTraitIds: [TRAIT.ADRENAL_IMPLANT] };
  assert.equal(recover([6000], [vigor(2, 2)], traits).planningState.profession.endurance, 42.5);
  const config = { ...traits, boons: { vigor: true } };
  assert.equal(recover([6000], [vigor(2, 2)], config).planningState.profession.endurance, 52.5);
  assert.equal(recover([30000], [], config).planningState.profession.endurance, 100);
});
