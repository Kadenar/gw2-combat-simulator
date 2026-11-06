// Minimal accepted facts exercise attribution and detached projection independently of combat formulas.
import assert from 'node:assert/strict';
import test from 'node:test';

import { createDamageReportRecorder } from '#gw2/platform/results/damage-report.js';
import { projectRuntimeResult } from '#gw2/platform/results/project-runtime.js';
import { observedRuntime, observeGw2Runtime } from '#tests/helpers/observed-runtime.js';
import { defineTestProfession } from '#tests/helpers/profession.js';

const record = (recorder, overrides = {}) =>
  recorder.observer.recordDamage({
    name: 'Shared attack',
    damage: 10,
    component: 'strikeDamage',
    hits: 1,
    source: null,
    didCrit: null,
    ...overrides
  });

test('attribution separates summon kinds, names, parents, and skill identity while enriching matching sources', () => {
  const recorder = createDamageReportRecorder();
  const source = { skillName: 'Source', sourceId: 1, actorType: 'summon' };
  for (const summon of [
    { summonKind: 'clone' },
    { summonKind: 'phantasm' },
    { summonKind: 'pet', entityName: 'First' },
    { summonKind: 'pet', entityName: 'Second' }
  ])
    record(recorder, { source: { ...source, ...summon } });
  record(recorder, { source: { ...source, summonKind: 'pet', entityName: 'First', parentSkillName: 'Parent' } });
  record(recorder, { source: { ...source, sourceId: 2, summonKind: 'clone' } });
  const enrich = { ...source, summonKind: 'clone', skillId: 1, source: 'Summon' };
  record(recorder, { source: enrich });
  enrich.skillName = 'Caller edit';
  const rows = recorder.project(1).breakdown;
  assert.equal(rows.length, 6);
  assert.equal(rows[0].damage, 20);
  assert.equal(rows[0].skillId, 1);
  assert.equal(rows[0].source, 'Summon');
  assert.equal(rows[0].sourceSkill, 'Source');
});

test('critical accounting distinguishes ineligible, eligible noncritical, and seeded critical populations', () => {
  const recorder = createDamageReportRecorder();
  record(recorder, { hits: 2, didCrit: null });
  record(recorder, { hits: 3, didCrit: false });
  record(recorder, { hits: 4, didCrit: true });
  record(recorder, { hits: 5, didCrit: true, component: 'conditionDamage' });
  const row = recorder.project(1).breakdown[0];
  assert.equal(row.hits, 14);
  assert.equal(row.critEligibleHits, 7);
  assert.equal(row.critHits, 4);
});

test('projection combines components before stable ranking and retains zero condition settlements', () => {
  const recorder = createDamageReportRecorder();
  record(recorder, { name: 'Mixed', damage: 20 });
  record(recorder, { name: 'Strike only', damage: 40 });
  record(recorder, { name: 'Mixed', damage: 15, component: 'conditionDamage' });
  record(recorder, { name: 'Mixed', damage: 10 });
  record(recorder, { name: 'Tie', damage: 40 });
  recorder.observer.recordConditionSettlement({ name: 'Burning', damage: 0, stackSeconds: 2 });
  recorder.observer.recordConditionSettlement({ name: 'Burning', damage: 6, stackSeconds: 1 });
  recorder.observer.recordConditionSettlement({ name: 'Bleeding', damage: 0, stackSeconds: 1 });
  const report = recorder.project(2);
  assert.deepEqual(
    report.breakdown.map(({ name, damage }) => [name, damage]),
    [
      ['Mixed', 45],
      ['Strike only', 40],
      ['Tie', 40]
    ]
  );
  assert.equal(report.breakdown[0].strikeDamage, 30);
  assert.equal(report.breakdown[0].conditionDamage, 15);
  assert.deepEqual(report.conditionBreakdown, [
    { name: 'Burning', damage: 6, dps: 3, averageStacks: 1.5 },
    { name: 'Bleeding', damage: 0, dps: 0, averageStacks: 0.5 }
  ]);
  assert.equal(recorder.project(0).conditionBreakdown[0].averageStacks, 0);
});

test('all projections detach rows and nested environment ticks without consuming the recorder', () => {
  const recorder = createDamageReportRecorder();
  record(recorder);
  recorder.observer.recordConditionSettlement({ name: 'Burning', damage: 7, stackSeconds: 2 });
  const fact = { name: 'Bleeding', at: 1, damage: 3 };
  recorder.observer.recordEnvironmentDamage(fact);
  fact.damage = 99;
  const first = recorder.project(1);
  first.breakdown[0].strikeDamage = -1;
  first.conditionBreakdown[0].damage = -1;
  first.environmentConditionBreakdown[0].damageTicks[0].damage = -1;
  first.environmentConditionBreakdown[0].damage = -1;
  const second = recorder.project(1);
  assert.equal(second.breakdown[0].damage, 10);
  assert.equal(second.conditionBreakdown[0].damage, 7);
  assert.equal(second.environmentConditionBreakdown[0].damage, 3);
  assert.equal(second.environmentConditionBreakdown[0].damageTicks[0].damage, 3);
});

test('detailed projection requires its recorder while numeric output never projects report rows', () => {
  const profession = defineTestProfession({ id: 'report-invariant', name: 'Report invariant' }).runtimeFor({});
  const runtime = observedRuntime(observeGw2Runtime({ profession, config: {}, rotation: [] }));
  assert.throws(
    () => projectRuntimeResult(runtime, profession, {}, { output: 'detailed', executed: [] }),
    /damage report projector/
  );
  const projectDamageReport = () => {
    throw new Error('numeric output projected reports');
  };

  assert.equal(
    projectRuntimeResult(runtime, profession, {}, { output: 'score', executed: [], projectDamageReport }).output,
    'score'
  );
  assert.equal(
    projectRuntimeResult(
      runtime,
      profession,
      {},
      {
        output: 'damage',
        executed: [],
        projectDamageReport,
        damageCompletionTime: () => runtime.time
      }
    ).complete,
    true
  );
});

// Optional observers cannot influence target death, reactions, or the shared condition clock.
test('combat and environment stay authoritative with charts or all reporting disabled', () => {
  for (const withPlayer of [false, true]) {
    const runs = [];
    for (const options of [{}, { collectChartData: false }, { output: 'score' }]) {
      const reactions = [];
      const profession = defineTestProfession({
        id: 'report-parity',
        name: 'Report parity',
        hooks: {
          reactions: {
            'damage.resolved'(_context, event) {
              reactions.push(['strike', event.at]);
            },
            'condition-tick.resolved'(_context, event) {
              reactions.push(['condition', event.at]);
            }
          }
        }
      }).runtimeFor({});
      const result = observeGw2Runtime({
        profession,
        config: { target: { health: 100, conditions: { Bleeding: 1 } } },
        rotation: [{ type: 'wait', durationMs: 6000 }],
        ...options,
        engineInitialize(runtime) {
          if (!withPlayer) return;

          const source = { source: 'Fixture', sourceId: 'fixture', actorType: 'player', at: 0.4 };
          runtime.effects.emit({ kind: 'packet', event: { ...source, type: 'damage', flatDamage: 10 } });
          runtime.effects.emit({
            kind: 'packet',
            event: { ...source, type: 'condition', condition: 'Burning', stacks: 1, duration: 2 }
          });
        }
      });
      const runtime = observedRuntime(result);
      assert.ok(result.environmentDamage > 0);
      assert.ok(result.deathTime !== null);

      if (withPlayer) assert.ok(result.strikeDamage > 0 && result.conditionDamage > 0);
      else {
        assert.equal(result.totalDamage, 0);
        assert.equal(result.firstHitTime, null);
      }

      for (const state of runtime.environmentConditions.values()) {
        assert.equal('damage' in state, false);
        assert.equal('damageTicks' in state, false);
        assert.equal('stackSeconds' in state, false);
      }

      if (options.output === 'score') assert.equal(runtime.damageRecorder, null);
      else {
        assert.ok(runtime.damageRecorder);
        assert.ok(result.environmentConditionBreakdown.length > 0);

        if (withPlayer) assert.ok(result.breakdown.length > 0 && result.conditionBreakdown.length > 0);

        if (options.collectChartData === false) assert.equal(result.effectReport, null);
      }

      runs.push({
        totals: runtime.totals,
        environmentDamage: runtime.environmentDamage,
        firstHitTime: runtime.firstHitTime,
        lastHitTime: runtime.lastHitTime,
        deathTime: runtime.deathTime,
        reactions
      });
    }

    assert.deepEqual(runs[1], runs[0]);
    assert.deepEqual(runs[2], runs[0]);
  }
});

// Encounter clamping precedes both per-application attribution and complete condition-group observation.
test('damage reporting consumes accepted strike and condition settlements at the encounter health gate', () => {
  const profession = defineTestProfession({ id: 'accepted-reports', name: 'Accepted reports' }).runtimeFor({});
  const result = observeGw2Runtime({
    profession,
    rotation: [{ type: 'wait', durationMs: 3000 }],
    config: {
      encounter: {
        repeatFrom: null,
        phases: [
          {
            id: 'target',
            kind: 'boss',
            playerTargetId: 'target',
            durationSeconds: null,
            targets: [
              {
                id: 'target',
                name: 'Target',
                armor: 2597,
                hitboxWidth: 140,
                maximumHealth: 50,
                groupDps: 0,
                endHealthPercent: 0,
                startHealthPercent: null,
                entryHealthLossPercent: 0
              }
            ]
          }
        ]
      }
    },
    engineInitialize(runtime) {
      const source = { source: 'Fixture', sourceId: 'fixture', actorType: 'player', at: 0 };
      runtime.effects.emit({ kind: 'packet', event: { ...source, type: 'damage', flatDamage: 10 } });
      runtime.effects.emit({
        kind: 'packet',
        event: { ...source, type: 'condition', condition: 'Burning', stacks: 2, duration: 2 }
      });
    }
  });
  assert.equal(result.totalDamage, 50);
  assert.equal(result.strikeDamage, 10);
  assert.equal(result.conditionDamage, 40);
  assert.equal(
    result.breakdown.reduce((sum, row) => sum + row.damage, 0),
    result.totalDamage
  );
  assert.equal(result.conditionBreakdown[0].damage, 40);
  assert.ok(result.conditionBreakdown[0].averageStacks > 0);
});
