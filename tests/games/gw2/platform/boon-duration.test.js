import { observeGw2Runtime } from '#tests/helpers/observed-runtime.js';
import assert from 'node:assert/strict';
import test from 'node:test';
import { gw2BoonDurationMultiplier } from '#gw2/platform/combat/boons.js';
import { gw2StaticAttributes } from '#gw2/platform/combat/stats.js';
import { gw2ResolverBoonDuration } from '#gw2/platform/resolver/boon-duration.js';
import { createCanonicalCatalog } from '#gw2/platform/skills/catalog.js';
import { defineTestProfession } from '#tests/helpers/profession.js';
import { simulateGw2 } from '#gw2/platform/simulation/simulate.js';
import { resolveTestGw2Events } from '#tests/helpers/gw2-resolver.js';
import { GW2_STANDARD_BOONS } from '#gw2/platform/combat/boons.js';
import { gw2EffectExpiresAt } from '#gw2/platform/effects/timing.js';

// Final applications keep their rounded duration but expire on the next absolute 40 ms action tick.
test('boon grants round durations to milliseconds and expirations up to action ticks', () => {
  const profession = defineTestProfession({
    id: 'boon-rounding',
    name: 'Boon rounding',
    hooks: { buffPolicies: () => [{ kind: 'custom' }] },
    catalog: createCanonicalCatalog({
      generated: [
        {
          id: 990001,
          name: 'Grant',
          castTimeMs: 0,
          effects: [
            { type: 'boon', boon: 'Might', duration: 0.3335, stacks: 1 },
            { type: 'buff', kind: 'custom', duration: 1.01, stacks: 1 }
          ]
        }
      ]
    })
  });
  const result = simulateGw2({
    profession,
    rotation: [{ type: 'wait', durationMs: 375 }, 'Grant'],
    config: { stats: { concentration: 1500 } }
  });
  assert.deepEqual(
    result.events.filter((event) => event.type === 'buff').map((event) => [event.kind, event.at, event.duration]),
    [
      ['might', 0.375, 0.667],
      ['custom', 0.375, 1.01]
    ]
  );
  for (const kind of GW2_STANDARD_BOONS) {
    for (const [duration, expected] of [
      [1, 1],
      [1.01, 1.01],
      [1.0005, 1],
      [1.0015, 1.002],
      [1.000499, 1],
      [1.000501, 1.001],
      [0.0005, 0],
      [0.0015, 0.002],
      [1.04, 1.04],
      [0.56 + 0.04, 0.6],
      [0, 0]
    ]) {
      const input = Object.freeze({
        type: 'buff',
        at: 0.375,
        source: 'Player',
        sourceId: 'boon',
        actorType: 'player',
        kind,
        duration,
        fixedDuration: true
      });
      const event = resolveTestGw2Events({ events: [input], endTime: 0.375 }).events.find(
        (event) => event.type === 'buff'
      );
      assert.equal(event.duration, expected);
      assert.equal(event.at, 0.375);
      assert.equal(input.duration, duration);
    }
  }

  assert.equal(gw2EffectExpiresAt(0.36, 1.002), 1.4);
});

// Raw streams and derived reactions must agree with scheduler rounding and never re-round a draining lifetime.
test('resolver boon grants and extensions retain rounded expiry in detailed and score output', () => {
  for (const output of ['detailed', 'score']) {
    const seen = [];
    const owner = { source: 'Player', sourceId: 'probe', actorType: 'player' };
    const events = [
      Object.freeze({ ...owner, type: 'buff', at: 0.375, kind: 'might', duration: 1.01, stacks: 1 }),
      ...[0.375, 1.399999, 1.4, 1.439999, 1.44].map((at) => ({ ...owner, type: 'damage', at, flatDamage: 1 }))
    ];
    const result = resolveTestGw2Events({
      output,
      ...{ ...{ events: [], endTime: 1.5 }, events },
      config: {},
      professionReactions: {
        'damage.resolved': (ctx, event) => {
          if (event.at === 0.375) {
            ctx.effects.emit({
              kind: 'packet',
              event: { ...owner, type: 'buff', at: event.at, kind: 'fury', duration: 1.01, stacks: 1 }
            });
            ctx.effects.emit({
              kind: 'packet',
              event: {
                ...owner,
                type: 'boon_extension',
                at: 0.875,
                duration: 0.0105,
                extensionAudience: 'self'
              }
            });
          } else {
            seen.push([
              event.at,
              ctx.combat.activeBoonStacks('might', event.at),
              Boolean(ctx.combat.activeBoonStacks('fury', event.at))
            ]);
          }
        }
      }
    });
    assert.deepEqual(seen, [
      [1.399999, 1, true],
      [1.4, 1, true],
      [1.439999, 1, true],
      [1.44, 0, false]
    ]);
    assert.equal(events[0].duration, 1.01);
    if (output === 'detailed') {
      assert.deepEqual(
        result.resolvedEvents
          .filter((event) => ['buff', 'boon_extension'].includes(event.type))
          .map((event) => event.duration),
        [1.01, 1.01, 0.01]
      );
    }
  }
});

test('the shared boon multiplier combines concentration, global, named, and sigil bonuses', () => {
  const stats = {
    concentration: 300,
    boonDurationBonus: 10,
    boonDurationBonuses: { Might: 15 }
  };

  assert.equal(gw2BoonDurationMultiplier('might', stats, { boonDurationBonus: 5 }), 1.5);
  assert.equal(gw2BoonDurationMultiplier('might', { concentration: 3000 }), 2);
  assert.equal(gw2BoonDurationMultiplier('might', { concentration: -3000 }), 1);
});

test('static attribute snapshots preserve global and named boon-duration bonuses', () => {
  const stats = gw2StaticAttributes({
    stats: {
      concentration: 300,
      boonDurationBonus: 10,
      boonDurationBonuses: { Might: 15 }
    }
  });

  assert.equal(stats.boonDurationBonus, 10);
  assert.deepEqual(stats.boonDurationBonuses, { Might: 15 });
  assert.ok(Math.abs(gw2BoonDurationMultiplier('might', stats) - 1.45) < 1e-12);
});

test('resolver-owned boons sample timestamp stats and the currently active sigils', () => {
  const observations = [];
  const context = {
    activeWeaponSet: 2,
    config: {
      sigilSets: [{ boonDurationBonus: 0 }, { boonDurationBonus: 5 }]
    },
    query: {
      statsAt(at, event, runtime) {
        observations.push({ at, event, runtime });
        return {
          concentration: 300,
          boonDurationBonus: 10,
          boonDurationBonuses: { Might: 15 }
        };
      }
    }
  };
  const event = { type: 'damage', at: 7, skillId: 2 };

  assert.equal(gw2ResolverBoonDuration(context, event, 'might', 4), 6);
  assert.equal(observations.length, 1);
  assert.equal(observations[0].at, 7);
  assert.equal(observations[0].event.type, 'buff');
  assert.equal(observations[0].event.kind, 'might');
  assert.equal(observations[0].runtime, context);

  assert.equal(gw2ResolverBoonDuration(context, event, 'profession-specific-buff', 4), 4);
  assert.equal(gw2ResolverBoonDuration(context, event, 'might', 4, { fixedDuration: true }), 4);
  assert.equal(observations.length, 1);
});

// Future grants sample at application while retaining the granting trait and trigger modifier context.
test('shared emissions scale live boons once and preserve fixed and custom durations', () => {
  const sampled = [];
  const application = {
    type: 'buff',
    at: 2,
    source: 'Trait',
    sourceId: 3,
    skillId: 3,
    skillName: 'Boon trait',
    actorType: 'effect',
    kind: 'might',
    duration: 10,
    stacks: 3
  };
  const profession = defineTestProfession({
    id: 'duration-fixture',
    name: 'Duration fixture',
    hooks: {
      buffPolicies: () => [{ kind: 'custom' }],
      initialize(runtime) {
        runtime.effects.emit({
          kind: 'packet',
          event: application,
          durationContext: { type: 'damage', at: 0, skillId: 2, actorType: 'player' }
        });
        runtime.effects.emit({ kind: 'packet', event: { ...application, at: 3, fixedDuration: true } });
        runtime.effects.emit({ kind: 'packet', event: { ...application, at: 3, kind: 'custom' } });
      }
    }
  });
  const result = observeGw2Runtime({
    profession: profession.runtimeFor({}),
    rotation: [{ type: 'wait', durationMs: 4000 }],
    // Override a formula collaborator at the engine initialization boundary.
    engineInitialize(runtime) {
      runtime.query = {
        ...runtime.query,
        statsAt(at, event) {
          sampled.push([at, event.skillId, event.actorType]);
          return { concentration: at === 2 ? 750 : 0 };
        }
      };
    }
  });
  assert.deepEqual(
    result.events.filter((e) => e.type === 'buff').map((e) => e.duration),
    [15, 10, 10]
  );
  assert.deepEqual(
    sampled.filter((x) => x[1] === 2),
    [[2, 2, 'player']]
  );
  assert.equal(application.duration, 10);
});

test('declarative boons can gate dynamic skill availability', () => {
  const catalog = createCanonicalCatalog({
    generated: [
      {
        id: 920001,
        name: 'Grant Aegis',
        castTimeMs: 0,
        effects: [
          {
            type: 'boon',
            boon: 'aegis',
            duration: 2,
            stacks: 1
          }
        ]
      },
      {
        id: 920002,
        name: 'Aegis Strike',
        type: 'Utility',
        castTimeMs: 0,
        effects: [{ type: 'strike', coefficient: 1 }]
      }
    ]
  });
  const profession = defineTestProfession({
    id: 'boon-gated',
    name: 'Boon Gated',
    catalog,
    hooks: {
      availability: (runtime, skill) =>
        skill.id !== 920002 || runtime.combat.timeline.buffStacksAt('aegis', runtime.time, 0, 1) > 0
          ? { ready: true }
          : {
              ready: false,
              retryAt: null,
              code: 'fixture.aegis-required',
              reason: 'Aegis Strike is unavailable — requires aegis.'
            }
    }
  });
  const available = simulateGw2({
    profession,
    rotation: ['Grant Aegis', 'Aegis Strike']
  });
  const expired = simulateGw2({
    profession,
    rotation: ['Grant Aegis', { type: 'wait', durationMs: 2100 }, 'Aegis Strike']
  });
  const extended = simulateGw2({
    profession,
    rotation: ['Grant Aegis', { type: 'wait', durationMs: 3100 }, 'Aegis Strike'],
    config: { stats: { concentration: 1500 } }
  });

  assert.ok(available.totalDamage > 0);
  assert.equal(expired.totalDamage, 0);
  assert.ok(extended.totalDamage > 0);
  assert.match(expired.warnings.join(' '), /unavailable/);
});

test('declarative generic buffs use shared timed state without boon-duration scaling', () => {
  let observedAsBuff = false;
  const catalog = createCanonicalCatalog({
    generated: [
      {
        id: 920011,
        name: 'Grant Trait Buff',
        castTimeMs: 0,
        effects: [{ type: 'buff', kind: 'trait-charge', duration: 10, stacks: 3 }]
      },
      {
        id: 920012,
        name: 'Inspect Trait Buff',
        castTimeMs: 0,
        effects: []
      }
    ]
  });
  const profession = defineTestProfession({
    id: 'buff-state-fixture',
    name: 'Buff State Fixture',
    // Observe the actual buff after the preceding instant cast has resolved.
    hooks: {
      buffPolicies: () => [{ kind: 'trait-charge', maximumStacks: 25 }],
      onCastStart(runtime, cast) {
        if (cast.skill.id === 920012)
          observedAsBuff = runtime.combat.timeline.buffStacksAt('trait-charge', runtime.time, 0, 25) > 0;
      }
    },
    catalog
  });
  const result = simulateGw2({
    profession,
    rotation: ['Grant Trait Buff', 'Inspect Trait Buff'],
    config: { stats: { concentration: 1500 } }
  });
  const application = result.events.find((event) => event.type === 'buff' && event.kind === 'trait-charge');

  assert.equal(observedAsBuff, true);
  assert.equal(application?.duration, 10);
});

test('repeated Alacrity grants do not change permanent recharge', () => {
  const catalog = createCanonicalCatalog({
    generated: [
      {
        id: 930025,
        name: 'Grant Alacrity',
        castTimeMs: 0,
        effects: [{ type: 'boon', boon: 'Alacrity', duration: 2, stacks: 1 }]
      },
      {
        id: 930027,
        name: 'Stacked Alacrity Cooldown',
        castTimeMs: 0,
        cooldown: 10,
        effects: []
      }
    ]
  });
  const profession = defineTestProfession({
    id: 'duration-stacking-boon-fixture',
    name: 'Duration Stacking Boon Fixture',
    catalog
  });
  const result = simulateGw2({
    profession,
    rotation: [
      'Grant Alacrity',
      { type: 'wait', durationMs: 1000 },
      'Grant Alacrity',
      { type: 'wait', durationMs: 2000 },
      'Stacked Alacrity Cooldown'
    ]
  });
  assert.equal(result.planningState.cooldowns[930027].readyAt, 11000);
});
