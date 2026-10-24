import assert from 'node:assert/strict';
import test from 'node:test';
import { resolveTestGw2Events } from '#tests/helpers/gw2-resolver.js';
import { createEncounter } from '#gw2/platform/combat/state/encounter.js';
import { remainingTargetHealthFraction } from '#gw2/platform/combat/state/target-health.js';
import { simulateGw2 } from '#gw2/platform/simulation/simulate.js';
import { defineTestProfession } from '#tests/helpers/profession.js';
import { createCanonicalCatalog } from '#gw2/platform/skills/catalog.js';

const bossPhase = (id, endHealthPercent, groupDps, maximumHealth = 1000) => ({
  id,
  kind: 'boss',
  playerTargetId: 'target',
  durationSeconds: null,
  targets: [
    {
      id: 'target',
      name: 'Target',
      maximumHealth,
      groupDps,
      endHealthPercent,
      startHealthPercent: null,
      entryHealthLossPercent: 0
    }
  ]
});
const encounter = {
  repeatFrom: null,
  phases: [bossPhase('a', 50, 200), { id: 'split', kind: 'split', durationSeconds: 2 }, bossPhase('b', 0, 100)]
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
      repeatFrom: null,
      phases: [bossPhase('a', 50, 0), bossPhase('b', 0, 0)]
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
    phases: encounter.phases.map((phase) =>
      phase.kind === 'boss'
        ? {
            ...phase,
            targets: phase.targets.map((target) => ({
              ...target,
              maximumHealth: 100000,
              groupDps: phase.id === 'a' ? 50000 : 0
            }))
          }
        : phase
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

// Bar replacement is a real target-state boundary, not a recalculation against the encounter's total damage.
test('replacement bars use their own maximum and prevent overkill and old conditions from crossing', () => {
  const first = bossPhase('first', 50, 50000, 100000);
  const last = bossPhase('last', 0, 0, 200000);
  last.targets[0].startHealthPercent = 50;
  const config = { repeatFrom: null, phases: [first, { id: 'travel', kind: 'split', durationSeconds: 2 }, last] };
  const burn = {
    type: 'condition',
    at: 0,
    condition: 'Burning',
    duration: 10,
    stacks: 1,
    source: 'Player',
    sourceId: 'burn',
    actorType: 'player'
  };
  const result = run(6, [burn], { config: { encounter: config, target: {}, sigilSets: [{ names: [] }] } });
  assert.equal(result.encounter.health, 200000);
  assert.equal(result.encounter.remainingHealth, 100000);
  assert.equal(result.encounter.phases.at(-1).playerDamage, 0);
  assert.equal(result.deathTime, null);
  const fractions = [];
  run(6, [hit(3.5, 10000)], {
    config: { encounter: config, target: {}, sigilSets: [{ names: [] }] },
    engineReactions: {
      'damage.resolved': (runtime) => fractions.push(remainingTargetHealthFraction(runtime.config, runtime))
    }
  });
  assert.deepEqual(fractions, [0.45]);
  const noSplit = createEncounter({ repeatFrom: null, phases: [first, last] }, () => {});
  noSplit.begin(0);
  assert.equal(noSplit.damage(200000, 'player', 0.5), 50000);
  assert.equal(noSplit.remainingHealthFraction, 0.5);
});

// Each target receives its own rate; unused DPS cannot spill into another health pool.
test('parallel target rates clamp independently and wait for the slower target without moving player attacks', () => {
  const phase = bossPhase('parallel', 50, 600);
  phase.targets.push({ ...phase.targets[0], id: 'other', name: 'Other', groupDps: 100 });
  const config = {
    repeatFrom: null,
    phases: [
      phase,
      { id: 'split', kind: 'split', durationSeconds: 2 },
      { ...phase, id: 'final', targets: phase.targets.map((target) => ({ ...target, endHealthPercent: 0 })) }
    ]
  };
  const result = run(3, [hit(1.5, 900)], { config: { encounter: config, target: {}, sigilSets: [{ names: [] }] } });
  assert.deepEqual(
    result.encounter.targets.map((target) => target.remainingHealth),
    [500, 700]
  );
  assert.equal(result.totalDamage, 0);
  assert.equal(result.encounter.phaseId, 'parallel');
  const split = run(5, [], { config: { encounter: config, target: {}, sigilSets: [{ names: [] }] } });
  assert.equal(split.encounter.phaseKind, 'split');
  assert.equal(split.encounter.phases[0].end, 5);
  const selected = structuredClone(config);
  selected.phases[0].playerTargetId = 'other';
  const assist = run(2, [hit(0.5, 200)], { config: { encounter: selected, target: {}, sigilSets: [{ names: [] }] } });
  assert.deepEqual(
    assist.encounter.targets.map((target) => target.remainingHealth),
    [500, 600]
  );
  assert.equal(assist.encounter.targetName, 'Other');
});

// Timed windows close even when DPS is insufficient, while a health gate can end the window early.
test('timed cycles preserve health, cancel old wakes, and stop on defeat before another split', () => {
  const config = {
    repeatFrom: 'burn',
    phases: [
      { ...bossPhase('burn', 0, 100), durationSeconds: 2.5 },
      { id: 'pause', kind: 'split', durationSeconds: 1 }
    ]
  };
  const resumed = run(5, [], { config: { encounter: config, target: {}, sigilSets: [{ names: [] }] } });
  assert.equal(resumed.encounter.remainingHealth, 700);
  assert.equal(resumed.encounter.phases[1].end, 3.5);
  const done = run(30, [], { config: { encounter: config, target: {}, sigilSets: [{ names: [] }] } });
  assert.equal(done.encounter.defeated, true);
  assert.equal(done.encounter.phases.at(-1).kind, 'boss');
  assert.equal(done.environmentDamage, 1000);
  const early = run(5, [hit(0.5, 1000)], { config: { encounter: config, target: {}, sigilSets: [{ names: [] }] } });
  assert.equal(early.deathTime, 0.5);
  assert.equal(early.environmentDamage, 0);
});
