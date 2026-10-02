import { RELIC_IDS } from '#gw2/platform/equipment/relics/data.js';
import assert from 'node:assert/strict';
import test from 'node:test';
import { resolveTestGw2Events } from '#tests/helpers/gw2-resolver.js';
import { RELIC_NAMES, RELIC_GROUPS } from '#gw2/platform/equipment/relics/catalog.js';
import { roundHalfToEven } from '#kernel/core/numeric.js';

const control = (at, overrides = {}) => ({
  type: 'control',
  at,
  source: 'Player',
  sourceId: 'fixture.control',
  skillName: 'Interrupt',
  actorType: 'player',
  controlKind: 'daze',
  ...overrides
});

// Minimal controls isolate the relic's cooldown and damage contracts from profession rotations.
function run(events, { endTime = 10, config = {}, query = {}, ...options } = {}) {
  return resolveTestGw2Events({
    events,
    endTime,
    config: {
      relic: 'Agony',
      stats: { power: 1000, precision: 4000, ferocity: 2000, conditionDamage: 1000, expertise: 0 },
      target: { armor: 2597, defiant: true, conditions: {} },
      ...config
    },
    query,
    ...options
  });
}

const ticks = (result) => result.resolvedEvents.filter((event) => event.sourceId === `relic.${RELIC_IDS.AGONY}`);

test('Agony is selectable and shares Severance control eligibility with a strict three-second ICD', () => {
  assert.ok(RELIC_NAMES.includes('Agony'));
  assert.ok(RELIC_GROUPS.find((group) => group.label === 'Condition').items.includes('Agony'));
  const result = run([control(0), control(2.999), control(3), control(3.001)], {
    config: { sigilSets: [{ names: ['Severance'] }] }
  });
  assert.deepEqual(
    result.procSteps.filter((proc) => proc.skill === 'Relic of Agony').map((proc) => proc.start),
    [0, 3001]
  );
  assert.ok(result.procSteps.some((proc) => proc.skill === 'Sigil of Severance' && proc.start === 0));
  // Reapplication adds intensity without refreshing or cancelling the first five-second lifetime.
  assert.deepEqual(
    ticks(result).map((event) => event.at),
    [1, 2, 3, 4, 4.001, 5, 5.001, 6.001, 7.001, 8.001]
  );
});

test('Agony samples live Condition Damage while ignoring damage and duration multipliers', () => {
  const query = {
    statsAt: (at) => ({
      power: 9000,
      precision: 4000,
      ferocity: 2000,
      conditionDamage: at < 3 ? 1000 : 2000,
      expertise: 3000
    }),
    strikeMultiplier: () => 10,
    conditionMultiplier: () => 10,
    conditionDurationMultiplier: () => 2
  };
  const result = run([control(0)], {
    query,
    config: { modifiers: { strike: 10, condition: 10 }, target: { armor: 1, conditions: { Vulnerability: 25 } } }
  });
  assert.deepEqual(
    ticks(result).map((event) => event.at),
    [1, 2, 3, 4, 5]
  );
  assert.deepEqual(
    ticks(result).map((event) => event.damage),
    [289.5, 289.5, 444.5, 444.5, 444.5].map(roundHalfToEven)
  );
  assert.ok(ticks(result).every((event) => event.didCrit === false));
  assert.equal(result.strikeDamage, 0);
  assert.equal(
    result.conditionDamage,
    ticks(result).reduce((sum, event) => sum + event.damage, 0)
  );
  assert.equal(
    result.resolvedEvents.some((event) => event.type === 'condition'),
    false
  );
  const base = run([control(0)], { query, config: { target: { conditions: { Vulnerability: 0 } } } });
  assert.equal(base.totalDamage, result.totalDamage);
});

test('Agony accepts summon controls and rejects missed and precombat controls', () => {
  const result = run(
    [control(0, { offTarget: true }), control(1), control(2, { actorType: 'summon', summonKind: 'phantasm' })],
    { combatStartTime: 2 }
  );
  assert.deepEqual(
    result.procSteps.map((proc) => proc.start),
    [2000]
  );
  assert.deepEqual(
    ticks(result).map((event) => event.at),
    [3, 4, 5, 6, 7]
  );
  const missed = run([control(0, { offTarget: true })]);
  assert.equal(missed.totalDamage, 0);
  assert.equal(missed.procSteps.length, 0);
});

test('Agony pays only ticks inside the observation window or before target death', () => {
  const partial = run([control(0)], { endTime: 2.5 });
  assert.deepEqual(
    ticks(partial).map((event) => event.at),
    [1, 2]
  );
  const dead = run([control(0)], { config: { target: { health: 400, conditions: {} } } });
  assert.deepEqual(
    ticks(dead).map((event) => event.at),
    [1, 2]
  );
  assert.equal(dead.conditionDamage, partial.conditionDamage);
  const score = run([control(0)], { endTime: 2.5, output: 'score' });
  assert.equal(score.totalDamage, partial.totalDamage);
});
