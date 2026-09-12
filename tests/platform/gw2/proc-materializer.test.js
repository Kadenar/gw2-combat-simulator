import assert from 'node:assert/strict';
import test from 'node:test';

import { defaultSimulationConfig } from '../../helpers/fixture-harness-core.js';
import { simulateMesmer } from '../../helpers/mesmer-simulation.js';
import { testProfession } from '../../fixtures/test-profession.js';
import { createScheduler } from '#gw2/platform/engine/execution/scheduler.js';
import { createGw2SchedulerPolicy } from '#gw2/platform/scheduler/policy.js';
import { createCanonicalCatalog } from '#gw2/platform/engine/skills/catalog.js';
import { defineProfession } from '#gw2/platform/engine/profession/contract.js';
import { simulateGw2 } from '#gw2/platform/simulation/simulate.js';
import { createGw2TriggerMaterializer, GW2_MATERIALIZE_EVENT_TASK } from '#gw2/platform/scheduler/proc-materializer.js';

test('missed attacks leave consecutive swaps out of combat', () => {
  // A retained cast must not impose combat recharge when its hostile effects miss.
  const profession = defineProfession({
    id: 'missed-swap-fixture',
    name: 'Missed Swap Fixture',
    catalog: createCanonicalCatalog({
      generated: [
        { id: 1, name: 'Strike', type: 'Utility', castTimeMs: 1000, effects: [{ type: 'strike', coefficient: 1 }] },
        { id: 2, name: 'Swap Weapons', type: 'Action', castTimeMs: 0, cooldown: 10, effects: [] }
      ]
    })
  });
  for (const offTarget of [true, false]) {
    const result = simulateGw2({
      profession,
      rotation: [{ name: 'Strike', offTarget }, 'Swap Weapons', 'Swap Weapons']
    });
    assert.deepEqual(result.warnings, []);
    assert.deepEqual(
      result.steps.filter((step) => step.skill === 'Swap Weapons').map((step) => step.start),
      offTarget ? [1000, 1000] : [1000, 11000]
    );
    if (offTarget) assert.equal(result.totalDamage, 0);
  }
});

test('missed hostile facts preserve combat, target conditions, and armed sigils while retaining self buffs', () => {
  // Use the scheduler queue so eligibility is checked on the event consumed by deferred work.
  const config = { sigilSets: [{ names: ['Doom', 'Severance'] }] };
  const materializer = createGw2TriggerMaterializer(config);
  const scheduler = createScheduler({
    profession: testProfession,
    config,
    schedulerPolicy: {
      prepareEvent: createGw2SchedulerPolicy(config).prepareEvent,
      initialize: materializer.initialize,
      onEventScheduled: materializer.onEventScheduled,
      taskHandlers: { [GW2_MATERIALIZE_EVENT_TASK]: materializer.handleTask }
    }
  });
  const { context } = scheduler;
  const owner = { source: 'fixture', sourceId: 'fixture.miss', actorType: 'player' };
  for (const type of ['damage', 'condition', 'control', 'blind']) {
    context.emit({
      ...owner,
      type,
      at: 1,
      offTarget: true,
      coefficient: 1,
      condition: 'Bleeding',
      stacks: 1,
      duration: 10
    });
  }

  scheduler.advanceTo(1);
  assert.equal(materializer.isCombatActive(), false);
  assert.equal(materializer.combatBeganAt(), null);

  context.emit({ ...owner, type: 'combat_start', at: 2 });
  context.emit({ ...owner, type: 'sigil_swap', at: 2, weaponSet: 1 });
  scheduler.advanceTo(2);
  assert.equal(materializer.state.sigil.doomPending, true);
  const missedHit = context.emit({ ...owner, type: 'damage', at: 3, coefficient: 1 });
  context.replaceEvent(missedHit, { offTarget: true });
  context.emit({ ...owner, type: 'control', at: 3, offTarget: true });
  context.emit({ ...owner, type: 'condition', at: 3, offTarget: true, condition: 'Bleeding', stacks: 1, duration: 10 });
  materializer.requireCriticalFacts();
  context.emit({ ...owner, type: 'buff', at: 3, offTarget: true, kind: 'fury', stacks: 1, duration: 10 });
  scheduler.advanceTo(3);
  const { state } = materializer;
  assert.equal(state.query.targetConditionStacks('Bleeding', 3, state), 0);
  assert.equal(state.sigil.doomPending, true);
  assert.equal(state.sigil.readyAt.has('Severance'), false);
  assert.equal(state.boons.get('fury').length, 1);
  assert.equal(materializer.combatBeganAt(), 2);

  context.emit({ ...owner, type: 'damage', at: 4, coefficient: 1 });
  context.emit({ ...owner, type: 'control', at: 4 });
  context.emit({ ...owner, type: 'condition', at: 4, condition: 'Bleeding', stacks: 1, duration: 10 });
  scheduler.advanceTo(4);
  assert.equal(state.query.targetConditionStacks('Bleeding', 4, state), 1);
  assert.equal(state.sigil.doomPending, false);
  assert.equal(state.sigil.readyAt.has('Severance'), true);
  assert.equal(context.events.find((event) => event.sourceId === 'sigil.doom' && event.type === 'condition').at, 4);
});

test('precombat conditions supply matching critical facts across scheduling and resolution', () => {
  // A guaranteed condition-dependent crit exposes stale scheduler state without depending on a lucky RNG seed.
  for (const offTarget of [false, true]) {
    let phase = 'scheduling';
    const observations = new Map();
    const resolvedHits = new Map();
    const profession = defineProfession({
      id: 'precombat-condition-fixture',
      name: 'Precombat Condition Fixture',
      catalog: createCanonicalCatalog({
        generated: [
          {
            id: 1,
            name: 'Condition',
            type: 'Utility',
            castTimeMs: 0,
            effects: [{ type: 'condition', condition: 'Vulnerability', stacks: 25, duration: 3 }]
          },
          {
            id: 2,
            name: 'Strike',
            type: 'Utility',
            castTimeMs: 0,
            effects: [{ type: 'strike', coefficient: 1, weaponStrength: 1000 }]
          }
        ]
      }),
      attributeRules: {
        modifyCriticalChance(context, chance) {
          if (context.event?.skillId !== 2) return chance;
          const stacks = context.query.targetConditionStacks('Vulnerability', context.time, context.runtime);
          observations.set(`${phase}:${context.time}`, { stacks, combatActive: context.runtime.combatActive });
          return chance + stacks / 25;
        }
      },
      resolverHooks: {
        eventReactions: {
          'damage.resolved': (_context, event, { hitContext }) => {
            if (event.skillId === 2) resolvedHits.set(event.at, hitContext.critical);
          }
        }
      }
    });
    const result = simulateGw2({
      profession,
      config: {
        stats: { precision: 895 },
        sigilSets: [{ names: ['Air'] }],
        randomness: { mode: 'stochastic', seed: 1 }
      },
      rotation: [
        { name: 'Condition', offTarget },
        { type: 'wait', durationMs: 500 },
        'Strike',
        { type: 'wait', durationMs: 500 },
        '__combat_start',
        { type: 'wait', durationMs: 1000 },
        'Strike',
        { type: 'wait', durationMs: 1000 },
        'Strike'
      ],
      onPhase(name) {
        if (name === 'scheduling') phase = 'resolution';
      }
    });

    assert.deepEqual(result.warnings, []);
    assert.equal(observations.get('scheduling:0.5').combatActive, false);
    assert.equal(resolvedHits.has(0.5), false);
    assert.ok(result.procSteps.every((step) => step.start >= 1000));
    for (const time of [2, 3]) {
      const stacks = !offTarget && time < 3 ? 25 : 0;
      assert.equal(observations.get(`scheduling:${time}`).stacks, stacks);
      assert.equal(observations.get(`resolution:${time}`).stacks, stacks);
      const scheduledHit = result.events.find(
        (event) => event.type === 'damage' && event.skillId === 2 && event.at === time
      );
      assert.equal(scheduledHit.didCrit, stacks > 0);
      assert.equal(resolvedHits.get(time).chance, stacks / 25);
      assert.equal(resolvedHits.get(time).didCrit, scheduledHit.didCrit);
    }
  }
});

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

test('one critical query supplies trigger decisions and survives same-time boon changes', (t) => {
  for (const mode of ['deterministic', 'stochastic']) {
    const config = { stats: { precision: 2470 }, randomness: { mode, seed: 42 } };
    const materializer = createGw2TriggerMaterializer(config);
    materializer.requireCriticalFacts();
    const scheduler = createScheduler({
      profession: testProfession,
      config,
      schedulerPolicy: {
        prepareEvent: createGw2SchedulerPolicy(config).prepareEvent,
        initialize: materializer.initialize,
        onEventScheduled: materializer.onEventScheduled,
        onEventReplaced: (_context, previous, replacement) => materializer.onEventReplaced(previous, replacement),
        taskHandlers: { [GW2_MATERIALIZE_EVENT_TASK]: materializer.handleTask }
      }
    });
    const { state } = materializer;
    const queryCritical = t.mock.fn(state.query.critical);
    const roll = t.mock.fn(state.random.roll);
    state.query = { ...state.query, critical: queryCritical };
    state.random = { ...state.random, roll };
    const { context } = scheduler;
    const owner = { source: 'fixture', sourceId: 'fixture.critical', actorType: 'player' };
    const hit = context.emit({ ...owner, type: 'damage', at: 1, coefficient: 1 });
    context.emit({ ...owner, type: 'buff', at: 1, kind: 'fury', stacks: 1, duration: 10 });
    scheduler.advanceTo(1);

    // The original and any stochastic replacement retain the observation from before Fury arrived.
    const observed = queryCritical.mock.calls[0].result;
    const canonical = context.eventByOrder(hit.eventOrder);
    assert.equal(observed.chance, 0.75);
    assert.equal(materializer.critical(hit), observed);
    assert.equal(materializer.critical(canonical), observed);
    assert.equal(queryCritical.mock.callCount(), 1);
    if (mode === 'stochastic') {
      assert.equal(roll.mock.callCount(), 1);
      assert.deepEqual(roll.mock.calls[0].arguments, [observed.chance, 'critical:player']);
      assert.equal(canonical.didCrit, roll.mock.calls[0].result);
      assert.notEqual(canonical, hit);
    } else {
      assert.equal(roll.mock.callCount(), 0);
      assert.equal(state.sigil.criticalProgress, observed.chance);
      assert.equal(canonical.didCrit, undefined);
    }

    // Hypothetical copies still query current state, including the later same-time boon.
    assert.equal(materializer.critical({ ...hit }).chance, 1);
    assert.equal(queryCritical.mock.callCount(), 2);
  }
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
