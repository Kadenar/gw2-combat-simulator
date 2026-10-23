import assert from 'node:assert/strict';
import test from 'node:test';
import { resolveTestGw2Events } from '#tests/helpers/gw2-resolver.js';
import { createEncounter } from '#gw2/platform/combat/state/encounter.js';
import { remainingTargetHealthFraction } from '#gw2/platform/combat/state/target-health.js';
import { simulateGw2 } from '#gw2/platform/simulation/simulate.js';
import { defineTestProfession } from '#tests/helpers/profession.js';
import { createCanonicalCatalog } from '#gw2/platform/skills/catalog.js';

const encounter = {
  health: 1000,
  phases: [
    { id: 'a', kind: 'boss', endHealthPercent: 50, groupDps: 200 },
    { id: 'split', kind: 'split', durationSeconds: 2 },
    { id: 'b', kind: 'boss', endHealthPercent: 0, groupDps: 100 }
  ]
};
const hit = (at, flatDamage) => ({
  type: 'damage',
  at,
  flatDamage,
  source: 'Player',
  sourceId: 'probe',
  actorType: 'player'
});
const run = (endTime, events = [], extra = {}) =>
  resolveTestGw2Events({
    endTime,
    events,
    config: { encounter, target: {}, sigilSets: [{ names: [] }] },
    ...extra
  });

// Group damage belongs to health progression and never enters player damage attribution.
test('group damage reaches health gates, pauses for splits, resumes at the next phase rate, and stops on defeat', () => {
  const split = run(4);
  assert.equal(split.encounter.remainingHealth, 500);
  assert.equal(split.encounter.phaseKind, 'split');
  assert.equal(split.environmentDamage, 500);
  assert.equal(split.totalDamage, 0);
  const resumed = run(6);
  assert.equal(resumed.encounter.remainingHealth, 400);
  assert.equal(resumed.encounter.phases[1].end, 5);
  const defeated = run(15);
  assert.equal(defeated.deathTime, 10);
  assert.equal(defeated.environmentDamage, 1000);
  assert.equal(defeated.encounter.remainingHealth, 0);
});

test('player damage can trigger an early split, cancels old group ticks, and excludes invulnerable hits', () => {
  const result = run(4, [hit(0.5, 700), hit(1, 50), hit(2.6, 50)]);
  assert.equal(result.encounter.phases[0].end, 0.5);
  assert.equal(result.encounter.phases[1].end, 2.5);
  assert.equal(result.encounter.remainingHealth, 350);
  assert.equal(result.totalDamage, 550);
  assert.equal(result.environmentDamage, 100);
  assert.equal(result.encounter.phases[0].playerDamage, 500);
});

test('overall player DPS includes split time while completed phase DPS remains fixed', () => {
  const events = [hit(0.5, 500)];
  const earlier = run(1, events).encounter;
  const later = run(2, events).encounter;
  assert.equal(earlier.phases[0].dps, later.phases[0].dps);
  assert.equal(later.phaseDps, 0);
  assert.ok(later.overallDps < earlier.overallDps);
});

test('combat-start preparation delays group damage without charging precombat time', () => {
  const result = run(4, [], { combatStartTime: 3 });
  assert.equal(result.environmentDamage, 200);
  assert.equal(result.encounter.elapsed, 1);
});

test('reporting bands preserve excess damage, while zero-duration invulnerability still clamps its triggering hit', () => {
  const bands = createEncounter(
    {
      health: 1000,
      phases: [
        { id: 'a', kind: 'boss', endHealthPercent: 50, groupDps: 0 },
        { id: 'b', kind: 'boss', endHealthPercent: 0, groupDps: 0 }
      ]
    },
    () => {}
  );
  bands.begin(0);
  assert.equal(bands.damage(700, 'player', 1), 700);
  assert.equal(bands.remainingHealth, 300);
  const split = createEncounter(
    {
      ...encounter,
      phases: encounter.phases.map((phase) => (phase.kind === 'split' ? { ...phase, durationSeconds: 0 } : phase))
    },
    () => {}
  );
  split.begin(0);
  assert.equal(split.damage(700, 'player', 1), 500);
  assert.equal(split.result(1).phaseKind, 'boss');
});

test('target-health queries observe group and player health loss at the accepted boundary', () => {
  const health = [];
  run(2, [hit(1.5, 50)], {
    engineReactions: {
      'damage.resolved': (runtime) => health.push(remainingTargetHealthFraction(runtime.config, runtime))
    }
  });
  assert.deepEqual(health, [0.75]);
});

test('squad DPS replaces permanent environment condition damage without changing player attribution', () => {
  const result = run(2, [], {
    config: { encounter, target: { conditions: { Burning: 25 } }, sigilSets: [{ names: [] }] }
  });
  assert.equal(result.environmentDamage, 400);
  assert.equal(result.totalDamage, 0);
});

// Conditions keep aging during invulnerability but cannot bank split exposure for a catch-up payout.
test('condition clocks survive splits and exclude invulnerable exposure', () => {
  const config = {
    ...encounter,
    health: 100000,
    phases: encounter.phases.map((phase) =>
      phase.kind === 'boss' ? { ...phase, groupDps: phase.id === 'a' ? 50000 : 0 } : phase
    )
  };
  const result = run(
    6,
    [
      {
        type: 'condition',
        at: 0,
        condition: 'Burning',
        duration: 8,
        stacks: 1,
        source: 'Player',
        sourceId: 'burn',
        actorType: 'player'
      }
    ],
    { config: { encounter: config, target: {}, sigilSets: [{ names: [] }] } }
  );
  const split = result.encounter.phases.find((phase) => phase.kind === 'split');
  assert.ok(split && split.end !== null);
  const ticks = result.resolvedEvents
    .filter((event) => event.type === 'condition')
    .flatMap((event) => event.damageTicks ?? []);
  assert.ok(ticks.some((tick) => tick.at >= split.end && tick.damage > 0));
  assert.ok(ticks.every((tick) => tick.at <= split.start || tick.at >= split.end || tick.damage === 0));
  assert.equal(result.encounter.phases.find((phase) => phase.kind === 'split').playerDamage, 0);
});

// A split never creates a new profession runtime or refreshes skills; ordinary waits let cooldowns recover.
test('skills used during splits retain cooldowns and self buffs into the next damage phase', () => {
  const profession = defineTestProfession({
    id: 'encounter-fixture',
    name: 'Encounter fixture',
    catalog: createCanonicalCatalog({
      generated: [
        {
          id: 990101,
          name: 'Self buff',
          castTimeMs: 0,
          cooldown: 10,
          effects: [{ type: 'boon', boon: 'might', stacks: 1, duration: 20 }]
        }
      ]
    })
  });
  const result = simulateGw2({
    profession,
    config: { encounter, target: {}, sigilSets: [{ names: [] }] },
    rotation: [
      { type: 'wait', durationMs: 3500 },
      { type: 'cast', skillId: 990101 },
      { type: 'wait', durationMs: 2000 }
    ]
  });
  assert.equal(result.encounter.phaseId, 'b');
  assert.ok(result.planningState.cooldowns['990101'].remaining > 0);
  assert.ok(result.resolvedEvents.some((event) => event.type === 'buff' && event.kind.toLowerCase() === 'might'));
});
