import assert from 'node:assert/strict';
import test from 'node:test';

import { createRelicRuntime } from '#gw2/platform/equipment/relics/runtime.js';
import { materializeSkillEffectApplications } from '#gw2/platform/engine/effects/materializer.js';
import { emitProfiledCondition } from '#gw2/professions/elementalist/core/mechanics/effects.js';

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
  // The explosion strike temporarily borrows Bloodstone Explosion's coefficient.
  assert.deepEqual(
    queued.filter((event) => event.type === 'damage').map((event) => [event.coefficient, event.sourceId]),
    [[3, 'relic.last-tyrant']]
  );
  // The explosion's own burning does not start the next Fury cycle.
  assert.equal(relic.state.stacks, 0);

  // No Fury stacks build during the cooldown, including at its boundary timestamp.
  for (let at = 6; at <= 17; at += 1) apply(burning(at));
  assert.equal(relic.state.stacks, 0, 'cooldown blocks stack gain');
  assert.equal(conditions.length, 1);

  // Once the cooldown expires, stacks rebuild before the next explosion.
  for (const at of [17.25, 18, 19, 20, 21]) apply(burning(at));
  assert.equal(relic.state.stacks, 5);
  assert.equal(conditions.length, 1);
  apply(burning(22));
  assert.equal(conditions.length, 2);
});

test('Last Tyrant rounds its 250ms stack marker to 40ms ticks and lets the sixth application explode immediately', () => {
  const { relic, ctx, helpers, conditions, queued } = relicHarness('Last Tyrant');
  const apply = (at, sourceId = 'skill-a') =>
    relic.rules.condition(ctx, relic.state, burning(at, { sourceId, stacks: 3 }), helpers);

  // Each eligible application grants one Fury stack, regardless of its Burning stack count.
  for (const [index, at] of [0, 0.28, 0.56, 0.84].entries()) {
    apply(at);
    assert.equal(relic.state.stacks, index + 1);
    // Other sources remain blocked before expiry, even if 250ms has elapsed.
    apply(at + 0.279, 'skill-b');
    assert.equal(relic.state.stacks, index + 1);
    assert.equal(conditions.length, 0);
    assert.equal(queued.length, 0);
  }

  apply(1.12);
  assert.equal(relic.state.stacks, 5);
  apply(1.121);
  assert.equal(relic.state.stacks, 0);
  assert.equal(conditions.length, 1);
  assert.equal(queued.length, 1);

  // Tick rounding is absolute: a marker started at 41ms expires at 320ms.
  const second = relicHarness('Last Tyrant');
  const applySecond = (at) => second.relic.rules.condition(second.ctx, second.relic.state, burning(at), second.helpers);
  applySecond(0.041);
  applySecond(0.319);
  assert.equal(second.relic.state.stacks, 1);
  applySecond(0.32);
  assert.equal(second.relic.state.stacks, 2);
});

test('Last Tyrant ignores non-burning and non-player applications', () => {
  const { relic, ctx, helpers } = relicHarness('Last Tyrant');
  relic.rules.condition(ctx, relic.state, burning(0, { condition: 'Bleeding' }), helpers);
  relic.rules.condition(ctx, relic.state, burning(0, { actorType: 'summon' }), helpers);
  assert.equal(Number(relic.state.stacks || 0), 0);
  relic.rules.condition(ctx, relic.state, burning(0, { actorType: 'effect', ownerActorType: 'player' }), helpers);
  assert.equal(relic.state.stacks, 1);
});

// Actual skill packets must finish a four-stack Fury cycle at one impact without multiplying Burning damage.
test('one-time multi-stack Burning skills expose each stack to Last Tyrant at the same impact', async () => {
  const skillsByProfession = {
    elementalist: { 5679: 3, 5675: 2, 5691: 2, 34736: 3, 5542: 2, 30662: 2, 76585: 2, 71907: 2, 5535: 2 },
    engineer: { 72974: 3, 43630: 2 },
    guardian: { 9088: 2, 9089: 3, 9151: 3, 43826: 2, 71817: 5, 42924: 3 },
    necromancer: { 62655: 3 },
    ranger: { 12597: 3 },
    revenant: { 62962: 2, 27162: 2, 46857: 2 },
    thief: { 76895: 2, 76733: 2 },
    warrior: { 14519: 3, 42803: 2, 80226: 2 }
  };
  for (const [profession, skills] of Object.entries(skillsByProfession)) {
    const module = await import(`#gw2/professions/${profession}/catalog.js`);
    for (const [id, totalStacks] of Object.entries(skills)) {
      const skill = module[`${profession}Catalog`].skillsById.get(Number(id));
      const packets = skill.effects
        .flatMap((effect) =>
          materializeSkillEffectApplications({
            skill,
            effect,
            start: 1,
            fullEnd: 2,
            baseEvent: { source: profession, sourceId: skill.id, skillName: skill.name, actorType: 'player' }
          })
        )
        .map(({ event }) => event)
        .filter((event) => event.type === 'condition' && event.condition === 'Burning');
      assert.equal(packets.length, totalStacks, skill.name);
      assert.ok(
        packets.every((event) => event.stacks === 1 && event.at === packets[0].at),
        skill.name
      );
      const { relic, ctx, helpers, conditions } = relicHarness('Last Tyrant');
      relic.state.stacks = 4;
      for (const event of packets) relic.rules.condition(ctx, relic.state, event, helpers);
      assert.equal(conditions.length, 1, skill.name);
      assert.equal(conditions[0].at, packets[0].at, skill.name);
    }
  }
});

// Shared one-time proc emission preserves profile values and leaves other conditions bundled.
test('profiled Burning procs preserve fractional totals and source attribution when split', () => {
  for (const [condition, stacks, expected] of [
    ['Burning', 2.5, [1, 1, 0.5]],
    ['Bleeding', 3, [3]]
  ]) {
    const events = [];
    const context = {
      profession: { id: 'elementalist' },
      catalog: {
        skillsById: new Map(),
        skillsByName: new Map(),
        balanceProfilesById: new Map([
          [
            'fixture',
            {
              effects: [{ type: 'condition', name: 'Fire', condition, stacks, duration: 7 }]
            }
          ]
        ])
      },
      emit: (event) => events.push(event)
    };
    emitProfiledCondition(context, 3, 'fixture', 'Fire', 'Fixture Proc', 123, 'Fixture Skill');
    assert.deepEqual(
      events.map((event) => event.stacks),
      expected
    );
    assert.ok(
      events.every(
        (event) =>
          event.at === 3 && event.duration === 7 && event.sourceId === 123 && event.triggeredBy === 'Fixture Skill'
      )
    );
  }
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
