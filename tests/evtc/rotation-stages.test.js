import assert from 'node:assert/strict';
import test from 'node:test';
import { modernAnimationActions, legacyActivationActions } from '#gw2/integrations/logs/evtc/rotation/animations.js';
import { evtcRecordingWindow, usesModernAnimations } from '#gw2/integrations/logs/evtc/recording.js';
import { selectPlayerAgent } from '#gw2/integrations/logs/evtc/rotation/players.js';
import { event, log, EVTC_FIXTURE_PLAYER as PLAYER } from '../helpers/evtc-fixture.js';

const names = new Map([
  [1000, 'First'],
  [2000, 'Second']
]);

// Pairing and recording boundaries are source contracts, independent of simulator skill timing.
test('modern and legacy casts pair within actor and skill groups', () => {
  for (const modern of [false, true]) {
    const decode = modern ? modernAnimationActions : legacyActivationActions;
    const start = (time, skillId) =>
      event({ time, skillId, value: 800, stateChange: modern ? 67 : 0, activation: modern ? 0 : 1 });
    const stop = (time, skillId, value) => event({ time, skillId, value, stateChange: modern ? 68 : 0, activation: 5 });
    const fixture = log({
      events: [
        event({ time: 0, stateChange: 1 }),
        start(100, 1000),
        start(200, 2000),
        stop(300, 1000, 200),
        stop(500, 2000, 300)
      ]
    });
    assert.deepEqual(
      decode(fixture, PLAYER, names).map((a) => [a.rawSkillId, a.start, a.end, a.status]),
      [
        [1000, 100, 300, 'completed'],
        [2000, 200, 500, 'completed']
      ]
    );
    const other = {
      ...fixture,
      events: [start(100, 1000), { ...stop(300, 1000, 200), source: 0x2000n }, event({ time: 900, stateChange: 2 })]
    };
    assert.equal(decode(other, PLAYER, names)[0].status, 'unknown');
  }
});

test('unmatched stops recover only starts strictly before the recording boundary', () => {
  for (const modern of [false, true]) {
    const decode = modern ? modernAnimationActions : legacyActivationActions;
    const fixture = log({
      header: { ...log().header, arcdpsBuild: modern ? '20260815' : '20260429' },
      events: [
        event({ time: 999999, stateChange: 15, source: 1n }),
        event({ time: 0, stateChange: 1, source: 0x2000n }),
        event({ time: 200, skillId: 1000, stateChange: modern ? 68 : 0, activation: 5, value: 800 }),
        event({ time: 300, skillId: 2000, stateChange: modern ? 68 : 0, activation: 5, value: 300 })
      ]
    });
    assert.equal(usesModernAnimations(fixture), modern);
    assert.deepEqual(evtcRecordingWindow(fixture), { start: 0, end: 300 });
    assert.deepEqual(
      decode(fixture, PLAYER, names).map((a) => [a.start, a.end]),
      [[-600, 200]]
    );
  }
});

test('missing stops cap at recording end and only unknown casts truncate at the next cast plus 10 ms', () => {
  const fixture = log({
    events: [
      event({ time: 0, stateChange: 67, skillId: 1000, value: 1000 }),
      event({ time: 200, stateChange: 67, skillId: 2000, value: 500 }),
      event({ time: 450, stateChange: 2 })
    ]
  });
  assert.deepEqual(
    modernAnimationActions(fixture, PLAYER, names).map((a) => [a.start, a.end, a.status]),
    [
      [0, 210, 'unknown'],
      [200, 450, 'unknown']
    ]
  );
  assert.equal(
    modernAnimationActions(
      log({ events: [event({ time: 0, stateChange: 67, skillId: 1000, value: 1000 })] }),
      PLAYER,
      names
    ).length,
    0
  );
});

test('EI activation status, duration tolerance and acceleration metadata survive decoding', () => {
  for (const [activation, status] of [
    [3, 'reduced'],
    [4, 'interrupted'],
    [5, 'completed'],
    [6, 'reduced']
  ]) {
    const fixture = log({
      events: [
        event({ time: 0, stateChange: 67, skillId: 1000, value: 900 }),
        event({ time: 400, stateChange: 68, skillId: 1000, activation, value: 400, buffDamage: 600 })
      ]
    });
    const [cast] = modernAnimationActions(fixture, PLAYER, names);
    assert.equal(cast.status, status);
    assert.equal(cast.acceleration, 1);
    assert.equal(cast.savedDurationMs, activation === 4 ? -400 : activation === 5 ? 0 : 200);
    const corrected = modernAnimationActions(
      { ...fixture, events: [fixture.events[0], { ...fixture.events[1], value: 411 }] },
      PLAYER,
      names
    )[0];
    assert.equal(corrected.end, 400);
    assert.equal(corrected.acceleration, 0);
  }
});

test('player selection recognizes stop-only evidence and validates explicit addresses', () => {
  const second = { ...log().agents[0], address: 0x2000n, character: 'Second' };
  const fixture = log({
    agents: [...log().agents, second],
    events: [
      event({ time: 0, stateChange: 1 }),
      event({ time: 200, stateChange: 68, skillId: 1000, value: 800, activation: 5 })
    ]
  });
  assert.equal(selectPlayerAgent(fixture).agent.address, PLAYER);
  assert.equal(selectPlayerAgent(fixture, '0x2000').agent, second);
  assert.throws(() => selectPlayerAgent(fixture, 'invalid'), { code: 'PLAYER_NOT_FOUND' });
  assert.throws(() => selectPlayerAgent({ ...fixture, events: [] }), { code: 'PLAYER_SELECTION_REQUIRED' });
});
