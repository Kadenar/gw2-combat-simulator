import assert from 'node:assert/strict';
import test from 'node:test';
import { buildScheduledEventStream } from '#gw2/platform/engine/events/scheduled-stream.js';
import { canonicalTargetConditionName } from '#gw2/platform/combat/state/targets.js';
import { targetHealthBreakpointSnapshots } from '#gw2/app/results/result-transform.js';
import { refineNecromancerSchedulerConfig } from '#gw2/professions/necromancer/core/mechanics/scheduler-feedback.js';
import { NECROMANCER_SKILL_IDS } from '#gw2/professions/necromancer/data/ids.js';
import { resolveTestGw2Stream } from '../../helpers/gw2-resolver.js';

// Synthetic applications expose timer, packet, and ownership contracts without depending on saved rotations.
function condition(at = 0, extra = {}) {
  return {
    type: 'condition',
    at,
    actorType: 'player',
    source: 'Player',
    sourceId: 'bleed',
    name: 'Bleed',
    condition: 'Bleeding',
    duration: 1,
    stacks: 1,
    ...extra
  };
}

function resolve(
  events,
  { end = 2, combatStartTime, output = 'detailed', target = {}, query = {}, reactions = {} } = {}
) {
  return resolveTestGw2Stream({
    output,
    stream: buildScheduledEventStream({
      events,
      rotationEndTime: end,
      resolverHandoff: combatStartTime == null ? {} : { hasExplicitCombatStart: true, combatStartTime }
    }),
    config: { target, sigilSets: [{ names: [] }] },
    traits: new Set(),
    professionReactions: reactions,
    query: {
      statsAt: () => ({ conditionDamage: 125 }),
      conditionDurationMultiplier: () => 1,
      conditionMultiplier: () => 1,
      vulnerabilityStacksAt: () => 0,
      critical: () => ({ chance: 0, damage: 1.5 }),
      strikeMultiplier: () => 1,
      ...query
    },
    helpers: { conditionName: canonicalTargetConditionName, skillsByName: new Map() }
  });
}

function applications(result) {
  return result.resolvedEvents.filter(({ type }) => type === 'condition');
}

function packetDamage(result, name = 'Bleeding') {
  const packets = new Map();
  for (const application of applications(result).filter(({ condition }) => condition === name)) {
    for (const { at, damage } of application.damageTicks) packets.set(at, (packets.get(at) || 0) + damage);
  }

  return [...packets];
}

test('same-owner skills and player effects round once with stable integer attribution in both output modes', () => {
  for (const output of ['detailed', 'score']) {
    assert.equal(resolve([condition()], { output }).conditionDamage, 30);
    const result = resolve(
      [condition(), condition(0, { sourceId: 'other-skill', name: 'Other', condition: 'bleed' })],
      { output }
    );
    assert.equal(result.conditionDamage, 59);
    if (output === 'detailed') {
      assert.deepEqual(
        applications(result).map(({ damage }) => damage),
        [30, 29]
      );
      assert.equal(
        result.breakdown.reduce((sum, row) => sum + row.conditionDamage, 0),
        59
      );
      assert.equal(result.conditionBreakdown[0].damage, 59);
      assert.deepEqual(packetDamage(result), [[1, 59]]);
    }

    assert.equal(
      resolve([condition(), condition(0, { actorType: 'effect', ownerActorType: 'player' })], { output })
        .conditionDamage,
      59
    );
    const tiny = resolve(
      Array.from({ length: 10 }, () => condition(0, { stacks: 0.01 })),
      { output }
    );
    assert.equal(tiny.conditionDamage, 3);
    if (output === 'detailed')
      assert.deepEqual(
        applications(tiny).map(({ damage }) => damage),
        [1, 1, 1, 0, 0, 0, 0, 0, 0, 0]
      );
  }
});

test('distinct owners and unclassified actors share cadence without sharing rounding', () => {
  const player = condition(0.1, { duration: 2 });
  for (const actor of [
    { actorType: 'summon', summonOwner: 'pet:1', ownerActorType: 'player' },
    { actorType: 'summon' },
    { actorType: 'unknown', ownerActorType: 'player' }
  ]) {
    const result = resolve([player, condition(0.1, actor)], { end: 1.1 });
    assert.equal(result.conditionDamage, 60);
  }

  const result = resolve(
    [
      player,
      condition(0.7, { actorType: 'summon', summonOwner: 'pet:1' }),
      condition(0.7, { actorType: 'summon', summonOwner: 'pet:2' })
    ],
    { end: 2.1 }
  );
  assert.deepEqual(
    applications(result)
      .slice(1)
      .map(({ damageTicks }) => damageTicks.map(({ at }) => at)),
    [
      [1.1, 2.1],
      [1.1, 2.1]
    ]
  );
  const samePet = resolve([
    condition(0, { actorType: 'summon', summonOwner: 'pet:1' }),
    condition(0, { actorType: 'summon', summonOwner: 'pet:1' })
  ]);
  assert.equal(samePet.conditionDamage, 59);
});

test('Vital Shot and Spider Venom share a target clock, settle expiry on the next pulse, and restart after draining', () => {
  const result = resolve(
    [
      condition(0.1, { duration: 6 }),
      condition(2.7, { duration: 6 }),
      condition(2.7, { condition: 'Poisoned', duration: 3 }),
      condition(11.6, { duration: 6 }),
      condition(11.6, { condition: 'Poisoned', duration: 3 })
    ],
    { end: 12.6 }
  );
  assert.deepEqual(packetDamage(result), [
    [1.1, 30],
    [2.1, 30],
    [3.1, 41],
    [4.1, 59],
    [5.1, 59],
    [6.1, 59],
    [7.1, 30],
    [8.1, 30],
    [9.1, 18],
    [12.6, 30]
  ]);
  assert.deepEqual(
    applications(result)[2].damageTicks.map(({ at, fraction }) => [at, fraction]),
    [
      [3.1, 0.4],
      [4.1, 1],
      [5.1, 1],
      [6.1, 0.6]
    ]
  );
  for (const application of applications(result).slice(0, 3)) {
    assert.equal(application.damagingStackSeconds, application.effectiveDuration);
  }
});

test('short lifetimes settle once on the shared pulse without rounding both split intervals upward', () => {
  const result = resolve([
    condition(0, { duration: 2 }),
    condition(0.73, { duration: 0.5 }),
    condition(0.8, { duration: 0.04 })
  ]);
  const [, split, short] = applications(result);
  assert.deepEqual(
    split.damageTicks.map(({ at, fraction }) => [at, fraction]),
    [
      [1, 0.27],
      [2, 0.25]
    ]
  );
  assert.equal(split.damagingStackSeconds, 0.52);
  assert.deepEqual(
    short.damageTicks.map(({ at, fraction }) => [at, fraction]),
    [[1, 0.04]]
  );
  assert.equal(resolve([condition(0, { duration: 0.52 })], { end: 0.8 }).conditionDamage, 0);
  assert.equal(resolve([condition(0, { duration: 0.52 })], { end: 1 }).conditionDamage, 15);
});

test('permanent conditions including non-damaging statuses anchor the timer and keep environment totals separate', () => {
  for (const conditions of [{ Vulnerability: 1 }, { Bleeding: 1 }]) {
    const result = resolve([condition(0.6), condition(3.6)], { end: 5, target: { conditions } });
    assert.deepEqual(
      applications(result).map(({ damageTicks }) => damageTicks.map(({ at }) => at)),
      [
        [1, 2],
        [4, 5]
      ]
    );
    assert.equal(result.conditionDamage, 60);
    assert.equal(result.environmentDamage, conditions.Bleeding ? 110 : 0);
  }
});

test('current stats and source modifiers sample one pre-packet health state and reactions see the whole commit', () => {
  const observed = [];
  const result = resolve([condition(0, { duration: 2 }), condition(0, { duration: 2, sourceId: 'boosted' })], {
    query: {
      statsAt: (at) => ({ conditionDamage: at === 1 ? 125 : 0 }),
      conditionMultiplier: (_name, _at, application, ctx) =>
        (application.sourceId === 'boosted' ? 2 : 1) * (ctx.totals.condition < 50 ? 1 : 2)
    },
    reactions: {
      'condition-tick.resolved': (ctx, event, { resolved }) => {
        observed.push([event.at, resolved.damage, ctx.totals.condition]);
        assert.equal(
          resolved.contributions.reduce((sum, contribution) => sum + contribution.damage, 0),
          resolved.damage
        );
      }
    }
  });
  assert.deepEqual(observed, [
    [1, 88, 88],
    [2, 132, 220]
  ]);
  assert.equal(result.conditionDamage, 220);
});

test('precombat wakes advance settlement without damage, reactions, or catch-up packets', () => {
  for (const combatStartTime of [2, 2.2]) {
    const observed = [];
    const result = resolve([condition(0, { duration: 4 })], {
      end: 4,
      combatStartTime,
      reactions: { 'condition-tick.resolved': (_ctx, event) => observed.push(event.at) }
    });
    assert.deepEqual(observed, combatStartTime === 2 ? [2, 3, 4] : [3, 4]);
    assert.equal(result.conditionDamage, observed.length * 30);
    assert.equal(applications(result)[0].damagingStackSeconds, observed.length);
  }
});

test('causally tagged state changes precede shared pulses and boundary applications owe no preceding interval', () => {
  const result = resolve(
    [
      condition(0, { duration: 2, eventOrder: 0 }),
      {
        type: 'buff',
        at: 1,
        source: 'Player',
        sourceId: 'boost',
        actorType: 'player',
        kind: 'might',
        duration: 3,
        stacks: 1,
        eventOrder: 1
      },
      condition(1, { eventOrder: 2 })
    ],
    {
      query: { conditionMultiplier: (_name, _at, _application, ctx) => (ctx.boons.has('might') ? 2 : 1) }
    }
  );
  assert.deepEqual(packetDamage(result), [
    [1, 59],
    [2, 118]
  ]);
  assert.deepEqual(
    applications(result)[1].damageTicks.map(({ at }) => at),
    [2]
  );
});

test('explicit priorities and untagged insertion ties retain their existing ordering', () => {
  for (const priority of [-1, 0, 1]) {
    const order = [];
    resolve(
      [
        condition(0),
        {
          type: 'buff',
          at: 1,
          source: 'Player',
          sourceId: 'state',
          actorType: 'player',
          kind: 'might',
          duration: 1,
          stacks: 1,
          priority
        }
      ],
      {
        reactions: { 'buff.applied': () => order.push('buff'), 'condition-tick.resolved': () => order.push('tick') }
      }
    );
    assert.deepEqual(order, priority <= 0 ? ['buff', 'tick'] : ['tick', 'buff']);
  }
});

test('lethal packets finish atomically with simultaneous owner packets but reject a later independent attack', () => {
  for (const output of ['detailed', 'score']) {
    const result = resolve(
      [
        condition(),
        condition(),
        condition(0, { actorType: 'summon', summonOwner: 'pet' }),
        {
          type: 'damage',
          at: 1,
          source: 'Player',
          sourceId: 'later',
          actorType: 'player',
          flatDamage: 100,
          priority: 10
        }
      ],
      { output, target: { health: 40 } }
    );
    assert.equal(result.deathTime, 1);
    assert.equal(result.conditionDamage, 89);
    assert.equal(result.strikeDamage, 0);
  }
});

test('forced cancellation discards unsettled damage and stale wakes cannot trigger reactions', () => {
  for (const output of ['detailed', 'score']) {
    let original;
    const ticks = [];
    const result = resolve(
      [
        condition(0, { duration: 5 }),
        {
          type: 'buff',
          at: 0.4,
          source: 'Player',
          sourceId: 'remove',
          actorType: 'player',
          kind: 'might',
          duration: 1,
          stacks: 1
        },
        condition(0.5)
      ],
      {
        output,
        reactions: {
          'condition.applied': (_ctx, event) => {
            if (event.at === 0) original = event;
          },
          'buff.applied': () => {
            original.removedAt = 0.4;
          },
          'condition-tick.resolved': (_ctx, event) => ticks.push(event.at)
        }
      }
    );
    assert.equal(original.damage, 0);
    assert.equal(result.conditionDamage, 30);
    assert.deepEqual(ticks, [1.5]);
  }
});

// Non-damaging statuses establish the same clock, and configured statuses exist before explicit Combat Start.
test('non-damaging timed and permanent conditions synchronize later damage across combat start', () => {
  const timed = resolve([condition(0.1, { condition: 'Vulnerability', duration: 2 }), condition(0.7)], { end: 2.1 });
  assert.deepEqual(
    applications(timed)[1].damageTicks.map(({ at }) => at),
    [1.1, 2.1]
  );
  const permanent = resolve([condition(0.2, { duration: 4 })], {
    end: 4,
    combatStartTime: 2.2,
    target: { conditions: { Bleeding: 1 } }
  });
  assert.deepEqual(
    applications(permanent)[0].damageTicks.map(({ at, fraction }) => [at, fraction]),
    [
      [3, 1],
      [4, 1]
    ]
  );
  assert.deepEqual(
    permanent.environmentConditionBreakdown[0].damageTicks.map(({ at }) => at),
    [3, 4]
  );
  assert.equal(permanent.conditionDamage, 60);
});

test('health milestones and Necromancer feedback consume the committed shared-packet timeline', () => {
  const result = resolve(
    [
      condition(0, { duration: 2 }),
      condition(0, { duration: 2 }),
      {
        type: 'action',
        at: 0,
        actorType: 'player',
        source: 'Player',
        sourceId: NECROMANCER_SKILL_IDS.GRAVEDIGGER,
        skillId: NECROMANCER_SKILL_IDS.GRAVEDIGGER,
        name: 'Gravedigger'
      }
    ],
    { target: { health: 200, conditions: { Bleeding: 1 } } }
  );
  const [milestone] = targetHealthBreakpointSnapshots(result, 200, [50]);
  assert.equal(milestone.at, 2);
  assert.equal(milestone.damage, 118);
  assert.equal(milestone.targetDamage, 162);
  const config = refineNecromancerSchedulerConfig({ target: { health: 200 } }, result);
  assert.equal(config._schedulerFeedback.targetBelowHalfAt, milestone.at);
});
