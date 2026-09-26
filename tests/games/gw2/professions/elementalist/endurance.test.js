import assert from 'node:assert/strict';
import test from 'node:test';
import { observedRuntime } from '#tests/helpers/observed-runtime.js';
import { runNative, runElementalist } from '#tests/helpers/elementalist-simulation.js';

// Drive recovery with accepted applications and actual clock advances; queued grants cannot predict endurance.
const vigor = (at, duration, extra = {}) => ({
  type: 'buff',
  kind: 'vigor',
  at,
  duration,
  stacks: 1,
  source: 'fixture',
  sourceId: 'fixture',
  actorType: 'player',
  ...extra
});
function recover(events, end, config = {}, timeline = []) {
  return runElementalist({
    config: { specialization: 'Core', initialEndurance: 0, ...config },
    rotation: [{ type: 'wait', durationMs: end * 1000 }],
    initialize: (r) => {
      for (const event of events) {
        if (event.cancelled) {
          const packet = { ...event };
          delete packet.cancelled;
          r.schedule('elementalist.packet', event.at, packet, { id: 'cancelled', generation: 0 });
          r.cancelOwner({ id: 'cancelled', generation: 0 });
        } else r.emit(event);
      }
    },
    timeline
  });
}

test('Elementalist ignores cancelled and other-only Vigor without depending on wait partitions', () => {
  for (const cancelled of [false, true])
    for (const times of [[], [2, 3, 4, 6]]) {
      const result = recover(
        [
          vigor(0, 20, { audience: { recipients: 'summons', affectsSelf: false, maximumRecipients: 5 } }),
          vigor(2, 2),
          vigor(0, 20, { cancelled: true }),
          { ...vigor(3, 2), type: 'boon_extension', cancelled }
        ],
        8,
        {},
        times.map((at) => ({ at, run: (r) => r.endurance.advance() }))
      );
      assert.equal(observedRuntime(result).profession.core.endurance, cancelled ? 45 : 50);
      assert.equal(observedRuntime(result).endurance.readyAt(50), cancelled ? 9 : 8);
    }
});
test('timed Vigor recovery crosses application and expiry boundaries', () => {
  const result = recover([vigor(2, 2)], 6, {}, [
    { at: 0, run: (r) => assert.equal(r.endurance.readyAt(50), 10) },
    { at: 2.001, run: (r) => assert.equal(r.endurance.readyAt(50), 9) }
  ]);
  assert.equal(observedRuntime(result).profession.core.endurance, 35);
});
test('Vigor stacks duration without stacking its rate and respects the duration cap', () => {
  assert.equal(observedRuntime(recover([vigor(3, 2), vigor(2, 2)], 8)).profession.core.endurance, 50);
  const capped = recover([vigor(0, 20), vigor(0, 20)], 32, {}, [{ at: 29, run: (r) => r.endurance.spend(100) }]);
  assert.equal(observedRuntime(capped).profession.core.endurance, 17.5);
});
test('permanent Vigor keeps its rate through timed expiry and endurance remains capped', () => {
  const result = recover([vigor(2, 2)], 30, { boons: { vigor: true } }, [
    {
      at: 6,
      run: (r) => {
        assert.equal(r.profession.core.endurance, 45);
        assert.equal(r.endurance.readyAt(50), 6.68);
      }
    }
  ]);
  assert.equal(observedRuntime(result).profession.core.endurance, 100);
});

test('Phoenix Vigor contributes to recovery and the next dodge after expiry', () => {
  const options = {
    lines: [['Fire'], ['Air'], ['Earth']],
    weapons: ['Scepter', 'Dagger'],
    assumptions: { vigor: false }
  };
  const recovery = runNative({ ...options, rotation: ['Dodge', 'Dodge', 'Phoenix', 6000] });
  const buff = recovery.events.find((event) => event.type === 'buff' && event.kind === 'vigor');
  const firstDodge = recovery.events.find((event) => event.type === 'action' && event.skillName === 'Dodge');
  const end = observedRuntime(recovery).time;
  assert.deepEqual(recovery.warnings, []);
  assert.ok(end > buff.at + buff.duration);
  // The first dodge is spent at completion; subsequent regeneration includes exactly the Vigor window.
  const expected = (end - firstDodge.endsAt) * 5 + buff.duration * 2.5;
  assert.ok(Math.abs(recovery.planningState.profession.endurance - expected) < 1e-6);

  const retry = runNative({ ...options, rotation: ['Dodge', 'Dodge', 'Phoenix', 'Dodge'] });
  const nextDodge = retry.events.filter((event) => event.type === 'action' && event.skillName === 'Dodge').at(-1);
  assert.deepEqual(retry.warnings, []);
  const threshold = firstDodge.endsAt + (50 - buff.duration * 2.5) / 5;
  const expectedReadyAt = Math.ceil(threshold * 25) / 25;
  assert.ok(expectedReadyAt > buff.at + buff.duration);
  assert.ok(Math.abs(nextDodge.at - expectedReadyAt) < 1e-6);
});
