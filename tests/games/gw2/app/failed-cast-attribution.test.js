/** Minimal actions protect failed-cast ownership and observation boundaries without preset calibration. */
import assert from 'node:assert/strict';
import test from 'node:test';

import { timelineIdleTimeMetric } from '#gw2/app/results/idle-time-metric.js';
import { skillBreakdownRows } from '#gw2/app/results/skill-breakdown.js';
import { rotationObservations } from '#gw2/app/rotation/insights/rotation-observations.js';
import { timelineDeadTimeMarkers } from '#gw2/app/rotation/timeline/model.js';
import { combatDeadTimeMarkers } from '#gw2/app/rotation/timeline/occupancy.js';
import { combatActivityEndMs, combatActivityStartMs, failedPlayerCasts } from '#gw2/platform/results/cast-activity.js';
import { emptyTimelineSource } from '#tests/helpers/timeline-presentation.js';

const action = (name, id, start, end, extra = {}) => ({
  type: 'action',
  actorType: 'player',
  skillId: id,
  sourceId: id,
  name,
  skillName: name,
  activationId: `${id}:${start}`,
  at: start,
  endsAt: end,
  interrupted: true,
  cancelled: true,
  ...extra
});
const damage = (name, id, extra = {}) => ({
  name,
  sourceSkill: name,
  parentSkill: '',
  icon: '',
  skillId: id,
  sourceId: id,
  actorType: 'player',
  strikeDamage: 10,
  conditionDamage: 0,
  hits: 1,
  ...extra
});
const result = (actions, extra = {}) => ({
  events: actions,
  resolvedEvents: [],
  breakdown: [],
  procSteps: [],
  dpsStartTime: 0,
  dpsWindow: 2,
  rotationEndTime: 2,
  combatEndTime: 2,
  deathTime: null,
  effectReport: null,
  steps: actions.map((cast, rotationCommandIndex) => ({
    rotationCommandIndex,
    activationId: cast.activationId,
    skillId: cast.skillId,
    skillName: cast.skillName,
    start: cast.at * 1000,
    end: cast.endsAt * 1000,
    interrupted: cast.interrupted,
    cancelledBeforeCommit: cast.cancelled,
    missingInterruptCommit: cast.missingInterruptCommit
  })),
  ...extra
});

test('all-cancelled skills retain a zero-damage player row', () => {
  const run = result([action('Missed', 1, 0, 0.2), action('Missed', 1, 0.2, 0.5)]);
  const rows = skillBreakdownRows(run);
  assert.equal(rows.length, 1);
  assert.equal(rows[0].total, 0);
  assert.equal(rows[0].deadTimeMs, 500);
  assert.equal(rows[0].group, 'Player');
  assert.equal(rows[0].average, null);
  assert.equal(rows[0].dct, null);
});

test('off-target-only failed rows count every attempted cast without damage averages', () => {
  const run = result([
    action('Away', 1, 0, 0.2, { offTarget: true }),
    action('Away', 1, 0.2, 0.4, { offTarget: true })
  ]);
  const [row] = skillBreakdownRows(run);
  assert.equal(row.casts, 2);
  assert.equal(row.deadTimeMs, 400);
  assert.equal(row.average, null);
  assert.equal(row.dct, null);
});

test('summon damage cannot absorb or hide the failed player activation', () => {
  const run = result([action('Chop', 1, 0, 0.2)], {
    breakdown: [damage('Clone: Chop', 1, { actorType: 'summon', sourceSkill: 'Chop', entityName: 'Clone' })]
  });
  const rows = skillBreakdownRows(run);
  assert.equal(rows.find((row) => row.group === 'Player').deadTimeMs, 200);
  assert.equal(rows.find((row) => row.group === 'Entities').deadTimeMs, null);
  assert.equal(
    rows.reduce((sum, row) => sum + (row.deadTimeMs ?? 0), 0),
    200
  );
});

test('merged source variants use the same accepted actions for casts and dead time', () => {
  const run = result([action('Near', 1, 0, 0.1), action('Far', 2, 0.1, 0.3)], {
    breakdown: [
      damage('Near', 1, { damageBreakdownName: 'Shared' }),
      damage('Far', 2, { damageBreakdownName: 'Shared' })
    ]
  });
  const rows = skillBreakdownRows(run);
  assert.equal(rows.length, 1);
  assert.equal(rows[0].name, 'Shared');
  assert.equal(rows[0].casts, 2);
  assert.equal(rows[0].deadTimeMs, 300);
});

// Trigger lineage cannot turn an automatic effect into a cast owner, even without proc-activation metadata.
test('automatic effects cannot borrow cast counts or wasted time from their triggering skills', () => {
  for (const usesTriggerName of [false, true]) {
    const casts = [action('First', 1, 0, 0.2), action('Second', 2, 0.2, 0.36)];
    const run = result(casts, {
      breakdown: [
        damage('First', 1),
        damage('Second', 2),
        ...casts.map((cast) =>
          damage(usesTriggerName ? cast.name : 'Automatic effect', cast.skillId, {
            sourceId: 'automatic-effect',
            actorType: 'effect',
            damageBreakdownName: 'Automatic effect'
          })
        )
      ],
      resolvedEvents: casts.map((cast) => ({
        type: 'damage',
        at: 1,
        damage: 10,
        actorType: 'effect',
        sourceId: 'automatic-effect',
        skillId: cast.skillId,
        skillName: 'Automatic effect',
        name: 'Automatic effect'
      }))
    });
    const rows = skillBreakdownRows(run);
    const effect = rows.find((row) => row.name === 'Automatic effect');
    assert.equal(effect.casts, 0);
    assert.equal(effect.dct, null);
    assert.equal(effect.deadTimeMs, null);
    assert.equal(rows.find((row) => row.name === 'First').deadTimeMs, 200);
    assert.equal(rows.find((row) => row.name === 'Second').deadTimeMs, 160);
  }
});

test('accepted damage and utility resolve interruptions with unknown commit status', () => {
  for (const type of ['damage', 'buff', 'resource', 'control', 'aura', 'combo', 'boon_extension', 'condition']) {
    const cast = action('Useful', 1, 0, 0.2, { cancelled: false, missingInterruptCommit: true });
    const run = result([cast], {
      resolvedEvents: [
        {
          type,
          activationId: cast.activationId,
          actorType: 'player',
          skillId: 1,
          at: 0.1,
          ...(type === 'damage' ? { damage: 10 } : {})
        }
      ]
    });
    assert.equal(failedPlayerCasts(run).length, 0, type);
    assert.equal(skillBreakdownRows(run).length, 0, type);
    assert.equal(timelineIdleTimeMetric(run, emptyTimelineSource).value, '0ms', type);
    assert.equal(rotationObservations(run, 2, emptyTimelineSource).idle.get('failed-cast') ?? 0, 0, type);
  }
});

test('incidental output does not rescue a known pre-commit cancellation', () => {
  const cast = action('Cancelled', 1, 0, 0.2);
  const run = result([cast], {
    resolvedEvents: [{ type: 'damage', actorType: 'effect', activationId: cast.activationId, at: 0.1, damage: 10 }]
  });
  assert.equal(skillBreakdownRows(run)[0].deadTimeMs, 200);
  assert.equal(timelineIdleTimeMetric(run, emptyTimelineSource).value, '200ms');
  assert.equal(timelineDeadTimeMarkers(run.steps, run.resolvedEvents)[0].durationMs, 200);
  assert.equal(rotationObservations(run, 2, emptyTimelineSource).idle.get('failed-cast'), 0.2);
});

test('interrupted casts without commit data count only when their output was unproductive', () => {
  const cast = action('Unknown', 1, 0, 0.2, { cancelled: false, missingInterruptCommit: true });
  const run = result([cast]);
  assert.equal(skillBreakdownRows(run)[0].deadTimeMs, 200);
  assert.equal(timelineIdleTimeMetric(run, emptyTimelineSource).details[0].label, "Cancelled cast 'Unknown'");
});

test('combat boundaries clip failed casts consistently across column, summary, and Insights', () => {
  const casts = [action('Setup', 1, 0, 0.5), action('Crossing', 2, 0.5, 1.5)];
  const run = result(casts, { events: [...casts, { type: 'combat_start', at: 1 }], dpsStartTime: 1 });
  const rows = skillBreakdownRows(run);
  assert.deepEqual(
    rows.map((row) => [row.name, row.deadTimeMs]),
    [['Crossing', 500]]
  );
  assert.equal(timelineIdleTimeMetric(run, emptyTimelineSource).value, '500ms');
  assert.equal(rotationObservations(run, 1, emptyTimelineSource).idle.get('failed-cast'), 0.5);
  const implicitEntry = { ...run, events: casts, combatStartTime: 1 };
  assert.equal(skillBreakdownRows(implicitEntry)[0].deadTimeMs, 500);
  assert.equal(timelineIdleTimeMetric(implicitEntry, emptyTimelineSource).value, '500ms');
});

test('result consumers share occupancy work and invalidate it when the build revision changes', () => {
  let calls = 0;
  const run = result([action('Missed', 1, 0, 0.2)]);
  const source = {
    revision: 1,
    context: {},
    ui: {
      timelineOccupiedInterval: () => {
        calls++;
        return null;
      }
    }
  };
  const markers = combatDeadTimeMarkers(run, source);
  assert.strictEqual(combatDeadTimeMarkers(run, { ...source }), markers);
  timelineIdleTimeMetric(run, source);
  rotationObservations(run, 2, source);
  assert.equal(calls, 1);
  combatDeadTimeMarkers(run, { ...source, revision: 2 });
  assert.equal(calls, 2);
});

test('combat end clips cancellations, waits, and gaps in both timeline and summary', () => {
  const casts = [
    action('Completed', 1, 0, 0.6, { cancelled: false, interrupted: false }),
    action('Crossing', 2, 0.9, 1.2),
    action('After death', 3, 1.9, 2.2)
  ];
  const run = result(casts, { events: casts.slice(0, 2), combatEndTime: 1, deathTime: 1 });
  run.steps.push(
    { rotationCommandIndex: 3, type: 'wait', skillName: 'Wait', start: 600, end: 900 },
    { rotationCommandIndex: 4, type: 'wait', skillName: 'Wait', start: 1200, end: 1600 }
  );
  const strip = timelineDeadTimeMarkers(run.steps, run.resolvedEvents, {
    startMs: combatActivityStartMs(run),
    endMs: combatActivityEndMs(run)
  });
  assert.deepEqual(strip, combatDeadTimeMarkers(run, emptyTimelineSource));
  assert.ok(strip.every((marker) => marker.end <= 1000));
  assert.equal(timelineIdleTimeMetric(run, emptyTimelineSource).value, '400ms');
  assert.deepEqual(
    skillBreakdownRows(run).map((row) => [row.name, row.deadTimeMs]),
    [['Crossing', 100]]
  );
});
