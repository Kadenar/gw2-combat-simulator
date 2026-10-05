import assert from 'node:assert/strict';
import test from 'node:test';
import { createRelicRuntime, invokeRelicHook } from '#gw2/platform/equipment/relics/runtime.js';
import { captureAcceptedBuffEmissions } from '#tests/helpers/effect-emission.js';

// Isolate the real relic hooks so refresh and transition contracts need no saved rotation.
function fixture(name, config = {}) {
  const captured = captureAcceptedBuffEmissions();
  return { ...captured, relic: createRelicRuntime(name), config };
}

test('Thief relic refreshes all stacks at cap and rejects hits outside its weapon trigger', () => {
  const context = fixture('Thief');
  const skill = { type: 'Weapon', cooldown: 5 };
  const hit = (at, actorType = 'player', weapon = skill) =>
    invokeRelicHook(context, 'afterHit', { at, actorType, skillName: 'Fixture weapon' }, weapon);
  for (const at of [0, 1, 2, 3, 4, 5.001]) hit(at);
  const buff = context.relic.state.refreshedStacks;
  assert.deepEqual(buff, { stacks: 5, expiresAt: 11.04 });
  hit(6, 'summon');
  hit(6, 'player', { type: 'Utility', cooldown: 5 });
  hit(6, 'player', { type: 'Weapon', cooldown: 0 });
  assert.deepEqual(context.relic.state.refreshedStacks, buff);
  assert.equal(invokeRelicHook(context, 'strikeMultiplier', { at: 11.039 }), 1.05);
  assert.equal(invokeRelicHook(context, 'strikeMultiplier', { at: 11.04 }), 1);
  assert.deepEqual(context.relic.state.refreshedStacks, buff, 'queries cannot settle the owner');
  hit(11.04);
  assert.equal(context.relic.state.refreshedStacks.stacks, 1);
  const refresh = context.announcements[5].announcement;
  assert.equal(refresh.expiresAt, 11.04);
  assert.deepEqual(refresh.effectState, { stacks: 5, maximumStacks: 5 });
});

test('Bloodstone refreshes Volatility until the fourth blast consumes it and blocks grants during Fervor', () => {
  const context = fixture('Bloodstone');
  const combo = (at, finisherType = 'Blast') =>
    invokeRelicHook(context, 'combo', { at, finisherType, skillName: 'Fixture blast' });
  combo(0.001);
  assert.deepEqual(context.relic.state.refreshedStacks, { stacks: 1, expiresAt: 10.04 });
  combo(9);
  combo(18);
  assert.deepEqual(context.relic.state.refreshedStacks, { stacks: 3, expiresAt: 28 });
  combo(19, 'Leap');
  assert.equal(context.relic.state.refreshedStacks.stacks, 3);
  combo(20);
  assert.deepEqual(context.relic.state.refreshedStacks, { stacks: 0, expiresAt: 0 });
  assert.equal(context.buffs.get('bloodstone-fervor').at(-1).expiresAt, 28);
  const consumption = context.announcements.at(-2).announcement;
  assert.equal(consumption.name, 'Bloodstone Volatility');
  assert.equal(consumption.expiresAt, 20);
  assert.equal(consumption.effectState.stacks, 0, 'reporting ends the consumed pool at the transition');
  assert.equal(context.announcements.at(-1).announcement.name, 'Relic of Bloodstone');
  combo(27.999);
  assert.equal(context.relic.state.refreshedStacks.stacks, 0);
  combo(28);
  assert.equal(context.relic.state.refreshedStacks.stacks, 1);
  combo(38);
  assert.deepEqual(context.relic.state.refreshedStacks, { stacks: 1, expiresAt: 48 });
});

test('Thorns preserves its deterministic ramp while reporting finite refreshes after reaching the cap', () => {
  const context = fixture('Thorns', { initialThornsStacks: 9 });
  invokeRelicHook(context, 'passiveTimeline', 80);
  const rows = context.announcements.map(({ announcement }) => announcement);
  assert.equal(rows[0].effectState.stacks, 9);
  assert.equal(rows[0].expiresAt, 30);
  assert.equal(rows[1].at, 3);
  assert.equal(rows[1].effectState.stacks, 10);
  assert.equal(rows[1].expiresAt, 33);
  assert.equal(rows.at(-1).at, 78);
  assert.equal(rows.at(-1).effectState.stacks, 10);
  assert.equal(rows.at(-1).expiresAt, 108);
  // Reordered historical queries share the schedule and never mutate equipment state.
  for (const [at, damage] of [
    [80, 300],
    [2.99, 270],
    [3, 300],
    [0, 270],
    [48, 300]
  ]) {
    assert.equal(invokeRelicHook(context, 'conditionDamageBonus', at), damage);
  }

  assert.deepEqual(context.relic.state, {});
});
