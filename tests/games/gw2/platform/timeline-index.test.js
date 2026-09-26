import { simulateGw2 } from '#gw2/platform/simulation/simulate.js';
import assert from 'node:assert/strict';
import test from 'node:test';

import { createGw2TimelineIndex } from '#gw2/platform/combat/query/timeline-index.js';
import { createGw2CombatQuery } from '#gw2/platform/combat/query/combat-query.js';
import { createCanonicalCatalog } from '#gw2/platform/engine/skills/canonical-skill-catalog.js';
import { defineProfession } from '#gw2/platform/engine/profession/contract.js';

// Constant recharge rates bypass boon history, including explicit false console inputs.
test('player recharge never samples Alacrity grants or expiry', () => {
  for (const alacrity of [undefined, false, true]) {
    const events = [
      {
        get type() {
          throw new Error('Recharge sampled boon history');
        }
      }
    ];
    const timeline = createGw2TimelineIndex({ events, config: { boons: { alacrity } } });
    assert.equal(timeline.rechargeReadyAt({ id: 1, rechargeBuffAudience: 'self' }, { startedAt: 2, work: 10 }), 10);
    assert.equal(timeline.rechargeReadyAt({ id: 2, rechargeIgnoresAlacrity: true }, { startedAt: 2, work: 10 }), 12);
  }
});

test('Chronomancer recharge applies its increased rate only to player skills', () => {
  const timeline = createGw2TimelineIndex({ config: { specialization: 'Chronomancer' } });
  const skill = { id: 1, name: 'Recharge' };
  const progress = { startedAt: 0, work: 10 };
  assert.equal(timeline.rechargeReadyAt(skill, progress), 10 / 1.5);
  assert.equal(timeline.rechargeReadyAt({ ...skill, rechargeBuffAudience: 'summon' }, progress), 10);
  assert.equal(timeline.rechargeReadyAt({ ...skill, name: 'Swap Weapons' }, progress), 10);
});

// Passive cooldown checks use permanent Alacrity regardless of transient grants.
test('passive cooldown queries integrate committed recharge and retain historical reset boundaries', () => {
  const skill = { id: 990001, name: 'Passive skill', castTimeMs: 0, cooldown: 10, effects: [] };
  const profession = defineProfession({
    id: 'passive-recharge',
    name: 'Passive recharge',
    catalog: createCanonicalCatalog({ generated: [skill] })
  });
  const owner = { source: 'fixture', sourceId: 'fixture', actorType: 'player' };
  const result = simulateGw2({
    profession: {
      runtimeFor(config) {
        return {
          ...profession.runtimeFor(config),
          initialize(runtime) {
            runtime.emit({ ...owner, type: 'buff', kind: 'alacrity', at: 2, duration: 4, stacks: 1 });
          }
        };
      }
    },
    rotation: [skill.id, { type: 'wait', durationMs: 9000 }]
  });
  const timeline = createGw2CombatQuery({ profession, events: result.events }).timeline;
  assert.equal(timeline.skillOnCooldownAt(skill.id, 8), false);
  assert.equal(timeline.skillOnCooldownAt(skill.id, 7.999999), true);
  result.events.push({ ...owner, type: 'marker', action: 'cooldown-reset', at: 5 });
  assert.equal(timeline.skillOnCooldownAt(skill.id, 5), false);
  assert.equal(timeline.skillOnCooldownAt(skill.id, 4.999999), true);
});

test('passive cooldown queries honor recharge anchors and completion ticks despite boon extensions', () => {
  const skill = { id: 990001, name: 'Passive skill', castTimeMs: 2000, cooldown: 10, effects: [] };
  const profession = defineProfession({
    id: 'passive-extension',
    name: 'Passive extension',
    catalog: createCanonicalCatalog({ generated: [skill] })
  });
  const owner = { source: 'fixture', sourceId: 'fixture', actorType: 'player' };
  const result = simulateGw2({
    profession: {
      runtimeFor(config) {
        return {
          ...profession.runtimeFor(config),
          initialize(runtime) {
            runtime.emit({ ...owner, type: 'buff', kind: 'alacrity', at: 1, duration: 4, stacks: 1 });
            runtime.emit({ ...owner, type: 'boon_extension', at: 3, duration: 2 });
          }
        };
      }
    },
    rotation: [skill.id, { type: 'wait', durationMs: 10000 }]
  });
  const timeline = createGw2CombatQuery({ profession, events: result.events }).timeline;
  assert.equal(timeline.skillOnCooldownAt(skill.id, 9.999999), true);
  assert.equal(timeline.skillOnCooldownAt(skill.id, 10), false);
});

// Adjacent microseconds remain distinct for swaps, actions, snapshots, resets, and recharge deadlines.
test('timeline state uses canonical instants without admitting future events', () => {
  const events = [
    weaponSetEvent(0.56 + 0.04, 0, 2),
    weaponSetEvent(0.600001, 1, 1),
    { type: 'action', at: 0, skillId: 1, rechargeReadyAt: 0.600001 },
    { type: 'action', at: 0.56 + 0.04, skillId: 2, rechargeReadyAt: 2 },
    { type: 'cooldown_snapshot', at: 0.600002, cooldowns: { 1: 3 } },
    { type: 'marker', action: 'cooldown-reset', at: 0.600003 }
  ];
  const timeline = createGw2TimelineIndex({ events });
  assert.equal(timeline.activeWeaponSetAt(0.599999), 1);
  assert.equal(timeline.activeWeaponSetAt(0.6), 2);
  assert.equal(timeline.activeWeaponSetAt(0.600001), 1);
  assert.equal(timeline.skillOnCooldownAt(1, 0.56 + 0.04), true);
  assert.equal(timeline.skillOnCooldownAt(1, 0.600001), false);
  assert.equal(timeline.skillOnCooldownAt(2, 0.6), false);
  assert.equal(timeline.skillOnCooldownAt(2, 0.600001), true);
  assert.equal(timeline.skillOnCooldownAt(1, 0.600002), true);
  assert.equal(timeline.skillOnCooldownAt(1, 0.600003), false);
});

test('new Compounding Power stacks do not refresh earlier stacks', () => {
  // Each application expires on its own deadline, even when a later stack is still active.
  const timeline = createGw2TimelineIndex({
    events: [
      buffEvent({ kind: 'compounding', at: 0, duration: 8, stacks: 1 }),
      buffEvent({ kind: 'compounding', at: 7, duration: 8, stacks: 1 })
    ]
  });
  assert.equal(timeline.timedStacks('compounding', 7, 8, 5), 2);
  assert.equal(timeline.timedStacks('compounding', 8, 8, 5), 1);
  assert.equal(timeline.timedStacks('compounding', 15, 8, 5), 0);
});

function weaponSetEvent(at, causalOrder, weaponSet) {
  return {
    type: 'weapon_set',
    at,
    causalOrder,
    source: 'fixture',
    sourceId: `set-${weaponSet}`,
    weaponSet
  };
}

test('timeline indexing orders late events by timestamp and causal order', () => {
  const timeline = createGw2TimelineIndex({
    events: [weaponSetEvent(2, 3, 2), weaponSetEvent(1, 2, 1), weaponSetEvent(1, 1, 2)]
  });

  assert.equal(timeline.activeWeaponSetAt(1), 1);
  assert.equal(timeline.activeWeaponSetAt(2), 2);
});

// Small histories exercise cache reuse and invalidation without coupling expectations to a saved rotation.
function buffEvent(overrides = {}) {
  return {
    type: 'buff',
    at: 0,
    source: 'Trait',
    sourceId: 'fixture.buff',
    kind: 'might',
    duration: 2,
    stacks: 4,
    resolvedAudience: {
      includesSelf: true,
      includesSummons: true,
      alliedPlayerCount: 0,
      companionIds: ['pet-a'],
      recipientCount: 2
    },
    ...overrides
  };
}

test('repeated timeline queries reuse answers, including zero stacks and a ready cooldown', () => {
  let buffReads = 0;
  let cooldownReads = 0;
  // Count history reads so removing memoization fails this check without relying on wall-clock timing.
  const measured = buffEvent();
  Object.defineProperty(measured, 'duration', {
    get() {
      buffReads++;
      return 2;
    }
  });
  const timeline = createGw2TimelineIndex({
    events: [
      measured,
      {
        type: 'action',
        at: 0,
        skillId: 1,
        get rechargeReadyAt() {
          cooldownReads++;
          return 2;
        }
      }
    ]
  });
  for (const [time, stacks, cooldown] of [
    [1, 4, true],
    [2, 0, false],
    [1, 4, true]
  ]) {
    assert.equal(timeline.buffStacksAt('might', time, 0, 25), stacks);
    assert.equal(timeline.skillOnCooldownAt(1, time), cooldown);
    const reads = [buffReads, cooldownReads];
    assert.equal(timeline.buffStacksAt('might', time, 0, 25), stacks);
    assert.equal(timeline.skillOnCooldownAt(1, time), cooldown);
    assert.deepEqual([buffReads, cooldownReads], reads);
  }
});

test('same-time appends, replacements, resets, and truncation invalidate timeline answers', () => {
  const events = [buffEvent(), { type: 'action', at: 0, skillId: 1, rechargeReadyAt: 2 }];
  const timeline = createGw2TimelineIndex({ events });
  assert.equal(timeline.timedStacks('might', 1, 0, 25), 4);
  assert.equal(timeline.skillOnCooldownAt(1, 1), true);
  assert.equal(timeline.skillOnCooldownAt(2, 1), false);

  events.push(buffEvent({ at: 1, stacks: 2 }), { type: 'cooldown_snapshot', at: 1, cooldowns: { 2: 3 } });
  assert.equal(timeline.timedStacks('might', 1, 0, 25), 6);
  assert.equal(timeline.skillOnCooldownAt(1, 1), false);
  assert.equal(timeline.skillOnCooldownAt(2, 1), true);

  const previous = events[0];
  events[0] = { ...previous, duration: 0.5 };
  timeline.onEventReplaced(previous, events[0]);
  assert.equal(timeline.timedStacks('might', 1, 0, 25), 2);
  const snapshot = events[3];
  events[3] = { ...snapshot, cooldowns: { 1: 3 } };
  timeline.onEventReplaced(snapshot, events[3]);
  assert.equal(timeline.skillOnCooldownAt(1, 1), true);
  assert.equal(timeline.skillOnCooldownAt(2, 1), false);

  events.push({ type: 'marker', action: 'cooldown-reset', at: 1 });
  assert.equal(timeline.skillOnCooldownAt(1, 1), false);
  assert.equal(timeline.skillOnCooldownAt(1, 0.25), true);
  assert.equal(timeline.timedStacks('might', 0.25, 0, 25), 4);
  events.length = 0;
  assert.equal(timeline.timedStacks('might', 0.25, 0, 25), 0);
  assert.equal(timeline.skillOnCooldownAt(1, 0.25), false);
});

test('buff query arguments and timeline instances cannot share another audience or duration answer', () => {
  const events = [
    buffEvent({ duration: undefined }),
    buffEvent({
      source: 'Player',
      stacks: 6,
      resolvedAudience: {
        includesSelf: false,
        includesSummons: true,
        alliedPlayerCount: 0,
        companionIds: ['pet-b'],
        recipientCount: 1
      }
    })
  ];
  const timeline = createGw2TimelineIndex({ events });
  assert.equal(timeline.buffStacksAt('might', 1, 0, 25), 0);
  assert.equal(timeline.buffStacksAt('might', 1, 2, 25), 4);
  assert.equal(timeline.buffStacksAt('might', 1, 2, 2), 2);
  assert.equal(timeline.buffStacksAt('might', 1, 2, 25, 'summon'), 10);
  assert.equal(timeline.buffStacksAt('might', 1, 2, 25, 'summon', 'pet-a'), 4);
  assert.equal(timeline.buffStacksAt('might', 1, 2, 25, 'summon', 'pet-b'), 6);
  assert.equal(timeline.buffStacksAt('might', 1, 2, 25, 'summon', null), 0);
  assert.equal(timeline.buffStacksAt('might', 1, 2, 25, 'summon-trait'), 4);
  assert.equal(timeline.buffStacksAt('fury', 1, 2, 25), 0);
  assert.equal(createGw2TimelineIndex().buffStacksAt('might', 1, 2, 25), 0);
});

test('appended and replaced boon extensions invalidate intensity and duration queries', () => {
  const events = [buffEvent(), buffEvent({ kind: 'fury', stacks: 1 })];
  const timeline = createGw2TimelineIndex({ events });
  assert.equal(timeline.timedStacks('might', 2.5, 0, 25), 0);
  assert.equal(timeline.timedActive('fury', 2.5), false);
  const extension = { type: 'boon_extension', at: 1, duration: 2, source: 'Trait' };
  events.push(extension);
  assert.equal(timeline.timedStacks('might', 2.5, 0, 25), 4);
  assert.equal(timeline.timedActive('fury', 2.5), true);
  events[2] = { ...extension, duration: 0.25 };
  timeline.onEventReplaced(extension, events[2]);
  assert.equal(timeline.timedStacks('might', 2.5, 0, 25), 0);
  assert.equal(timeline.timedActive('fury', 2.5), false);
  assert.equal(timeline.timedStacks('might', 0.5, 0, 25), 4);
  assert.equal(timeline.timedActive('fury', 0.5), true);
});

test('buff history bounds preserve mixed lifetimes, fallback durations, and backward queries', () => {
  // A later short grant must not hide an older long grant, and a late insertion can widen the lifetime bound.
  const events = [
    buffEvent({ at: 0, duration: 1, stacks: 1 }),
    buffEvent({ at: 1, duration: 10, stacks: 2 }),
    buffEvent({ at: 2, duration: 0, stacks: 8 }),
    buffEvent({ at: 3, duration: undefined, stacks: 4 }),
    buffEvent({ at: 8, duration: 1, stacks: 16 }),
    buffEvent({ at: 20, duration: 1, stacks: 32 })
  ];
  const timeline = createGw2TimelineIndex({ events });
  assert.equal(timeline.timedStacks('might', 9, 2, 100), 2);
  assert.equal(timeline.timedStacks('might', 11, 2, 100), 0);
  assert.equal(timeline.timedStacks('might', 4, 2, 100), 6);
  assert.equal(timeline.timedStacks('might', 4, 0, 100), 2);
  assert.equal(timeline.timedStacks('might', 12, 10, 100), 4);
  events.push(buffEvent({ at: 0.5, duration: 30, stacks: 64 }));
  assert.equal(timeline.timedStacks('might', 12, 2, 100), 64);
  assert.equal(timeline.timedStacks('might', 0.25, 2, 100), 1);
});

test('buff history bounds retain grants until their quantized expiry', () => {
  // A nominal duration ending between action ticks remains active until the existing expiry rule rounds it up.
  const timeline = createGw2TimelineIndex({
    events: [buffEvent({ kind: 'compounding', at: 0.005, duration: 1, stacks: 1 })]
  });
  assert.equal(timeline.timedStacks('compounding', 1.005, 0, 5), 1);
  assert.equal(timeline.timedStacks('compounding', 1.04, 0, 5), 0);
});

test('cooldown histories preserve prediction visibility and resolved execution order at timestamp ties', () => {
  // Resolver execution order can differ from causal order; prediction excludes same-time actions but includes snapshots.
  const events = [
    { type: 'action', at: 0, skillId: 1, rechargeReadyAt: 10 },
    { type: 'action', at: 1, causalOrder: 2, skillId: 1, rechargeReadyAt: 8 },
    { type: 'cooldown_snapshot', at: 1, causalOrder: 9, cooldowns: {} },
    { type: 'action', at: 1, causalOrder: 1, skillId: 1, rechargeReadyAt: Infinity }
  ];
  const predicted = createGw2TimelineIndex({ events });
  const resolved = createGw2TimelineIndex({ events, resolved: true });
  assert.equal(predicted.skillOnCooldownAt(1, 1), false);
  assert.equal(predicted.skillOnCooldownAt(1, 2), false);
  assert.equal(resolved.skillOnCooldownAt(1, 1), true);
  assert.equal(resolved.skillOnCooldownAt(1, 20), true);
  assert.equal(resolved.skillOnCooldownAt(2, 2), false);
  events.push({ type: 'marker', at: 2, action: 'cooldown-reset' });
  assert.equal(resolved.skillOnCooldownAt(1, 2), false);
  assert.equal(resolved.skillOnCooldownAt(1, 0.5), true);
});

test('queried cooldown histories accept late actions and snapshots for previously unseen skills', () => {
  // Lazily selected skill histories must receive later updates, including chronologically earlier insertions.
  const events = [{ type: 'action', at: 0, skillId: 1, rechargeReadyAt: 10 }];
  const timeline = createGw2TimelineIndex({ events });
  assert.equal(timeline.skillOnCooldownAt(1, 3), true);
  assert.equal(timeline.skillOnCooldownAt(2, 3), false);
  events.push({ type: 'action', at: 2, skillId: 2, rechargeReadyAt: 5 });
  assert.equal(timeline.skillOnCooldownAt(2, 3), true);
  events.push({ type: 'cooldown_snapshot', at: 1, cooldowns: { 3: 6 } });
  assert.equal(timeline.skillOnCooldownAt(1, 3), false);
  assert.equal(timeline.skillOnCooldownAt(2, 3), true);
  assert.equal(timeline.skillOnCooldownAt(3, 3), true);
  assert.equal(timeline.skillOnCooldownAt(2, 1.5), false);
  assert.equal(timeline.skillOnCooldownAt(1, 0.5), true);
});
