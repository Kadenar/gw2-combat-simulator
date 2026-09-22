import assert from 'node:assert/strict';
import test from 'node:test';

import { defaultSimulationConfig } from '#tests/helpers/fixture-harness-core.js';
import { simulateMesmer } from '#tests/helpers/mesmer-simulation.js';
import { testProfession } from '#tests/fixtures/profession.js';
import { createScheduler } from '#gw2/platform/execution/scheduler.js';
import { createGw2SchedulerPolicy } from '#gw2/platform/execution/gw2-policy/policy.js';
import { createCanonicalCatalog } from '#gw2/platform/engine/skills/canonical-skill-catalog.js';
import { defineProfession } from '#gw2/platform/engine/profession/contract.js';
import { simulateGw2 } from '#gw2/platform/simulation/simulate.js';
import {
  createGw2TriggerMaterializer,
  GW2_MATERIALIZE_EVENT_TASK
} from '#gw2/platform/execution/gw2-policy/proc-materializer.js';
import { isSigilInternalCooldownReady } from '#gw2/platform/equipment/sigils/proc-events.js';
import { createCriticalSigilEvent } from '#gw2/platform/equipment/sigils/proc-events.js';
import { decideCriticalSigils } from '#gw2/platform/equipment/sigils/critical-procs.js';
import { SIGIL_PROCS } from '#gw2/platform/equipment/sigils/data.js';
import { createCriticalSigilDiagnostics } from '#gw2/platform/equipment/sigils/diagnostics.js';
import { createSigilProcEngine } from '#gw2/platform/execution/gw2-policy/sigil-proc-engine.js';

test('Energy sigil restores the live core endurance pool and advances its clock', () => {
  const config = { sigilSets: [{ names: ['Energy'] }] };
  const { state } = createGw2TriggerMaterializer(config);
  const core = { maximumEndurance: 100, endurance: 80, enduranceUpdatedAt: 5 };
  state.profession = { core };
  const events = [];
  // The grant must update the existing scheduler-owned object, capped at its profession's maximum.
  createSigilProcEngine(config, state).materialize(
    'swap',
    { emitDerived: (_cause, event) => events.push(event) },
    { type: 'sigil_swap', at: 6, weaponSet: 1 }
  );
  assert.equal(state.profession.core, core);
  assert.equal(core.endurance, 100);
  assert.equal(core.enduranceUpdatedAt, 6);
  assert.equal(events.filter((event) => event.type === 'resource' && event.resource === 'endurance').length, 1);
});

test('Energy sigil skips absent resources and flat reporting projections', () => {
  for (const profession of [
    null,
    {},
    { core: {} },
    { core: { maximumEndurance: 100 } },
    { core: { endurance: 80 } },
    // Reporting projections must never be mistaken for the mutable scheduler resource owner.
    { maximumEndurance: 100, endurance: 80, enduranceUpdatedAt: 5 }
  ]) {
    const config = { sigilSets: [{ names: ['Energy'] }] };
    const { state } = createGw2TriggerMaterializer(config);
    state.profession = profession;
    const before = structuredClone(profession);
    const events = [];
    createSigilProcEngine(config, state).materialize(
      'swap',
      { emitDerived: (_cause, event) => events.push(event) },
      { type: 'sigil_swap', at: 6, weaponSet: 1 }
    );
    assert.deepEqual(profession, before);
    assert.equal(
      events.some((event) => event.type === 'resource'),
      false
    );
  }
});

test('sigil diagnostics correlate same-time causes and retain explicit suppression evidence', () => {
  const diagnostics = createCriticalSigilDiagnostics();
  const event = (eventOrder) => ({
    type: 'damage',
    at: 1,
    source: 'fixture',
    sourceId: 'same-name',
    actorType: 'player',
    eventOrder
  });
  const proc = { criticalProgress: 0, procs: [{ name: 'Earth', readyAt: 3 }] };
  const absent = { criticalProgress: 0.5, procs: [] };
  for (const id of [1, 2, 3, 4]) diagnostics.record('prediction', event(id), 0.5, id === 3 ? absent : proc);
  diagnostics.record('resolution', event(1), 0.5, proc);
  diagnostics.suppress(event(2), 'target-death');
  diagnostics.record('resolution', event(3), 1, proc);
  diagnostics.record('resolution', event(4), 1, proc);
  diagnostics.record('resolution', event(undefined), 1, proc);
  assert.deepEqual(
    diagnostics.results().map(({ causeEventOrder, status, suppression }) => ({ causeEventOrder, status, suppression })),
    [
      { causeEventOrder: 1, status: 'confirmed', suppression: undefined },
      { causeEventOrder: 2, status: 'predicted-only', suppression: 'target-death' },
      { causeEventOrder: 3, status: 'actual-only', suppression: undefined },
      { causeEventOrder: 4, status: 'changed', suppression: undefined },
      { causeEventOrder: null, status: 'resolver-only', suppression: undefined }
    ]
  );
});

test('sigil diagnostics preserve seeded output and explain suppression of a later planned hit', () => {
  const profession = defineProfession({
    id: 'sigil-diagnostic-fixture',
    name: 'Sigil diagnostic fixture',
    catalog: createCanonicalCatalog(),
    schedulerHooks: {
      initialize(context) {
        for (const at of [0.1, 10])
          context.emit({
            type: 'damage',
            at,
            source: 'fixture',
            sourceId: 'strike',
            actorType: 'player',
            coefficient: 1,
            weaponStrength: 1000
          });
      }
    }
  });
  const options = {
    profession,
    rotation: [{ type: 'wait', durationMs: 11000 }],
    config: {
      stats: { power: 1000, precision: 1945 },
      sigilSets: [{ names: ['Blight'] }],
      randomness: { mode: 'stochastic', seed: 42 }
    }
  };
  const plain = simulateGw2(options);
  const diagnostic = simulateGw2({ ...options, damageDiagnostics: true });
  assert.equal(plain.totalDamage, diagnostic.totalDamage);
  assert.deepEqual(
    plain.events.map((event) => event.didCrit),
    diagnostic.events.map((event) => event.didCrit)
  );
  assert.deepEqual(plain.procSteps, diagnostic.procSteps);
  assert.equal(plain.criticalSigilDiagnostics, undefined);
  assert.equal(
    simulateGw2({ ...options, damageDiagnostics: true, output: 'score' }).criticalSigilDiagnostics,
    undefined
  );
  assert.deepEqual(
    diagnostic.criticalSigilDiagnostics,
    simulateGw2({ ...options, damageDiagnostics: true }).criticalSigilDiagnostics
  );
  const lethal = simulateGw2({
    ...options,
    damageDiagnostics: true,
    config: {
      ...options.config,
      stats: { power: 1000, precision: 4000 },
      target: { health: 1 }
    }
  });
  assert.deepEqual(
    lethal.criticalSigilDiagnostics.map(({ status, suppression }) => [status, suppression]),
    [
      ['confirmed', undefined],
      ['predicted-only', 'target-death']
    ]
  );
});

test('critical sigil decisions preserve inputs, spend cooldown opportunities, and reject ineligible hits', () => {
  // Pure decisions update only their returned progress and the cooldowns of emitted intents.
  const hit = { type: 'damage', at: 2, source: 'fixture', sourceId: 1, actorType: 'player', coefficient: 1 };
  const state = Object.freeze({
    criticalProgress: 0.5,
    readyAt: new Map([
      ['Earth', 2],
      ['Air', 3],
      ['Doom', 9]
    ])
  });
  const decide = (event = hit, chance = 0.5, stochastic = false, didCrit) =>
    decideCriticalSigils(event, ['Earth', 'Air', 'Earth'], { chance, didCrit }, stochastic, state);
  assert.deepEqual(decide(), { criticalProgress: 0, procs: [{ name: 'Earth', readyAt: 4 }] });
  assert.deepEqual(decide({ ...hit, at: 1.999999 }), { criticalProgress: 0, procs: [] });
  assert.deepEqual(decide(hit, 0.25), { criticalProgress: 0.75, procs: [] });
  assert.deepEqual(decide({ ...hit, at: 3 }), {
    criticalProgress: 0,
    procs: [
      { name: 'Earth', readyAt: 5 },
      { name: 'Air', readyAt: 6 }
    ]
  });
  for (const change of [
    { offTarget: true },
    { cancelled: true },
    { noCrit: true },
    { flatDamage: 10 },
    { coefficient: 0 },
    { actorType: 'summon' }
  ]) {
    assert.deepEqual(decide({ ...hit, ...change }), { criticalProgress: 0.5, procs: [] });
  }

  assert.equal(decide({ ...hit, actorType: 'effect', canTriggerCriticalSigils: true }).procs.length, 1);
  assert.deepEqual(decide(hit, 0), { criticalProgress: 0.5, procs: [] });
  assert.deepEqual(decide(hit, 0.5, true, false), { criticalProgress: 0.5, procs: [] });
  assert.deepEqual(decide(hit, 0.5, true, true), { criticalProgress: 0.5, procs: [{ name: 'Earth', readyAt: 4 }] });
  assert.equal(state.criticalProgress, 0.5);
  assert.deepEqual(
    [...state.readyAt],
    [
      ['Earth', 2],
      ['Air', 3],
      ['Doom', 9]
    ]
  );
  assert.throws(
    () => createCriticalSigilEvent('Future', { effect: 'unsupported' }, ''),
    /Unsupported critical sigil effect/
  );
});

test('all authored critical sigils are predictions until a surviving resolver hit commits them', () => {
  // A later hit after death is still planned, but cannot create authoritative Blight or other sigil output.
  for (const [name, proc] of Object.entries(SIGIL_PROCS).filter(([, proc]) => proc.trigger === 'crit')) {
    const profession = defineProfession({
      id: 'sigil-ownership-fixture',
      name: 'Sigil ownership fixture',
      catalog: createCanonicalCatalog(),
      schedulerHooks: {
        initialize(context) {
          for (const at of [0.1, 10])
            context.emit({
              type: 'damage',
              at,
              source: 'fixture',
              sourceId: 'strike',
              actorType: 'player',
              coefficient: 1,
              weaponStrength: 1000
            });
        }
      }
    });
    const config = { stats: { power: 1000, precision: 4000 }, sigilSets: [{ names: [name] }], target: { health: 1 } };
    const rotation = [{ type: 'wait', durationMs: 11000 }];
    const predicted = createScheduler({ profession, config, schedulerPolicy: createGw2SchedulerPolicy(config) }).run(
      rotation
    );
    const packets = predicted.events.filter((event) => event.sourceId === `sigil.${name.toLowerCase()}`);
    assert.deepEqual(
      packets.map((event) => event.at),
      [0.1, 10]
    );
    assert.ok(packets.every((event) => event.schedulerPrediction === 'critical-sigil'));
    const result = simulateGw2({ profession, config, rotation });
    assert.ok(result.events.every((event) => event.schedulerPrediction !== 'critical-sigil'));
    assert.ok(
      result.resolvedEvents.every((event) => event.sourceId !== `sigil.${name.toLowerCase()}` || event.at < 10)
    );
    // Conditions triggered by the lethal hit may settle; a separate Air strike follows the existing death boundary.
    if (proc.effect === 'condition') {
      assert.equal(
        result.resolvedEvents.filter(
          (event) => event.type === 'condition' && event.sourceId === `sigil.${name.toLowerCase()}`
        ).length,
        1
      );
    }
  }
});

test('Blight predictions supply condition-dependent scheduling and expire without recursive relic output', () => {
  // Poison creates a later scheduling opportunity, and the resolver sees the same condition at that time.
  const observed = [];
  const profession = defineProfession({
    id: 'blight-facts-fixture',
    name: 'Blight facts fixture',
    catalog: createCanonicalCatalog(),
    schedulerHooks: {
      initialize(context) {
        context.emit({
          type: 'damage',
          at: 0.1,
          coefficient: 1,
          weaponStrength: 1000,
          source: 'fixture',
          sourceId: 'strike',
          actorType: 'player'
        });
        for (const at of [0.2, 4.1]) context.tasks.schedule({ type: 'fixture.consume-poison', at });
      },
      taskHandlers: {
        'fixture.consume-poison': (context, task) => {
          const poisoned = context.schedulerPolicy.targetHasCondition('Poisoned', task.at);
          observed.push(poisoned);
          if (poisoned)
            context.emit({
              type: 'marker',
              at: task.at,
              name: 'Poison opportunity',
              source: 'fixture',
              sourceId: 'follow-up',
              actorType: 'player'
            });
        }
      }
    },
    resolverHooks: {
      eventReactions: {
        'condition.applied': (context, event) => {
          if (event.sourceId === 'sigil.blight')
            assert.equal(context.query.targetConditionStacks('Poisoned', 0.2, context), 2);
        }
      }
    }
  });
  const config = { stats: { power: 1000, precision: 4000 }, sigilSets: [{ names: ['Blight'] }], relic: 'Shackles' };
  const result = simulateGw2({ profession, config, rotation: [{ type: 'wait', durationMs: 5000 }] });
  assert.deepEqual(observed, [true, false]);
  assert.equal(result.events.filter((event) => event.sourceId === 'follow-up').length, 1);
  assert.equal(
    result.resolvedEvents.filter((event) => event.type === 'condition' && event.sourceId === 'sigil.blight').length,
    1
  );
  assert.ok(result.events.every((event) => event.sourceId !== 'relic.shackles'));
});

// Identical short histories expose equipment eligibility without depending on a saved rotation.
test('critical sigil progress pauses while unequipped and resumes across weapon swaps', () => {
  for (const startingWeaponSet of [1, 2]) {
    const otherSet = startingWeaponSet === 1 ? 2 : 1;
    for (const startsEquipped of [false, true]) {
      const profession = defineProfession({
        id: 'sigil-progress-fixture',
        name: 'Sigil progress fixture',
        catalog: createCanonicalCatalog(),
        schedulerHooks: {
          initialize(context) {
            const owner = { source: 'Fixture', sourceId: 'fixture', actorType: 'player' };
            for (const at of [0.1, 0.3, 0.5]) {
              context.emit({ ...owner, type: 'damage', at, coefficient: 1, weaponStrength: 1000 });
            }

            context.emit({ ...owner, type: 'weapon_set', at: 0.2, weaponSet: otherSet });
            if (startsEquipped) {
              context.emit({ ...owner, type: 'weapon_set', at: 0.4, weaponSet: startingWeaponSet });
            }
          }
        }
      });
      const equippedSet = startsEquipped ? startingWeaponSet : otherSet;
      const config = {
        startingWeaponSet,
        stats: { power: 1000, precision: 1945 },
        sigilSets: [1, 2].map((set) => ({ names: set === equippedSet ? ['Earth'] : [] }))
      };
      const rotation = [{ type: 'wait', durationMs: 1000 }];
      const scheduled = createScheduler({ profession, config, schedulerPolicy: createGw2SchedulerPolicy(config) }).run(
        rotation
      );
      const resolved = simulateGw2({ profession, config, rotation });
      for (const events of [scheduled.events, resolved.resolvedEvents]) {
        assert.deepEqual(
          events.filter((event) => event.sourceId === 'sigil.earth').map((event) => event.at),
          [0.5]
        );
      }
    }
  }
});

test('sigil cooldown boundaries use exact canonical instants', () => {
  // A sigil may proc at its boundary, never before it, including across equivalent floating-point expressions.
  assert.equal(isSigilInternalCooldownReady(5.999999, 6), false);
  assert.equal(isSigilInternalCooldownReady(6, 6), true);
  assert.equal(isSigilInternalCooldownReady(0.1 + 0.2, 0.3), true);
});

test('computed combat boundaries admit opening procs but exclude the preceding microsecond', () => {
  // Decimal addition must not put the opening hit before combat or admit a genuinely earlier hit.
  const profession = defineProfession({
    id: 'combat-boundary-fixture',
    name: 'Combat Boundary Fixture',
    catalog: createCanonicalCatalog({
      generated: [
        {
          id: 1,
          name: 'Strike',
          type: 'Utility',
          castTimeMs: 200,
          effects: [
            {
              type: 'strike',
              timingAnchor: 'castStart',
              ticks: [
                { atMs: 199.999, coefficient: 1 },
                { atMs: 200, coefficient: 1 }
              ]
            }
          ]
        }
      ]
    })
  });
  const config = { stats: { precision: 4000 }, sigilSets: [{ names: ['Air'] }] };
  const rotation = [{ type: 'wait', durationMs: 100 }, 'Strike', { type: 'combat-start', concurrentOffsetMs: 200 }];
  const scheduled = createScheduler({ profession, config, schedulerPolicy: createGw2SchedulerPolicy(config) }).run(
    rotation
  );
  assert.equal(scheduled.context.combatStartTime, 0.3);
  const sigilTimes = (events) =>
    events.filter((event) => event.type === 'damage' && event.sourceId === 'sigil.air').map((event) => event.at);
  assert.deepEqual(sigilTimes(scheduled.stream.events), [0.3]);
  assert.deepEqual(sigilTimes(simulateGw2({ profession, config, rotation }).resolvedEvents), [0.3]);
});

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

test('precombat conditions cannot seed critical facts in either phase', () => {
  // A condition-dependent crit exposes leaked setup conditions without depending on a lucky RNG seed.
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
    assert.equal(observations.has('scheduling:0.5'), false);
    assert.equal(resolvedHits.has(0.5), false);
    assert.ok(result.procSteps.every((step) => step.start >= 1000));
    for (const time of [2, 3]) {
      const stacks = 0;
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
      assert.equal(state.sigil.criticalProgress, 0, 'trait critical facts cannot bank unequipped sigil progress');
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
