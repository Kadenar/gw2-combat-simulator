import assert from 'node:assert/strict';
import test from 'node:test';

import { createRelicRuntime } from '#gw2/platform/equipment/relics/runtime.js';

function relicHarness(name) {
  const relic = createRelicRuntime(name);
  const procs = [];
  const conditions = [];
  const queued = [];
  const ctx = {
    relic,
    config: {},
    queue: { enqueue: (event) => queued.push(event) },
    recordProc: (kind, procName, at, sourceSkill, detail) => procs.push({ kind, procName, at, sourceSkill, detail })
  };
  const helpers = {
    activeConditionStackCount: () => 0,
    applyCondition: (_ctx, event) => {
      conditions.push(event);
      // Relic-applied conditions re-enter the condition stage like the resolver does.
      relic.rules.condition?.(ctx, relic.state, event, helpers);
      return event;
    }
  };
  return { relic, ctx, helpers, procs, conditions, queued };
}

function burning(at, overrides = {}) {
  return {
    type: 'condition',
    at,
    source: 'Fixture',
    skillName: 'Fixture Burn',
    actorType: 'player',
    condition: 'Burning',
    stacks: 1,
    duration: 4,
    ...overrides
  };
}

test('Last Tyrant explodes on the burning after five Fury stacks and respects its 12s cooldown', () => {
  const { relic, ctx, helpers, conditions, queued } = relicHarness('Last Tyrant');
  const apply = (event) => relic.rules.condition(ctx, relic.state, event, helpers);

  for (let at = 0; at < 5; at += 1) apply(burning(at));
  assert.equal(relic.state.stacks, 5);
  assert.equal(conditions.length, 0);

  apply(burning(5));
  assert.equal(conditions.length, 1);
  assert.deepEqual(
    { stacks: conditions[0].stacks, duration: conditions[0].duration, sourceId: conditions[0].sourceId },
    { stacks: 2, duration: 8, sourceId: 'relic.last-tyrant' }
  );
  // The strike coefficient is still an unknown placeholder, so the explosion emits no strike hit.
  assert.deepEqual(
    queued.filter((event) => event.type === 'damage'),
    []
  );
  // The explosion's own burning does not start the next Fury cycle.
  assert.equal(relic.state.stacks, 0);

  for (let at = 6; at < 12; at += 1) apply(burning(at));
  assert.equal(relic.state.stacks, 5);
  assert.equal(conditions.length, 1, 'cooldown blocks the second explosion');

  // Internal cooldowns stay blocked through their boundary timestamp.
  apply(burning(17));
  assert.equal(conditions.length, 1);
  apply(burning(17.25));
  assert.equal(conditions.length, 2);
});

test('Last Tyrant ignores non-burning and non-player applications', () => {
  const { relic, ctx, helpers } = relicHarness('Last Tyrant');
  relic.rules.condition(ctx, relic.state, burning(0, { condition: 'Bleeding' }), helpers);
  relic.rules.condition(ctx, relic.state, burning(0, { actorType: 'summon' }), helpers);
  assert.equal(Number(relic.state.stacks || 0), 0);
  relic.rules.condition(ctx, relic.state, burning(0, { actorType: 'effect', ownerActorType: 'player' }), helpers);
  assert.equal(relic.state.stacks, 1);
});

function combo(at, finisherType = 'Blast') {
  return { type: 'combo', at, actorType: 'player', skillName: 'Fixture Finisher', finisherType, fieldType: 'Fire' };
}

test("Visionary grants Vloxx's Vision at eight combos for 8s of +10% strike and condition damage", () => {
  const { relic, ctx } = relicHarness('Visionary');
  for (let at = 0; at < 7; at += 1) relic.rules.combo(ctx, relic.state, combo(at));
  assert.equal(relic.rules.outgoingDamageBonus(ctx, relic.state, 'strike', 7), 0);

  relic.rules.combo(ctx, relic.state, combo(7));
  assert.equal(relic.rules.outgoingDamageBonus(ctx, relic.state, 'strike', 7), 0.1);
  assert.equal(relic.rules.outgoingDamageBonus(ctx, relic.state, 'condition', 14.9), 0.1);
  assert.equal(relic.rules.outgoingDamageBonus(ctx, relic.state, 'condition', 15), 0);

  // Stacks do not build while the buff is active.
  relic.rules.combo(ctx, relic.state, combo(10));
  assert.equal(relic.state.stacks, 0);
  relic.rules.combo(ctx, relic.state, combo(15));
  assert.equal(relic.state.stacks, 1);
});

test('Visionary counts whirl finishers at most once per 3s', () => {
  const { relic, ctx } = relicHarness('Visionary');
  for (const at of [0, 0, 0.5, 2.9]) relic.rules.combo(ctx, relic.state, combo(at, 'Whirl'));
  assert.equal(relic.state.stacks, 1);
  relic.rules.combo(ctx, relic.state, combo(1, 'Projectile'));
  relic.rules.combo(ctx, relic.state, combo(3, 'Whirl'));
  assert.equal(relic.state.stacks, 2, 'the whirl ICD blocks through its boundary');
  relic.rules.combo(ctx, relic.state, combo(3.25, 'Whirl'));
  assert.equal(relic.state.stacks, 3);
});
