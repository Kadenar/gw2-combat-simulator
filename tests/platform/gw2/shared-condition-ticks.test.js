import assert from 'node:assert/strict';
import test from 'node:test';
import { buildScheduledEventStream } from '#gw2/platform/engine/events/scheduled-stream.js';
import { canonicalTargetConditionName } from '#gw2/platform/combat/state/targets.js';
import { createGw2CombatQuery } from '#gw2/platform/combat/query/combat-query.js';
import { targetConditionActive, targetConditionCount } from '#gw2/platform/combat/query/runtime-query.js';
import { defineProfession } from '#gw2/platform/engine/profession/contract.js';
import { targetHealthBreakpointSnapshots } from '#gw2/app/results/result-transform.js';
import { refineNecromancerSchedulerConfig } from '#gw2/professions/necromancer/core/mechanics/scheduler-feedback.js';
import { NECROMANCER_SKILL_IDS } from '#gw2/professions/necromancer/data/ids.js';
import { resolveTestGw2Stream } from '../../helpers/gw2-resolver.js';
import { remainingTargetHealthFraction } from '#gw2/platform/combat/state/target-health.js';
import { GW2_RESOLVER_PHASE } from '#gw2/platform/resolver/event-loop.js';

// Resolver queries must follow executed state changes, including cache invalidation within one timestamp.
test('samples and strikes see cooldown resets, snapshots, and swaps only after execution', () => {
  for (const output of ['detailed', 'score']) {
    for (const reset of [
      { type: 'marker', action: 'cooldown-reset' },
      { type: 'cooldown_snapshot', cooldowns: {} }
    ]) {
      const seen = [];
      const profession = defineProfession({
        id: 'timeline-resolution',
        name: 'Timeline resolution',
        attributeRules: {
          modifyAttributes(context, attributes) {
            const cooldown = context.timeline.skillOnCooldownAt(1, context.time);
            const weaponSet = context.timeline.activeWeaponSetAt(context.time);
            if ([1, 2].includes(context.time)) {
              seen.push([context.time, context.event.type, cooldown, weaponSet]);
            }

            return { ...attributes, conditionDamage: cooldown ? 0 : 180 };
          }
        }
      });
      const owner = { source: 'Player', sourceId: 'probe', actorType: 'player' };
      resolveTestGw2Stream({
        output,
        profession,
        config: { sigilSets: [{ names: [] }] },
        stream: buildScheduledEventStream({
          events: [
            { ...owner, type: 'action', at: 0, skillId: 1, rechargeReadyAt: 10 },
            { ...owner, type: 'damage', at: 0, flatDamage: 1 },
            condition(0, { duration: 2 }),
            { ...owner, type: 'damage', at: 1, flatDamage: 1, priority: -10 },
            { ...owner, ...reset, at: 1 },
            { ...owner, type: 'weapon_set', at: 1, weaponSet: 2 },
            { ...owner, type: 'damage', at: 1, flatDamage: 1, priority: 10 }
          ],
          rotationEndTime: 2
        })
      });
      assert.deepEqual(seen, [
        [1, 'condition', true, 1],
        [1, 'damage', true, 1],
        [1, 'damage', false, 2],
        [2, 'condition', false, 2]
      ]);
    }
  }
});

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
      statsAt: () => ({ power: 1000, conditionDamage: 125 }),
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

// Off-grid applications preserve exact expiry while pulses stay on encounter seconds.
test('condition pulses retain encounter seconds and an exact off-grid expiry', () => {
  const origin = 0.375001;
  const samples = [];
  const result = resolve(
    [
      { type: 'damage', at: origin, source: 'Player', sourceId: 'opener', actorType: 'player', flatDamage: 1 },
      condition(origin, { duration: 40 })
    ],
    {
      end: origin + 40,
      query: {
        conditionMultiplier: (_name, at) => {
          samples.push(at);
          return 1;
        }
      }
    }
  );
  assert.deepEqual(samples, [...Array.from({ length: 40 }, (_, index) => index + 1), 40.375001]);
  assert.equal(result.lastHitTime, 40);
});

// Trait-emitted Fear uses its damage formula; ordinary fear controls and ambient Fear remain harmless.
test('explicit Fear condition applications deal damage in detailed and score output', () => {
  for (const output of ['detailed', 'score']) {
    const control = {
      type: 'control',
      at: 0,
      controlKind: 'fear',
      duration: 1,
      source: 'Player',
      sourceId: 'fear-control',
      actorType: 'player'
    };
    const options = { output, target: { conditions: { Fear: true } } };
    assert.equal(resolve([control], options).conditionDamage, 0);
    const result = resolve([control, condition(0, { condition: 'Fear', sourceId: 'terror' })], options);
    assert.equal(result.conditionDamage, 444 + 0.4 * 125);
  }
});

// Zero-damage applications retain duration snapshots and live target effects, but never rebuild damage attributes.
test('non-damaging conditions preserve other skills modifiers, expiry, and reporting without damage sampling', () => {
  const statuses = ['Vulnerability', 'Chilled', 'Weakness', 'Crippled'];
  for (const output of ['detailed', 'score']) {
    const durationQueries = [];
    const strikes = [];
    const bleeding = new Map();
    const applied = [];
    const profession = defineProfession({
      id: 'condition-state-probe',
      name: 'Condition state probe',
      attributeRules: {
        modifyStrikeDamage: (context, base) =>
          base * (1 + targetConditionCount(context)) * (targetConditionActive(context, 'Chilled') ? 2 : 1),
        modifyConditionDamage: (context, base) =>
          base *
          (targetConditionActive(context, 'Weakness') ? 2 : 1) *
          (targetConditionActive(context, 'Crippled') ? 2 : 1)
      }
    });
    const combat = createGw2CombatQuery({
      profession,
      config: { target: { conditions: {} }, stats: { power: 1000, conditionDamage: 0, expertise: 1500 } }
    });
    const result = resolve(
      [
        { type: 'damage', at: 0, source: 'Player', sourceId: 'opener', actorType: 'player', flatDamage: 1 },
        condition(0, { duration: 1, fixedDuration: true }),
        ...statuses.map((name) =>
          condition(0.04, { sourceId: name, condition: name, duration: 0.12, stacks: name === 'Vulnerability' ? 5 : 1 })
        ),
        ...[0.02, 0.12, 0.28].map((at) => ({
          type: 'damage',
          at,
          source: 'Player',
          sourceId: 'probe',
          actorType: 'player',
          coefficient: 1,
          weaponStrength: 1000,
          noCrit: true
        }))
      ],
      {
        output,
        query: {
          ...combat,
          statsAt: (at, event, runtime) => {
            if (statuses.includes(event?.condition)) {
              assert.equal(at, event.at, 'Non-damaging conditions only need application-time duration attributes');
              durationQueries.push(event.condition);
            }

            return combat.statsAt(at, event, runtime);
          },
          strikeMultiplier: (event, at, runtime) => {
            const multiplier = combat.strikeMultiplier(event, at, runtime);
            strikes.push(multiplier);
            return multiplier;
          },
          conditionMultiplier: (name, at, event, runtime, sample) => {
            assert.equal(name, 'Bleeding', 'Only damaging conditions may calculate a damage multiplier');
            const multiplier = combat.conditionMultiplier(name, at, event, runtime, sample);
            bleeding.set(Math.round(at * 1000), multiplier);
            return multiplier;
          }
        },
        reactions: { 'condition.applied': (_runtime, event) => applied.push(event.condition) }
      }
    );
    assert.deepEqual(durationQueries, statuses);
    assert.deepEqual(applied, ['Bleeding', ...statuses]);
    assert.deepEqual(strikes, [2, 1.05 * 6 * 2, 2]);
    // Transient conditions affect intervening strikes, but have expired before Bleeding samples at 1s.
    assert.deepEqual([...bleeding], [[1000, 1]]);
    assert.ok(result.conditionDamage > 0);
    if (output === 'detailed') {
      for (const name of statuses) {
        const application = applications(result).find((event) => event.condition === name);
        assert.equal(application.effectiveDuration, 0.24);
        assert.equal(application.damage, 0);
        assert.equal(result.conditionBreakdown.find((entry) => entry.name === name).averageStacks > 0, true);
      }

      const probeHits = result.resolvedEvents.filter((event) => event.sourceId === 'probe');
      assert.equal(probeHits[0].damage, probeHits[2].damage);
      assert.ok(probeHits[1].damage > probeHits[0].damage);
    }
  }
});

// One target query serves all owners/conditions at that instant, but a subsequent pass gets a fresh snapshot.
test('condition buffering shares Vulnerability once per pass and refreshes it on the next pass', () => {
  const reads = new Map();
  const samples = new Map();
  resolve([condition(0, { duration: 1.08 }), condition(0, { duration: 1.08, condition: 'Burning' })], {
    end: 1.12,
    target: { conditions: { Bleeding: 1 } },
    query: {
      vulnerabilityStacksAt: (at) => {
        reads.set(at, (reads.get(at) || 0) + 1);
        return at < 1.08 ? 5 : 10;
      },
      conditionMultiplier: (_name, at, _application, _runtime, sample) => {
        if (samples.has(at)) assert.equal(samples.get(at), sample);
        samples.set(at, sample);
        return 1 + sample.vulnerabilityStacks / 100;
      }
    }
  });
  assert.ok(samples.size >= 2);
  for (const count of reads.values()) assert.equal(count, 1);
  const first = samples.get(1);
  const second = samples.get(1.08);
  assert.equal(first.vulnerabilityStacks, 5);
  assert.equal(second.vulnerabilityStacks, 10);
  assert.notEqual(first.modifierValues, second.modifierValues);
});

// First damage affects the DPS window, while each owner and the environment retain encounter-second pulses.
test('first damage and empty gaps do not shift condition pulses', () => {
  for (const output of ['detailed', 'score']) {
    const payouts = [];
    const samples = [];
    const result = resolve(
      [
        { type: 'damage', at: 0.375, source: 'Player', sourceId: 'opener', actorType: 'player', flatDamage: 1 },
        condition(0.375, { duration: 1.01 }),
        condition(3.375, { duration: 1, actorType: 'summon', independentConditionOwner: true, summonOwner: 'pet' })
      ],
      {
        output,
        end: 5,
        target: { conditions: { Bleeding: 1 } },
        query: {
          conditionMultiplier: (_name, at) => {
            samples.push(at);
            return 1;
          }
        },
        reactions: { 'condition-tick.resolved': (_ctx, event) => payouts.push(event.at) }
      }
    );
    assert.equal(result.firstHitTime, 0.375);
    assert.deepEqual(samples, [1, 1.385, 4, 4.375]);
    assert.deepEqual(payouts, [1, 2, 4, 5]);
    if (output === 'detailed') {
      assert.deepEqual(
        applications(result)[0].damageTicks.map(({ fraction }) => fraction),
        [0.625, 0.385]
      );
      assert.deepEqual(
        result.environmentConditionBreakdown[0].damageTicks.map(({ at }) => at),
        [1, 2, 3, 4, 5]
      );
    }
  }
});

// Misses, zero damage and explicit combat markers do not shift the condition clock.
test('first damage leaves existing condition wakes and precombat gating intact', () => {
  const damage = (at, extra = {}) => ({
    type: 'damage',
    at,
    source: 'Player',
    sourceId: 'opener',
    actorType: 'player',
    flatDamage: 1,
    ...extra
  });
  const result = resolve(
    [
      condition(0, { duration: 3 }),
      condition(0, { condition: 'Torment', duration: 0.04 }),
      damage(0.1),
      damage(0.25, { offTarget: true }),
      damage(0.3, { flatDamage: 0 }),
      damage(0.375),
      damage(0.6)
    ],
    { combatStartTime: 0.2, end: 3.375 }
  );
  assert.equal(result.firstHitTime, 0.375);
  assert.deepEqual(
    applications(result)[0].damageTicks.map(({ at, fraction }) => [at, fraction]),
    [
      [1, 1],
      [2, 1],
      [3, 1]
    ]
  );
  assert.deepEqual(applications(result)[1].damageTicks, []);
});

test('an eligible condition payout establishes first damage before the same-time opening strike', () => {
  const result = resolve([
    condition(0.96),
    { type: 'damage', at: 1, source: 'Player', sourceId: 'opener', actorType: 'player', flatDamage: 1 }
  ]);
  assert.equal(result.firstHitTime, 1);
  assert.deepEqual(applications(result)[0].damageTicks, [
    { at: 1, fraction: 0.04, damage: 1 },
    { at: 2, fraction: 0.96, damage: 28 }
  ]);
});

test('same-owner conditions sum across skills before one half-even rounding in both output modes', () => {
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
    assert.equal(resolve([condition(0, { stacks: 2 })], { output }).conditionDamage, 59);
    if (output === 'detailed')
      assert.deepEqual(
        applications(tiny).map(({ damage }) => damage),
        [1, 1, 1, 0, 0, 0, 0, 0, 0, 0]
      );
  }
});

// Expired applications keep their unrounded tails until all contributions join the shared pulse.
test('different expiry remainders join one half-even rounding at payout', () => {
  for (const output of ['detailed', 'score']) {
    const events = [condition(0, { duration: 0.35 }), condition(0, { duration: 0.4, sourceId: 'other-skill' })];
    const options = { output, query: { conditionMultiplier: () => 1 / 29.5 } };
    assert.equal(resolve(events, { ...options, end: 0.9 }).conditionDamage, 0);
    const result = resolve(events, { ...options, end: 1 });
    // 0.35 + 0.4 rounds to 1; rounding either expired application separately would produce zero.
    assert.equal(result.conditionDamage, 1);
    if (output === 'detailed')
      assert.deepEqual(
        applications(result).map(({ damage }) => damage),
        [0, 1]
      );
  }
});

// Sampling decimal rates must preserve half-even packet totals, attribution, and lethal boundaries in both modes.
test('buffered decimal rates preserve half-even rounding across shared applications', () => {
  for (const output of ['detailed', 'score']) {
    for (const stacks of [[10], [5, 5]]) {
      for (const [conditionDamage, damage, health, deathTime] of [
        [25, 258, 259, null],
        [75, 292, 292, 1]
      ]) {
        const result = resolve(
          stacks.map((count) => condition(0, { stacks: count })),
          {
            output,
            end: 1,
            target: { health, conditions: {} },
            query: {
              statsAt: () => ({ conditionDamage }),
              conditionMultiplier: () => 1.1
            }
          }
        );
        assert.equal(result.conditionDamage, damage);
        assert.equal(result.deathTime, deathTime);
        if (output === 'detailed') {
          assert.equal(
            applications(result).reduce((sum, application) => sum + application.damage, 0),
            damage
          );
          assert.equal(
            result.breakdown.reduce((sum, row) => sum + row.conditionDamage, 0),
            damage
          );
        }
      }
    }
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
    [3, 38],
    [4, 59],
    [5, 59],
    [6, 59],
    [7, 32],
    [8, 30],
    [9, 21],
    [12, 12]
  ]);
  assert.deepEqual(
    applications(result)[2].damageTicks.map(({ at, fraction }) => [at, fraction]),
    [
      [3, 0.3],
      [4, 1],
      [5, 1],
      [6, 0.7]
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
      [1, 0.27],
      [2, 0.23]
    ]
  );
  assert.equal(split.damagingStackSeconds, 0.5);
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

test('ordinary state changes follow shared samples and boundary applications owe no preceding interval', () => {
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
  // The sample ending at 1s uses prior state; the new multiplier affects subsequent intervals.
  assert.deepEqual(packetDamage(result), [
    [1, 30],
    [2, 118]
  ]);
  assert.deepEqual(
    applications(result)[1].damageTicks.map(({ at }) => at),
    [2]
  );
});

test('ordinary priorities cannot outrank condition settlement', () => {
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
    assert.deepEqual(order, ['tick', 'buff']);
  }
});

// Settlement commits health and derived state before every ordinary attack, including condition-kind direct procs.
test('settlement reactions inherit their phase while direct hits and future buffs remain ordinary', () => {
  const observed = [];
  resolve(
    [
      condition(),
      {
        type: 'damage',
        at: 1,
        source: 'Player',
        actorType: 'player',
        sourceId: 'strike',
        flatDamage: 1,
        priority: -999
      }
    ],
    {
      target: { health: 1000 },
      reactions: {
        'condition-tick.resolved': (ctx) => {
          ctx.queue.enqueue({ type: 'buff', at: 1, sourceId: 'settled', kind: 'might', duration: 2, stacks: 1 });
          ctx.queue.enqueue({ type: 'damage', at: 1, sourceId: 'proc', flatDamage: 1, damageKind: 'condition' });
          ctx.queue.enqueue({ type: 'buff', at: 2, sourceId: 'future', kind: 'might', duration: 1, stacks: 1 });
          assert.throws(() => ctx.queue.enqueue({ type: 'condition_buffer', at: 1, sourceId: 'rewind' }), /rewind/);
          assert.throws(() => ctx.applyCondition(condition(0.999999)), /past/);
        },
        'buff.applied': (ctx, event) => observed.push([event.sourceId, ctx.queue.currentPhase]),
        'damage.resolved': (ctx, event) => observed.push([event.sourceId, ctx.queue.currentPhase])
      }
    }
  );
  assert.deepEqual(observed, [
    ['settled', GW2_RESOLVER_PHASE.Settle],
    ['strike', GW2_RESOLVER_PHASE.Ordinary],
    ['proc', GW2_RESOLVER_PHASE.Ordinary],
    ['future', GW2_RESOLVER_PHASE.Ordinary]
  ]);
});

test('same-time strikes query health after payout with strict below-threshold equality', () => {
  for (const startingHealthFraction of [0.529, 0.53]) {
    const health = [];
    const result = resolve(
      [
        condition(),
        {
          type: 'damage',
          at: 1,
          source: 'Player',
          actorType: 'player',
          sourceId: 'threshold',
          flatDamage: 10,
          flatStrikeHealthThreshold: 0.5,
          flatStrikeThresholdMultiplier: 2,
          priority: -999
        }
      ],
      {
        end: 1,
        target: { health: 1000, startingHealthFraction },
        query: {
          statsAt: (_at, event, ctx) => {
            if (event.type === 'damage') health.push(remainingTargetHealthFraction(ctx.config, ctx));
            return { power: 1000, conditionDamage: 125 };
          }
        }
      }
    );
    assert.equal(result.conditionDamage, 30);
    assert.equal(result.strikeDamage, startingHealthFraction < 0.53 ? 20 : 10);
    assert.ok(Math.abs(health[0] - (startingHealthFraction - 0.03)) < 1e-12);
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
          priority: -999
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
    // Replacement samples two half-second intervals, each rounding 14.75 to 15.
    assert.equal(result.conditionDamage, 30);
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

test('summons share player packet rounding while retaining source-specific damage queries', () => {
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
  assert.deepEqual(sources, [
    [1, 'player'],
    [1, 'summon']
  ]);
});

// Mutable state changes distinguish chronological sampling from replaying old timestamps at payout.
test('expiry samples current stats and retains the partial damage until the whole-second payout', () => {
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
    // Expiry at 0.52s samples 572 damage/s for the full 0.52s; changes at 0.8s cannot alter it.
    assert.equal(result.conditionDamage, 297);
    assert.deepEqual(samples, [[0.52, 0]]);
    assert.deepEqual(payouts, [1]);
    if (output === 'detailed')
      assert.deepEqual(applications(result)[0].damageTicks, [{ at: 1, damage: 297, fraction: 0.52 }]);
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

test('environment conditions sample target modifiers at the whole-second pulse', () => {
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
  // Vulnerability ended before the sample at 1s, so the pulse uses the unmodified rate.
  assert.equal(result.environmentDamage, 22);
  assert.equal(result.conditionDamage, 0);
  assert.deepEqual(result.environmentConditionBreakdown[0].damageTicks, [{ at: 1, damage: 22 }]);
});
