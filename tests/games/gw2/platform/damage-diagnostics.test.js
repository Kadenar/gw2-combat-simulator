import assert from 'node:assert/strict';
import test from 'node:test';
import { buildScheduledEventStream } from '#gw2/platform/engine/events/scheduled-stream.js';
import { canonicalTargetConditionName } from '#gw2/platform/combat/state/targets.js';
import { roundHalfToEven } from '#gw2/platform/combat/numeric.js';
import { createCanonicalCatalog } from '#gw2/platform/engine/skills/catalog.js';
import { defineProfession } from '#gw2/platform/engine/profession/contract.js';
import { simulateGw2 } from '#gw2/platform/simulation/simulate.js';
import { resolveTestGw2Stream } from '#tests/helpers/gw2-resolver.js';

// Minimal packets exercise each formula branch and expose query/RNG consumption without saved-rotation expectations.
function resolveHits(damageDiagnostics, output = 'detailed', target = { health: 100000, startingHealthFraction: 0.4 }) {
  let queries = 0;
  const rolls = [];
  const retained = [];
  const events = [
    {
      coefficient: 1,
      weaponStrengthProfileId: 'weapon.axe',
      coefficientModifiers: [{ kind: 'target-health-below', threshold: 0.5, multiplier: 2 }]
    },
    {
      flatStrikeBase: 10,
      flatStrikePowerCoeff: 0.1,
      flatStrikeMultiplier: 1.2,
      flatStrikeHealthThreshold: 0.5,
      flatStrikeThresholdMultiplier: 2
    },
    {
      coefficient: 1,
      independentSummonStrike: true,
      summonDamagePerCoefficient: 100,
      summonBasePower: 1000,
      actorType: 'summon'
    },
    {
      coefficient: 1,
      independentSummonStrike: true,
      weaponStrengthProfileId: 'summon.weapon-type-1',
      actorType: 'summon'
    },
    { flatDamage: 10.5, damageKind: 'condition' }
  ].map((event, index) => ({
    type: 'damage',
    at: 0.600001 + index,
    source: 'Player',
    sourceId: `hit-${index}`,
    actorType: 'player',
    ...event
  }));
  const result = resolveTestGw2Stream({
    damageDiagnostics,
    output,
    stream: buildScheduledEventStream({ events, rotationEndTime: 5 }),
    config: { target, randomness: { mode: 'stochastic', seed: 42 }, sigilSets: [{ names: [] }] },
    traits: new Set(),
    query: {
      statsAt: () => {
        queries += 1;
        return { power: 1000, precision: 1800, ferocity: 500 };
      },
      critical: () => {
        queries += 1;
        return { chance: 0.5, damage: 1.75 };
      },
      strikeMultiplier: () => {
        queries += 1;
        return 1.2;
      }
    },
    helpers: { conditionName: canonicalTargetConditionName, skillsByName: new Map() },
    professionReactions: {
      'damage.resolved': (ctx) => {
        rolls.push(
          ctx.random.next('critical:player'),
          ctx.random.next('weapon-strength:player'),
          ctx.random.next('weapon-strength:summon')
        );
        retained.push(ctx.resolved.at(-1)?.damageCalculation);
      }
    }
  });
  return { result, queries, rolls, retained };
}

test('diagnostic factors reconstruct actual rounded packets without changing queries, RNG, or numeric output', () => {
  const plain = resolveHits(false);
  const diagnostic = resolveHits(true);
  const score = resolveHits(true, 'score');
  for (const run of [diagnostic, score]) {
    for (const key of ['totalDamage', 'strikeDamage', 'conditionDamage', 'deathTime', 'duration', 'dpsWindow']) {
      assert.equal(run.result[key], plain.result[key], key);
    }

    assert.equal(run.queries, plain.queries);
    assert.deepEqual(run.rolls, plain.rolls);
  }

  assert.ok(plain.retained.every((value) => value === undefined));
  assert.ok(score.retained.every((value) => value === undefined));
  const hits = diagnostic.result.resolvedEvents;
  for (const hit of hits) {
    const calculation = hit.damageCalculation;
    assert.equal(calculation.phase, 'Ordinary');
    assert.equal(
      calculation.unroundedDamage,
      calculation.baseDamage * calculation.criticalMultiplier * calculation.outgoingMultiplier
    );
    assert.equal(
      hit.damage,
      calculation.rounding === 'floor'
        ? Math.floor(calculation.unroundedDamage)
        : roundHalfToEven(calculation.unroundedDamage)
    );
    assert.equal(calculation.power, 1000);
    assert.equal(calculation.precision, 1800);
    assert.equal(calculation.ferocity, 500);
  }

  assert.equal(hits[0].damageCalculation.targetHealthBefore, 40000);
  assert.equal(hits[0].damageCalculation.coefficientMultiplier, 2);
  assert.equal(hits[1].damageCalculation.targetHealthBefore, 40000 - hits[0].damage);
  assert.equal(hits[1].damageCalculation.baseDamage, 110);
  assert.equal(hits[1].damageCalculation.outgoingMultiplier, 2.4);
  for (const index of [1, 2, 4]) assert.equal(hits[index].resolvedWeaponStrength, undefined);
  assert.equal(hits[2].damageCalculation.baseDamage, 100);
  assert.equal(hits[3].weaponStrengthProfileId, 'summon.weapon-type-1');
  assert.equal(hits[4].damageCalculation.rounding, 'half-even');
  assert.equal(hits[4].damage, 10);
  const unbounded = resolveHits(true, 'detailed', {}).result.resolvedEvents[0].damageCalculation;
  assert.equal(unbounded.targetHealthBefore, null);
  assert.equal(unbounded.targetHealthFractionBefore, null);
  assert.equal(unbounded.coefficientMultiplier, 1);
});

test('diagnostics capture settlement and environment health before the following hit', () => {
  const result = resolveTestGw2Stream({
    damageDiagnostics: true,
    stream: buildScheduledEventStream({
      events: [
        {
          type: 'condition',
          at: 0,
          source: 'Player',
          sourceId: 'bleed',
          actorType: 'player',
          condition: 'Bleeding',
          duration: 1,
          stacks: 1
        },
        { type: 'damage', at: 1, source: 'Player', sourceId: 'hit', actorType: 'player', flatDamage: 1, priority: -100 }
      ],
      rotationEndTime: 1
    }),
    config: { target: { health: 1000, startingHealthFraction: 0.53, conditions: { Bleeding: 1 } } },
    traits: new Set(),
    query: {
      statsAt: () => ({ power: 1000, conditionDamage: 125 }),
      conditionDurationMultiplier: () => 1,
      conditionMultiplier: () => 1,
      vulnerabilityStacksAt: () => 0
    },
    helpers: { conditionName: canonicalTargetConditionName, skillsByName: new Map() }
  });
  const calculation = result.resolvedEvents.find((event) => event.type === 'damage').damageCalculation;
  assert.equal(result.environmentDamage, 22);
  assert.equal(result.conditionDamage, 30);
  assert.ok(Math.abs(calculation.targetHealthBefore - 478) < 1e-10);
  assert.ok(Math.abs(calculation.targetHealthFractionBefore - 0.478) < 1e-12);
  assert.equal('precision' in calculation, false);
  assert.equal('ferocity' in calculation, false);
});

// Feedback must see ordinary results; only its final seeded configuration is replayed for requested diagnostics.
test('public diagnostics capture once after feedback and are suppressed in score fallback', () => {
  const capture = [];
  const catalog = createCanonicalCatalog({
    generated: [
      {
        id: 990001,
        name: 'Hit',
        type: 'Weapon',
        weapon: 'Axe',
        castTimeMs: 100,
        cooldown: 0,
        effects: [{ type: 'strike', coefficient: 1 }]
      }
    ],
    weapons: ['Axe'],
    weaponHands: { Axe: 'mh+oh' }
  });
  const profession = defineProfession({
    id: 'diagnostic-feedback',
    name: 'Diagnostic feedback',
    catalog,
    resolverHooks: {
      eventReactions: {
        'damage.resolved': (ctx) => {
          capture.push(ctx.damageDiagnostics);
        }
      }
    },
    simulation: {
      refineSchedulerConfig: (config, result) => {
        assert.ok(result.resolvedEvents.every((event) => !event.damageCalculation));
        return config.stats.power === 2000 ? null : { ...config, stats: { ...config.stats, power: 2000 } };
      }
    }
  });
  const options = {
    profession,
    rotation: ['Hit'],
    config: {
      primaryWeapon: 'Axe',
      stats: { power: 1000, precision: 1800, ferocity: 500 },
      randomness: { mode: 'stochastic', seed: 72 }
    }
  };
  const plain = simulateGw2(options);
  assert.deepEqual(capture.splice(0), [false, false]);
  const diagnostic = simulateGw2({ ...options, damageDiagnostics: true });
  assert.deepEqual(capture.splice(0), [false, false, true]);
  const score = simulateGw2({ ...options, damageDiagnostics: true, output: 'score' });
  assert.deepEqual(capture.splice(0), [false, false]);
  assert.equal(diagnostic.totalDamage, plain.totalDamage);
  assert.equal(score.totalDamage, plain.totalDamage);
  assert.equal(diagnostic.resolvedEvents.find((event) => event.type === 'damage').damageCalculation.power, 2000);
  assert.deepEqual(diagnostic.randomness, plain.randomness);
  simulateGw2({ ...options, profession: { ...profession, simulation: null }, damageDiagnostics: true });
  assert.deepEqual(capture, [true]);
});
