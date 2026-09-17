import assert from 'node:assert/strict';
import test from 'node:test';
import { adaptRotation } from '#gw2/platform/simulation/combat-engine-adapter/rotation.js';
import { adaptObservation } from '#gw2/platform/simulation/combat-engine-adapter/observation.js';
import { adaptResult } from '#gw2/platform/simulation/combat-engine-adapter/result.js';
import { runCombatEngine } from '#gw2/platform/combat-engine/run.js';
import { simulationEventLogRows } from '#gw2/app/results/simulation-event-log.js';
import { buildChartSeries, skillBreakdownRows } from '#gw2/app/results/model.js';
import { paletteEndState } from '#gw2/app/rotation/shared/context.js';
import { encounter, flatStrike, skill } from '../fixtures/combat-engine.js';

/** Use tiny real encounters to check projection contracts independently of saved rotations. */
function project(skills, rotation, { policy, authored = {}, ...configuration } = {}) {
  const skillsById = new Map(
    skills.map((entry, index) => [index + 1, { id: index + 1, name: entry.skill_key, ...authored[index + 1] }])
  );
  const catalog = { skillsById, autoattackChainPositions: new Map() };
  const world = encounter({ skills, require_afk_skills: false, ...configuration });
  const adapted = adaptRotation(
    world.actors[0].build,
    rotation,
    new Map(skills.map((entry, index) => [index + 1, entry.skill_key])),
    skillsById,
    false
  );
  world.actors[0].build = adapted.build;
  world.actors[0].rotation = adapted.rotation;
  const request = adaptObservation(
    { encounter: world, commandSkills: adapted.commandSkills, damageSources: adapted.damageSources },
    policy
  );
  const reference = runCombatEngine({ ...request, tickLimit: 5000 });
  assert.equal(reference.ok, true, reference.message);
  const input = { rotation, observationPolicy: policy };
  return {
    detailed: adaptResult(reference, request, input, catalog),
    score: adaptResult(reference, request, input, catalog, 'score'),
    reference
  };
}

test('repeated activations retain direct and child ownership, while shared procs keep their own identity', () => {
  const { detailed } = project(
    [
      flatStrike('Child', 3),
      flatStrike('Proc', 7),
      flatStrike('Parent', 5, { child_skill_keys: ['Child'], cast_duration: [3, 3], tags: ['parent'] })
    ],
    [
      { type: 'cast', skillId: 3 },
      { type: 'cast', skillId: 3 }
    ],
    {
      policy: { kind: 'active-skills' },
      playerBuild: {
        permanent_unique_effects: [
          {
            unique_effect_key: 'Proc hook',
            skill_triggers: [
              {
                condition: {
                  only_applies_on_begun_casting: true,
                  only_applies_on_begun_casting_skill_with_tag: 'parent'
                },
                skill_key: 'Proc'
              }
            ]
          }
        ]
      }
    }
  );
  assert.equal(detailed.ok, true);
  const result = detailed.result;
  const parents = result.resolvedEvents.filter((event) => event.name === 'Parent');
  const children = result.resolvedEvents.filter((event) => event.name === 'Child');
  assert.deepEqual(
    parents.map((event) => event.activationId),
    ['preview:0', 'preview:1']
  );
  assert.deepEqual(
    children.map((event) => event.activationId),
    ['preview:0', 'preview:1']
  );
  assert.ok(children.every((event) => event.skillId === 3 && event.parentSkillName === 'Parent'));
  assert.ok(result.resolvedEvents.some((event) => event.name === 'Proc' && event.activationId === undefined));
  assert.ok(result.steps.every((step) => step.skillId === 3));
  assert.equal(result.schedulerState, undefined);
  assert.equal(result.endState, undefined);
  assert.equal(
    paletteEndState({
      results: result,
      adapter: { rotationEndStateAt: () => assert.fail('Preview must not request legacy state') }
    }),
    null
  );
  assert.equal(
    skillBreakdownRows(result).reduce((sum, row) => sum + row.total, 0),
    result.totalDamage
  );
});

test('rotation, active skills, tail and absolute windows include only their observed packets', () => {
  const skills = [
    skill('Delayed', {
      weapon_type: 'empty_handed',
      cast_duration: [5, 5],
      skill_ticks: [2, 12, 13].map((on_tick) => ({
        on_tick,
        strike: true,
        weapon_type: 'empty_handed',
        flat_damage: 10,
        can_critical_strike: false
      }))
    })
  ];
  const rotation = [{ type: 'cast', skillId: 1 }];
  const exhausted = project(skills, rotation).detailed;
  const active = project(skills, rotation, { policy: { kind: 'active-skills' } }).detailed;
  const tail = project(skills, rotation, { policy: { kind: 'tail', durationMs: 20 } }).detailed;
  const absolute = project(skills, rotation, { policy: { kind: 'absolute', endTimeMs: 12 } }).detailed;
  assert.equal(exhausted.result.totalDamage, 10);
  assert.equal(active.result.totalDamage, 30);
  assert.equal(tail.result.totalDamage, 30);
  assert.equal(absolute.result.totalDamage, 20);
  assert.equal(exhausted.result.rotationEndTime, tail.result.rotationEndTime);
  assert.ok(Math.abs(tail.result.dpsStartTime + tail.result.dpsWindow - tail.result.rotationEndTime - 0.02) < 1e-12);
  assert.ok(tail.result.dpsWindow > exhausted.result.dpsWindow);
  assert.equal(absolute.reference.endTick, 12);
  const tooEarly = project(skills, rotation, { policy: { kind: 'absolute', endTimeMs: 2 } }).detailed;
  assert.equal(tooEarly.ok, false);
  assert.equal(tooEarly.path, 'observationPolicy.endTimeMs');
});

test('combat-start filters reports, keeps raw damage and separates environment payouts in both output modes', () => {
  const { detailed, score, reference } = project(
    [flatStrike('Hit', 25)],
    [
      { type: 'cast', skillId: 1 },
      { type: 'wait', durationMs: 900 },
      { type: 'combat-start' },
      { type: 'cast', skillId: 1 },
      { type: 'wait', durationMs: 1200 }
    ],
    { targetBuild: { permanent_effects: ['BURNING'] } }
  );
  const result = detailed.result;
  assert.equal(result.totalDamage, 25);
  assert.ok(result.environmentDamage > 0);
  assert.ok(reference.totalDamage > result.totalDamage + result.environmentDamage);
  assert.equal(result.dpsStartTime, result.firstHitTime);
  assert.ok(
    Math.abs(result.environmentDps - result.environmentDamage / (result.rotationEndTime - result.combatStartTime)) <
      1e-10
  );
  for (const [key, value] of Object.entries(score.result))
    if (key !== 'output') assert.deepEqual(value, result[key], key);
  assert.equal(score.reference.events, undefined);
  const chart = buildChartSeries(result);
  assert.equal(chart.cumulativeDamage.at(-1).v, result.totalDamage);
  assert.ok(simulationEventLogRows(result).some((row) => row.description === 'COMBAT START'));
});

test('shortened variants report interruption and death never fabricates cast completion', () => {
  const skills = [flatStrike('Channel', 10, { cast_duration: [20, 20] })];
  const shortened = project(skills, [{ type: 'cast', skillId: 1, interruptAfterMs: 5 }], {
    authored: { 1: { interruptMode: 'per-packet' } }
  }).detailed.result;
  assert.equal(shortened.steps[0].interrupted, true);
  assert.ok(simulationEventLogRows(shortened).some((row) => row.description === 'INTERRUPT Channel'));
  const killed = project(skills, [{ type: 'cast', skillId: 1 }], {
    targetAttributes: [['max_health', 1]],
    policy: { kind: 'absolute', endTimeMs: 100 }
  }).detailed;
  assert.equal(killed.reference.terminatedBy, 'downstate');
  assert.equal(killed.result.deathTime, killed.reference.endTick / 1000);
  assert.equal(killed.result.events.find((event) => event.type === 'action').completed, false);
  assert.ok(!simulationEventLogRows(killed.result).some((row) => row.description === 'END Channel'));
});

test('condition payouts drive totals and charts without fabricated stack lifetimes', () => {
  const { detailed } = project(
    [
      skill('Burn', {
        skill_ticks: [
          {
            on_tick: 0,
            pulse: true,
            on_pulse_effect_applications: [{ effect: 'BURNING', direction: 'OUTGOING', base_duration_ms: 1500 }]
          }
        ]
      })
    ],
    [{ type: 'cast', skillId: 1 }],
    { policy: { kind: 'tail', durationMs: 2000 } }
  );
  const result = detailed.result;
  assert.ok(result.conditionDamage > 0);
  assert.equal(result.strikeDamage, 0);
  assert.equal(result.conditionBreakdown[0].averageStacks, null);
  assert.equal(buildChartSeries(result).cumulativeDamage.at(-1).v, result.totalDamage);
  assert.ok(simulationEventLogRows(result).some((row) => row.description.startsWith('TICK Burning')));
});

test('empty and instantaneous observations keep finite scores', () => {
  for (const rotation of [[], [{ type: 'cast', skillId: 1 }]]) {
    const { detailed } = project([flatStrike('Instant', 10)], rotation);
    assert.ok(Number.isFinite(detailed.result.dps));
    assert.ok(Number.isFinite(detailed.result.environmentDps));
  }
});
