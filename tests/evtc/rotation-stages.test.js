import assert from 'node:assert/strict';
import { test } from 'node:test';
import { selectPlayerAgent } from '#gw2/integrations/logs/evtc/rotation/players.js';
import { legacyActivationActions, modernAnimationActions } from '#gw2/integrations/logs/evtc/rotation/animations.js';
import { EVTC_ACTIVATION, EVTC_STATE_CHANGE } from '#gw2/integrations/logs/evtc/types.js';
import { EVTC_FIXTURE_PLAYER as PLAYER, event, log } from '../helpers/evtc-fixture.js';

// Player selection must honor explicit addresses and reject ambiguity before replay inference.
test('EVTC player selection shares evidence ranking and address validation', () => {
  const second = { ...log().agents[0], address: 0x2000n, character: 'Second player' };
  const fixture = log({
    agents: [...log().agents, second],
    events: [event({ stateChange: EVTC_STATE_CHANGE.ANIMATION_START })]
  });
  assert.equal(selectPlayerAgent(fixture).agent.address, PLAYER);
  assert.equal(selectPlayerAgent(fixture, '0x2000').agent, second);
  assert.equal(selectPlayerAgent(fixture, 0x2000n).agent, second);
  for (const address of ['invalid', '0x3000']) {
    assert.throws(() => selectPlayerAgent(fixture, address), { code: 'PLAYER_NOT_FOUND' });
  }

  assert.throws(() => selectPlayerAgent(log({ agents: [] })), { code: 'NO_PLAYER' });
  assert.throws(() => selectPlayerAgent({ ...fixture, events: [] }), { code: 'PLAYER_SELECTION_REQUIRED' });
});

// Both encodings must pair a same-timestamp stop with the preceding cast, retaining a later start.
test('modern and legacy animation pairing preserve event order at a cast boundary', () => {
  for (const modern of [true, false]) {
    const start = {
      skillId: 1000,
      stateChange: modern ? EVTC_STATE_CHANGE.ANIMATION_START : EVTC_STATE_CHANGE.NONE,
      activation: modern ? EVTC_ACTIVATION.NONE : EVTC_ACTIVATION.START,
      value: 200
    };
    const fixture = log({
      events: [
        event({ ...start, time: 1000 }),
        event({
          time: 1200,
          skillId: 1000,
          stateChange: modern ? EVTC_STATE_CHANGE.ANIMATION_STOP : EVTC_STATE_CHANGE.NONE,
          activation: EVTC_ACTIVATION.CANCEL_FIRE,
          value: 200
        }),
        event({ ...start, time: 1200 })
      ]
    });
    const names = new Map([[1000, 'Fixture cast']]);
    const actions = modern
      ? modernAnimationActions(fixture, PLAYER, names, { buffTransitions: [] })
      : legacyActivationActions(fixture, PLAYER, names);
    assert.equal(actions.length, 2);
    assert.equal(actions[0].start, 1000);
    assert.equal(actions[0].end, 1200);
    assert.equal(actions[0].status, 'completed');
    assert.equal(actions[1].start, 1200);
    assert.equal(actions[1].status, 'unknown');
  }
});
