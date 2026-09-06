import assert from 'node:assert/strict';
import test from 'node:test';
import { runNative } from '../../helpers/elementalist-simulation.js';
import {
  elementalistEnduranceReadyAt,
  updateEndurance
} from '#gw2/professions/elementalist/core/mechanics/endurance.js';

// Use explicit self/other recipients to verify that only player Vigor changes recovery.
const vigor = (at, duration, includesSelf = true) => ({
  type: 'buff',
  kind: 'vigor',
  at,
  duration,
  resolvedAudience: { includesSelf, includesSummons: false, companionIds: [] }
});

test('timed Vigor recovery crosses application and expiry boundaries without rewinding', () => {
  const context = { config: {}, events: [vigor(2, 2), vigor(0, 20, false)], epsilon: 1e-9 };
  const state = { endurance: 0, enduranceUpdatedAt: 0 };

  // Two base seconds, two Vigor seconds, then two base seconds restore 35 endurance.
  updateEndurance(context, state, 6);
  assert.equal(state.endurance, 35);
  updateEndurance(context, state, 3);
  assert.deepEqual(state, { endurance: 35, enduranceUpdatedAt: 6 });
  assert.equal(elementalistEnduranceReadyAt(context, 0, 20, 0), 2 + 10 / 7.5);
  assert.equal(elementalistEnduranceReadyAt(context, 0, 50, 0), 9);
  assert.equal(elementalistEnduranceReadyAt(context, 0, 50, 4), 14);
});

test('Vigor stacks duration without stacking its rate and respects the duration cap', () => {
  const context = { config: {}, events: [vigor(3, 2), vigor(2, 2)], epsilon: 1e-9 };
  const state = { endurance: 0, enduranceUpdatedAt: 0 };
  updateEndurance(context, state, 8);
  assert.equal(state.endurance, 50);
  assert.equal(elementalistEnduranceReadyAt(context, 0, 50, 0), 8);

  context.events = [vigor(0, 20), vigor(0, 20)];
  const afterCap = { endurance: 0, enduranceUpdatedAt: 29 };
  updateEndurance(context, afterCap, 32);
  assert.equal(afterCap.endurance, 17.5);
});

test('permanent Vigor keeps its rate through timed expiry and endurance remains capped', () => {
  const context = { config: { boons: { vigor: true } }, events: [vigor(2, 2)], epsilon: 1e-9 };
  const state = { endurance: 0, enduranceUpdatedAt: 0 };
  updateEndurance(context, state, 6);
  assert.equal(state.endurance, 45);
  assert.equal(elementalistEnduranceReadyAt(context, 0, 50, 0), 50 / 7.5);
  updateEndurance(context, state, 30);
  assert.equal(state.endurance, 100);
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
  const end = recovery.steps.at(-1).end / 1000;
  assert.deepEqual(recovery.warnings, []);
  assert.ok(end > buff.at + buff.duration);
  // The first dodge is spent at completion; subsequent regeneration includes exactly the Vigor window.
  const expected = (end - firstDodge.endsAt) * 5 + buff.duration * 2.5;
  assert.ok(Math.abs(recovery.endState.profession.endurance - expected) < 1e-6);

  const retry = runNative({ ...options, rotation: ['Dodge', 'Dodge', 'Phoenix', 'Dodge'] });
  const nextDodge = retry.events.filter((event) => event.type === 'action' && event.skillName === 'Dodge').at(-1);
  assert.deepEqual(retry.warnings, []);
  const expectedReadyAt = firstDodge.endsAt + (50 - buff.duration * 2.5) / 5;
  assert.ok(expectedReadyAt > buff.at + buff.duration);
  assert.ok(Math.abs(nextDodge.at - expectedReadyAt) < 1e-6);
});
