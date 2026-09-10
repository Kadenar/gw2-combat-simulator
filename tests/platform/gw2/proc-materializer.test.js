import assert from 'node:assert/strict';
import test from 'node:test';

import { defaultSimulationConfig } from '../../helpers/fixture-harness-core.js';
import { simulateMesmer } from '../../helpers/mesmer-simulation.js';
import { testProfession } from '../../fixtures/test-profession.js';
import { createScheduler } from '#gw2/platform/engine/execution/scheduler.js';
import { createGw2SchedulerPolicy } from '#gw2/platform/scheduler/policy.js';

test('queued shared facts use replacements made by earlier same-time tasks', () => {
  // Completion-priority edits must reach boon observation and the single canonical critical fact.
  const config = { stats: { precision: 895 }, randomness: { mode: 'stochastic', seed: 1 } };
  const policy = createGw2SchedulerPolicy(config);
  policy.requireCriticalFacts();
  let buff;
  let hit;
  const scheduler = createScheduler({
    profession: testProfession,
    config,
    schedulerPolicy: {
      ...policy,
      taskHandlers: {
        ...policy.taskHandlers,
        'fixture.replace': (context) => {
          context.replaceEvent(buff, { duration: 10 });
          context.replaceEvent(hit, { forceCrit: true });
        }
      }
    }
  });
  const { context } = scheduler;
  const owner = { source: 'fixture', sourceId: 'fixture.facts', actorType: 'player' };
  buff = context.emit({ ...owner, type: 'buff', at: 1, kind: 'fury', stacks: 1, duration: 1 });
  hit = context.emit({ ...owner, type: 'damage', at: 1, coefficient: 1, weaponStrength: 1000 });
  context.tasks.schedule({ type: 'fixture.replace', at: 1, priority: -100 });
  scheduler.advanceTo(1);

  assert.equal(context.eventByOrder(hit.eventOrder).didCrit, true);
  assert.equal(context.eventByOrder(hit.eventOrder).forceCrit, true);
  assert.equal(policy.critical(context, { ...hit, at: 3 }).chance, 0.25);
  assert.equal(policy.critical(context, { ...hit, at: 11 }).chance, 0);
});

test('critical facts follow weapon swaps without proc sigils', () => {
  const defaults = defaultSimulationConfig();
  const stats = {
    ...defaults.stats,
    precision: 895
  };
  const result = simulateMesmer(
    ['__combat_start', 'Swap Weapons', 'Flying Cutter'],
    defaultSimulationConfig({
      food: 'Cilantro Lime Sous-Vide Steak',
      weaponSet2Primary: 'Dagger',
      weaponSet2Secondary: 'Sword',
      stats,
      weaponSetStats: [
        stats,
        {
          ...stats,
          precision: 3100
        }
      ],
      boons: {
        ...defaults.boons,
        fury: false
      },
      sigilSets: [{ names: [] }, { names: [] }],
      randomness: { mode: 'stochastic', seed: 1 }
    })
  );
  const hits = result.events.filter((event) => event.type === 'damage' && event.skillName === 'Flying Cutter');

  assert.ok(hits.length > 0);
  assert.ok(hits.every((event) => event.didCrit === true));
});

test('sigils retrigger on a hit at the exact internal-cooldown boundary', () => {
  const defaults = defaultSimulationConfig();
  const result = simulateMesmer(
    [
      '__combat_start',
      { name: '__wait', waitMs: 40 },
      'Flying Cutter',
      { name: '__wait', waitMs: 4560 },
      'Flying Cutter'
    ],
    defaultSimulationConfig({
      stats: { ...defaults.stats, precision: 4000 },
      sigilSets: [{ names: ['Torment'], strike: 1, condition: 1 }, { names: [] }]
    })
  );

  assert.deepEqual(
    result.procSteps.filter((step) => step.skill === 'Sigil of Torment').map((step) => step.start),
    [360, 5360]
  );
});
