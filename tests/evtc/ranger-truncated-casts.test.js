import assert from 'node:assert/strict';
import test from 'node:test';

import { truncatedCastActions } from '#gw2/integrations/logs/evtc/rotation/professions/ranger/shared.js';
import { EVTC_ACTIVATION, EVTC_STATE_CHANGE } from '#gw2/integrations/logs/evtc/types.js';
import { EVTC_FIXTURE_PLAYER as PLAYER, event, log } from '../helpers/evtc-fixture.js';

test('Ranger precast recovery honors skill identity, completion evidence, and duplicate tolerance', () => {
  // Two events isolate a missing cast start from unrelated profession reconstruction.
  for (const [identity, activation, toleranceMs] of [
    [{ skillId: 69262, name: 'Overbearing Smash' }, EVTC_ACTIVATION.CANCEL_FIRE, 150],
    [{ skillId: 31503, name: 'Natural Convergence' }, EVTC_ACTIVATION.RESET, 200]
  ]) {
    const stop = event({
      time: 1_500,
      skillId: identity.skillId,
      stateChange: EVTC_STATE_CHANGE.ANIMATION_STOP,
      activation,
      value: 600,
      buffDamage: 900
    });
    const recover = (overrides = {}, actions = []) =>
      truncatedCastActions(
        {
          playerAddress: PLAYER,
          log: log({
            skills: [{ id: identity.skillId, name: 'Recorded name' }],
            events: [event({ source: 0n, target: PLAYER }), { ...stop, ...overrides }]
          })
        },
        actions,
        identity,
        toleranceMs
      );

    const [recovered] = recover();
    assert.equal(recovered.start, 900);
    assert.equal(recovered.end, 1_500);
    assert.equal(recovered.expectedDuration, 900);
    assert.equal(recovered.rawName, 'Recorded name');
    assert.equal(recovered.canonicalSkillId, identity.skillId);
    assert.equal(recovered.canonicalName, identity.name);
    assert.equal(recovered.status, 'completed');
    assert.equal(recovered.precast, true);
    assert.equal(recovered.evidence, 'initial-state');
    assert.equal(recover({ buffDamage: 0 })[0].expectedDuration, 600);

    for (const overrides of [
      { source: 0x2000n },
      { skillId: identity.skillId + 1 },
      { stateChange: EVTC_STATE_CHANGE.ANIMATION_START },
      { activation: EVTC_ACTIVATION.CANCEL_CANCEL },
      { value: 0 },
      { value: 500 }
    ]) {
      assert.deepEqual(recover(overrides), []);
    }

    for (const offset of [-toleranceMs, toleranceMs]) {
      assert.deepEqual(recover({}, [{ ...recovered, end: stop.time + offset }]), []);
    }

    assert.deepEqual(recover({}, [{ ...recovered, end: stop.time + toleranceMs + 1 }]), [recovered]);
    assert.deepEqual(recover({}, [{ ...recovered, rawSkillId: identity.skillId + 1 }]), [recovered]);
    assert.deepEqual(truncatedCastActions({ playerAddress: PLAYER, log: log() }, [], identity, toleranceMs), []);
  }
});
