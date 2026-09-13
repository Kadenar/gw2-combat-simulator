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
  const player = condition(0, { duration: 2 });
  for (const actor of [
    { actorType: 'summon', independentConditionOwner: true, summonOwner: 'pet:1', ownerActorType: 'player' },
    { actorType: 'summon', independentConditionOwner: true },
    { actorType: 'summon', independentConditionOwner: true, summonOwner: 'engineer.mech' },
    { actorType: 'unknown', ownerActorType: 'player' }
  ]) {
    const result = resolve([player, condition(0, actor)], { end: 1.1 });
    assert.equal(result.conditionDamage, 60);
  }

  const result = resolve(
    [
      player,
      condition(0.7, { actorType: 'summon', independentConditionOwner: true, summonOwner: 'pet:1' }),
      condition(0.7, { actorType: 'summon', independentConditionOwner: true, summonOwner: 'pet:2' })
    ],
    { end: 2.1 }
  );
  assert.deepEqual(
    applications(result)
      .slice(1)
      .map(({ damageTicks }) => damageTicks.map(({ at }) => at)),
    [
      [1, 2],
      [1, 2]
    ]
  );
  const samePet = resolve([
    condition(0, { actorType: 'summon', independentConditionOwner: true, summonOwner: 'pet:1' }),
    condition(0, { actorType: 'summon', independentConditionOwner: true, summonOwner: 'pet:1' })
  ]);
  assert.equal(samePet.conditionDamage, 59);
});

test('different conditions share whole-second pulses and empty gaps never change the clock phase', () => {
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
    [1, 27],
    [2, 30],
    [3, 39],
    [4, 59],
    [5, 59],
    [6, 59],
    [7, 32],
    [8, 30],
    [9, 20],
    [12, 12]
  ]);
  assert.deepEqual(
    applications(result)[2].damageTicks.map(({ at, fraction }) => [at, fraction]),
    [
      [3, 0.32],
      [4, 1],
      [5, 1],
      [6, 0.68]
    ]
  );
  for (const application of applications(result).slice(0, 3)) {
    assert.ok(Math.abs(application.damagingStackSeconds - application.effectiveDuration) < 1e-9);
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
      [1, 0.28],
      [2, 0.24]
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

test('permanent conditions share whole-second pulses and keep environment totals separate', () => {
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

test('buffered source modifiers preserve atomic packet commits and reaction totals', () => {
  const observed = [];
  const result = resolve([condition(0, { duration: 2 }), condition(0, { duration: 2, sourceId: 'boosted' })], {
    query: {
      statsAt: (at) => ({ conditionDamage: at <= 1 ? 125 : 0 }),
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
  // Only the final 40ms sample at 1s sees the newly applied multiplier.
  assert.deepEqual(packetDamage(result), [
    [1, 31],
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
        condition(0, { actorType: 'summon', independentConditionOwner: true, summonOwner: 'pet' }),
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
    // Replacement buffers 0.52s and 0.48s, yielding separately rounded packets of 15 and 14.
    assert.equal(result.conditionDamage, 29);
    assert.deepEqual(ticks, [1, 2]);
  }
});

// Non-damaging statuses leave the global phase unchanged, including before explicit Combat Start.
test('non-damaging timed and permanent conditions synchronize later damage across combat start', () => {
  const timed = resolve([condition(0.1, { condition: 'Vulnerability', duration: 2 }), condition(0.7)], { end: 2.1 });
  assert.deepEqual(
    applications(timed)[1].damageTicks.map(({ at }) => at),
    [1, 2]
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

// The first application joins the zero-anchored clock, including after a completely empty target window.
test('a two-second burn at 960ms buffers 40ms, 1000ms, and 960ms for whole-second payouts', () => {
  for (const output of ['detailed', 'score']) {
    const result = resolve([condition(0.96, { condition: 'Burning', duration: 2 })], {
      output,
      end: 3,
      query: { statsAt: () => ({ conditionDamage: 0 }), conditionMultiplier: () => 100 / 131 }
    });
    assert.equal(result.conditionDamage, 200);
    if (output === 'detailed') {
      const [burn] = applications(result);
      assert.equal(burn.naturalExpiresAt, 2.96);
      assert.deepEqual(burn.damageTicks, [
        { at: 1, fraction: 0.04, damage: 4 },
        { at: 2, fraction: 1, damage: 100 },
        { at: 3, fraction: 0.96, damage: 96 }
      ]);
    }
  }
});

test('summons share player rounding while retaining source-specific damage queries', () => {
  for (const summonKind of ['clone', 'phantasm', 'minion', 'spirit', 'elemental', 'thieves-guild', undefined]) {
    for (const output of ['detailed', 'score']) {
      const result = resolve(
        [
          condition(),
          condition(0, { actorType: 'summon', summonKind, ...(summonKind ? { summonOwner: `${summonKind}:1` } : {}) })
        ],
        { output }
      );
      assert.equal(result.conditionDamage, 59);
      if (output === 'detailed')
        assert.deepEqual(
          applications(result).map(({ damage }) => damage),
          [30, 29]
        );
    }
  }

  const sources = [];
  resolve([condition(), condition(0, { actorType: 'summon', summonKind: 'clone', summonOwner: 'illusion:1' })], {
    query: {
      conditionMultiplier: (_name, at, application) => {
        sources.push([at, application.actorType]);
        return 1;
      }
    }
  });
  assert.deepEqual(
    sources,
    Array.from({ length: 25 }, (_, index) => [
      [(index + 1) / 25, 'player'],
      [(index + 1) / 25, 'summon']
    ]).flat()
  );
});

// Mutable state changes distinguish chronological sampling from replaying old timestamps at payout.
test('40ms buffers retain sampled stats and modifiers after expiry until the whole-second payout', () => {
  for (const output of ['detailed', 'score']) {
    let conditionDamage = 0;
    let multiplier = 1;
    const samples = [];
    const payouts = [];
    const result = resolve(
      [
        condition(0, { condition: 'Burning', duration: 0.52, eventOrder: 0 }),
        ...[0.2, 0.36, 0.8].map((at, index) => ({
          type: 'buff',
          at,
          source: 'Player',
          sourceId: `change-${index}`,
          actorType: 'player',
          kind: 'might',
          stacks: 1,
          duration: 1,
          eventOrder: index + 1
        }))
      ],
      {
        output,
        end: 1,
        query: {
          statsAt: () => ({ conditionDamage }),
          conditionMultiplier: (_condition, at, _application, ctx) => {
            samples.push([at, ctx.totals.condition]);
            return multiplier;
          }
        },
        reactions: {
          'buff.applied': (_ctx, event) => {
            if (event.at === 0.2) conditionDamage = 1000;
            else if (event.at === 0.36) multiplier = 2;
            else {
              conditionDamage = 9999;
              multiplier = 99;
            }
          },
          'condition-tick.resolved': (_ctx, event) => payouts.push(event.at)
        }
      }
    );
    // Four samples at 131/s, four at 286/s, five at 572/s: 181.12, rounded only once.
    assert.equal(result.conditionDamage, 181);
    assert.deepEqual(
      samples,
      Array.from({ length: 13 }, (_, index) => [(index + 1) / 25, 0])
    );
    assert.deepEqual(payouts, [1]);
    if (output === 'detailed')
      assert.deepEqual(applications(result)[0].damageTicks, [{ at: 1, damage: 181, fraction: 0.52 }]);
  }
});

test('all owners sample a whole-second boundary before any condition packet changes target health', () => {
  const sampledTotals = [];
  const payouts = [];
  resolve(
    [
      condition(0, { duration: 2 }),
      condition(0, { duration: 2, actorType: 'summon', independentConditionOwner: true, summonOwner: 'pet' })
    ],
    {
      query: {
        conditionMultiplier: (_condition, at, _application, ctx) => {
          if (at === 1) sampledTotals.push(ctx.totals.condition);
          return ctx.totals.condition === 0 ? 1 : 2;
        }
      },
      reactions: { 'condition-tick.resolved': (_ctx, event, { resolved }) => payouts.push([event.at, resolved.damage]) }
    }
  );
  assert.deepEqual(sampledTotals, [0, 0]);
  assert.deepEqual(payouts, [
    [1, 30],
    [1, 30],
    [2, 59],
    [2, 59]
  ]);
});

test('environment conditions buffer target modifiers at 40ms steps without player attribution', () => {
  let vulnerability = 0;
  const result = resolve(
    [0.2, 0.52].map((at, index) => ({
      type: 'buff',
      at,
      source: 'Player',
      sourceId: 'vulnerability-change',
      actorType: 'player',
      kind: 'might',
      stacks: 1,
      duration: 1,
      eventOrder: index
    })),
    {
      end: 1,
      target: { conditions: { Bleeding: 1 } },
      query: { vulnerabilityStacksAt: () => vulnerability },
      reactions: {
        'buff.applied': (_ctx, event) => {
          vulnerability = event.at === 0.2 ? 25 : 0;
        }
      }
    }
  );
  // Eight of 25 samples receive Vulnerability: 22 * (1 + 0.32 * 0.25) rounds to 24.
  assert.equal(result.environmentDamage, 24);
  assert.equal(result.conditionDamage, 0);
  assert.deepEqual(result.environmentConditionBreakdown[0].damageTicks, [{ at: 1, damage: 24 }]);
});
