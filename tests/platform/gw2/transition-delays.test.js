import assert from 'node:assert/strict';
import test from 'node:test';
import { createCanonicalCatalog } from '#gw2/platform/engine/skills/catalog.js';
import { defineProfession } from '#gw2/platform/engine/profession/contract.js';
import { createScheduler } from '#gw2/platform/engine/execution/scheduler.js';
import { gw2WeaponSwapSkillHandler } from '#gw2/platform/equipment/weapons/swap.js';
import { createGw2SchedulerPolicy } from '#gw2/platform/scheduler/policy.js';
import { emitTransitionLockout } from '#gw2/platform/simulation/transition-delays.js';
import { simulateGw2 } from '#gw2/platform/simulation/simulate.js';
import { timelineDeadTimeMarkers, timelineTransitionDelayMarkers } from '#gw2/app/rotation/timeline/model.js';
import { engineerProfession } from '#gw2/professions/engineer/definition.js';
import { guardianProfession } from '#gw2/professions/guardian/definition.js';
import { necromancerProfession } from '#gw2/professions/necromancer/definition.js';
import { thiefProfession } from '#gw2/professions/thief/definition.js';

// Small casts isolate input scheduling from profession damage or saved-rotation timing.
const catalog = createCanonicalCatalog({
  skillHandlers: { swap: gw2WeaponSwapSkillHandler },
  generated: [
    {
      id: 1,
      name: 'Retained cast',
      castTimeMs: 560,
      interruptMode: 'per-packet',
      retainsCastLockoutAfterInterrupt: true,
      effects: []
    },
    { id: 2, name: 'Swap Weapons', castTimeMs: 0, handlerId: 'swap', effects: [] },
    { id: 3, name: 'Next cast', castTimeMs: 40, effects: [] },
    { id: 4, name: 'Instant', castTimeMs: 0, effects: [] },
    { id: 5, name: 'Independent input', castTimeMs: 40, independentCast: true, effects: [] }
  ]
});
const profession = defineProfession({
  id: 'transition-fixture',
  name: 'Transition Fixture',
  catalog,
  skillHandlers: { swap: gw2WeaponSwapSkillHandler }
});
function scheduler(delay = 100, options = {}) {
  const config = { transitionDelays: { weaponSwapMs: delay } };
  return createScheduler({
    profession,
    config,
    schedulerPolicy: createGw2SchedulerPolicy(config, { catalog }),
    ...options
  });
}

test('transition delay overlaps retained recovery and only its excess extends the next cast', () => {
  for (const [delay, expected] of [
    [0, 560],
    [100, 560],
    [300, 660]
  ]) {
    const result = scheduler(delay).run([
      { type: 'cast', skillId: 1, interruptAfterMs: 360 },
      'Swap Weapons',
      'Next cast'
    ]);
    assert.deepEqual(result.warnings, []);
    assert.equal(result.steps[1].start, 360);
    assert.equal(result.steps[2].start, expected);
    assert.equal(result.steps[0].castLockoutEnd, 560);
  }
});

test('instant, concurrent, and independent inputs cannot bypass transition recovery', () => {
  for (const command of ['Instant', { type: 'cast', skillId: 3, concurrentOffsetMs: 20 }, 'Independent input']) {
    const result = scheduler().run(['Swap Weapons', command]);
    assert.deepEqual(result.warnings, []);
    assert.equal(result.steps[1].start, 100);
  }
});

test('logged legacy waits and canonical waits count toward recovery instead of adding to it', () => {
  for (const waitMs of [40, 80, 100, 150]) {
    for (const wait of [
      { name: '__wait', waitMs },
      { type: 'wait', durationMs: waitMs }
    ]) {
      const rotation = ['Swap Weapons', wait, 'Next cast'];
      const before = structuredClone(rotation);
      const result = scheduler().run(rotation);
      assert.equal(result.steps[2].start, Math.max(waitMs, 100));
      assert.equal(result.steps[1].start, 0);
      assert.equal(result.steps[1].end, waitMs);
      assert.deepEqual(rotation, before);
      assert.deepEqual(result.warnings, []);
    }
  }
});

test('recovery advances scheduled tasks and rechecks a longer lockout before accepting input', () => {
  const config = { transitionDelays: { weaponSwapMs: 100, shroudExitMs: 100 } };
  const policy = createGw2SchedulerPolicy(config, { catalog });
  const pending = createScheduler({
    profession,
    config,
    schedulerPolicy: {
      ...policy,
      taskHandlers: {
        ...policy.taskHandlers,
        exit(context, task) {
          emitTransitionLockout(context, 'shroudExitMs', task.at);
        }
      }
    }
  });
  pending.context.tasks.schedule({ type: 'exit', at: 0.05 });
  const result = pending.run(['Swap Weapons', 'Next cast']);
  assert.equal(result.steps[1].start, 150);
  assert.deepEqual(result.warnings, []);
});

test('future transition emissions leave earlier concurrent inputs available', () => {
  const pending = scheduler();
  emitTransitionLockout(pending.context, 'weaponSwapMs', 0.5);
  const result = pending.run(['Instant', { type: 'wait', durationMs: 500 }, 'Next cast']);
  assert.equal(result.steps[0].start, 0);
  assert.equal(result.steps[2].start, 600);
});

test('last-transition recovery contributes to rotation completion while an absolute horizon stays fixed', () => {
  assert.equal(scheduler().run(['Swap Weapons']).stream.rotationEndTime, 0.1);
  assert.equal(
    scheduler(100, { observationPolicy: { kind: 'absolute', endTimeMs: 1000 } }).run(['Swap Weapons']).stream
      .resolutionEndTime,
    1
  );
});

test('invalid transitions do not emit input recovery', () => {
  const denied = defineProfession({
    id: 'denied-transition',
    name: 'Denied Transition',
    catalog,
    skillHandlers: { swap: gw2WeaponSwapSkillHandler },
    castRules: {
      availability: (context, skill) =>
        skill.id === 2
          ? { ready: false, retryAt: null, reason: 'Unavailable', code: 'fixture.denied' }
          : { ready: true }
    }
  });
  const result = scheduler(100, { profession: denied }).run(['Swap Weapons', 'Next cast']);
  assert.equal(result.steps[0].invalid, true);
  assert.equal(result.steps[1].start, 0);
  assert.equal(
    result.events.some((event) => event.type === 'gw2.transition-lockout'),
    false
  );
});

const transitions = { weaponSwapMs: 900, forgeEntryMs: 110, forgeExitMs: 130, shroudEntryMs: 150, shroudExitMs: 170 };
test('profession transitions use their own entry and exit settings without charging weapon-swap delay', () => {
  for (const [profession, specialization, entry, exit] of [
    [engineerProfession, 'Holosmith', 'Engage Photon Forge', 'Deactivate Photon Forge'],
    [guardianProfession, 'Luminary', 'Enter Radiant Forge', 'Exit Radiant Forge'],
    [necromancerProfession, 'Core', 'Death Shroud', 'End Death Shroud'],
    [necromancerProfession, 'Reaper', "Reaper's Shroud", "Exit Reaper's Shroud"],
    [thiefProfession, 'Specter', 'Enter Shadow Shroud', 'Exit Shadow Shroud']
  ]) {
    const result = simulateGw2({
      profession,
      rotation: [entry, { type: 'wait', durationMs: 1000 }, exit],
      config: { specialization, transitionDelays: transitions, initialResource: 100, initialShadowForce: 100 }
    });
    assert.deepEqual(result.warnings, [], specialization);
    const events = result.events.filter((event) => event.type === 'gw2.transition-lockout');
    const forge = ['Holosmith', 'Luminary'].includes(specialization);
    assert.deepEqual(
      events.map((event) => event.kind),
      forge ? ['forgeEntryMs', 'forgeExitMs'] : ['shroudEntryMs', 'shroudExitMs'],
      specialization
    );
    assert.deepEqual(
      events.map((event) => Math.round(event.duration * 1000)),
      forge ? [110, 130] : [150, 170]
    );
    assert.ok(result.resolvedEvents.some((event) => event.type === 'gw2.transition-lockout'));
  }
});

test('automatic shroud depletion and forge expiry apply exit recovery at the transition timestamp', () => {
  for (const [profession, specialization, entry, waitMs, resource] of [
    [thiefProfession, 'Specter', 'Enter Shadow Shroud', 500, { initialShadowForce: 1 }],
    [guardianProfession, 'Luminary', 'Enter Radiant Forge', 20000, {}],
    [necromancerProfession, 'Core', 'Death Shroud', 30000, { initialResource: 10 }]
  ]) {
    const result = simulateGw2({
      profession,
      rotation: [entry, { type: 'wait', durationMs: waitMs }],
      config: { specialization, transitionDelays: transitions, ...resource }
    });
    assert.deepEqual(result.warnings, [], specialization);
    const exit = result.events.find(
      (event) => event.type === 'gw2.transition-lockout' && event.kind.endsWith('ExitMs')
    );
    assert.ok(exit, specialization);
    assert.ok(result.schedulerState.time >= exit.at + exit.duration - 1e-9);
  }
});

test('overheated Photon Forge applies exit recovery only at the explicit exit', () => {
  // Overheat locks Forge attacks; the later rotation command owns the bar exit and its recovery.
  const result = simulateGw2({
    profession: engineerProfession,
    rotation: ['Engage Photon Forge', { type: 'wait', durationMs: 1000 }, 'Deactivate Photon Forge'],
    config: { specialization: 'Holosmith', transitionDelays: transitions, initialHeat: 99 }
  });
  assert.deepEqual(result.warnings, []);
  const overheat = result.events.find((event) => event.type === 'engineer.state' && event.reason === 'overheat');
  const exitStep = result.steps.find((step) => step.skill === 'Deactivate Photon Forge');
  assert.ok(overheat.at < exitStep.start / 1000);
  const exits = result.events.filter(
    (event) => event.type === 'gw2.transition-lockout' && event.kind === 'forgeExitMs'
  );
  assert.equal(exits.length, 1);
  assert.equal(exits[0].at, exitStep.end / 1000);
  assert.equal(Math.round(exits[0].duration * 1000), transitions.forgeExitMs);
  assert.ok(result.schedulerState.time >= exits[0].at + exits[0].duration - 1e-9);
});

test('transition recovery is occupied timeline time without an injected Wait shape', () => {
  const result = scheduler().run(['Swap Weapons', 'Next cast']);
  assert.equal(
    result.steps.some((step) => step.skill === 'Wait'),
    false
  );
  assert.deepEqual(timelineDeadTimeMarkers(result.steps, result.events), []);
  assert.deepEqual(timelineTransitionDelayMarkers(result.steps, result.events, result.state.time * 1000), [
    { start: 0, end: 100, durationMs: 100, insertionIndex: 1 }
  ]);
});

test('forced-delay markers exclude retained recovery and logged waits, and include final recovery', () => {
  const retained = scheduler().run([{ type: 'cast', skillId: 1, interruptAfterMs: 360 }, 'Swap Weapons', 'Next cast']);
  assert.deepEqual(timelineTransitionDelayMarkers(retained.steps, retained.events, retained.state.time * 1000), []);
  const waited = scheduler().run(['Swap Weapons', { type: 'wait', durationMs: 80 }, 'Next cast']);
  assert.deepEqual(timelineTransitionDelayMarkers(waited.steps, waited.events, waited.state.time * 1000), [
    { start: 80, end: 100, durationMs: 20, insertionIndex: 2 }
  ]);
  const last = scheduler().run(['Swap Weapons']);
  assert.deepEqual(timelineTransitionDelayMarkers(last.steps, last.events, last.state.time * 1000), [
    { start: 0, end: 100, durationMs: 100, insertionIndex: 1 }
  ]);
});

test('automatic exit during final entry recovery extends only the overlapping deadline', () => {
  const result = simulateGw2({
    profession: thiefProfession,
    rotation: ['Enter Shadow Shroud'],
    config: {
      specialization: 'Specter',
      initialShadowForce: 1,
      transitionDelays: { shroudEntryMs: 600, shroudExitMs: 200 }
    }
  });
  assert.equal(result.schedulerState.time, 0.7);
  assert.equal(result.endState.profession.shadowShroudActive, false);
  assert.deepEqual(result.warnings, []);
});
