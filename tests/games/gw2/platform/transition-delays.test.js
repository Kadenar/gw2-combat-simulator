import assert from 'node:assert/strict';
import test from 'node:test';
import { createCanonicalCatalog } from '#gw2/platform/engine/skills/canonical-skill-catalog.js';
import { defineProfession } from '#gw2/platform/engine/profession/contract.js';
import { simulateGw2 } from '#gw2/platform/simulation/simulate.js';
import { runGw2Runtime } from '#gw2/platform/simulation/runtime.js';
import { timelineDeadTimeMarkers, timelineTransitionDelayMarkers } from '#gw2/app/rotation/timeline/model.js';
import { engineerProfession } from '#gw2/professions/engineer/profession.js';
import { guardianProfession } from '#gw2/professions/guardian/profession.js';
import { necromancerProfession } from '#gw2/professions/necromancer/profession.js';
import { thiefProfession } from '#gw2/professions/thief/profession.js';

// Small casts isolate input scheduling from profession damage or saved-rotation timing.
const catalog = createCanonicalCatalog({
  generated: [
    {
      id: 1,
      name: 'Retained cast',
      castTimeMs: 560,
      interruptMode: 'per-packet',
      retainsCastLockoutAfterInterrupt: true,
      effects: []
    },
    { id: 2, name: 'Swap Weapons', castTimeMs: 0, inputCategory: 'weapon-swap', effects: [] },
    { id: 3, name: 'Next cast', castTimeMs: 40, effects: [] },
    { id: 4, name: 'Instant', castTimeMs: 0, effects: [] },
    { id: 5, name: 'Independent input', castTimeMs: 40, independentCast: true, effects: [] }
  ]
});
const profession = defineProfession({
  id: 'transition-fixture',
  name: 'Transition Fixture',
  catalog
});
function simulate(rotation, delay = 100, options = {}) {
  const config = { transitionDelays: { weaponSwapMs: delay } };
  return simulateGw2({
    rotation,
    profession,
    config,
    ...options
  });
}

test('transition delay overlaps retained recovery and only its excess extends the next cast', () => {
  for (const [delay, expected] of [
    [0, 560],
    [100, 560],
    [300, 660]
  ]) {
    const result = simulate([{ type: 'cast', skillId: 1, interruptAfterMs: 360 }, 'Swap Weapons', 'Next cast'], delay);
    assert.deepEqual(result.warnings, []);
    assert.equal(result.steps[1].start, 360);
    assert.equal(result.steps[2].start, expected);
    assert.equal(result.steps[0].castLockoutEnd, 560);
  }
});

test('instant, concurrent, and independent inputs cannot bypass transition recovery', () => {
  for (const command of ['Instant', { type: 'cast', skillId: 3, concurrentOffsetMs: 20 }, 'Independent input']) {
    const result = simulate(['Swap Weapons', command]);
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
      const result = simulate(rotation);
      assert.equal(result.steps[2].start, Math.max(waitMs, 100));
      assert.equal(result.steps[1].start, 0);
      assert.equal(result.steps[1].end, waitMs);
      assert.deepEqual(rotation, before);
      assert.deepEqual(result.warnings, []);
    }
  }
});

test('last-transition recovery contributes to rotation completion while an absolute horizon stays fixed', () => {
  assert.equal(simulate(['Swap Weapons']).rotationEndTime, 0.1);
  assert.equal(
    simulate(['Swap Weapons'], 100, { observationPolicy: { kind: 'absolute', endTimeMs: 1000 } }).planningState
      .atSeconds,
    1
  );
});

test('invalid transitions do not emit input recovery', () => {
  const denied = defineProfession({
    id: 'denied-transition',
    name: 'Denied Transition',
    catalog,
    hooks: {
      availability: (context, skill) =>
        skill.id === 2
          ? { ready: false, retryAt: null, reason: 'Unavailable', code: 'fixture.denied' }
          : { ready: true }
    }
  });
  const result = simulate(['Swap Weapons', 'Next cast'], 100, { profession: denied });
  assert.equal(result.steps[0].invalid, true);
  assert.equal(result.steps[1].start, 0);
  assert.equal(
    result.events.some((event) => event.type === 'gw2.transition-lockout'),
    false
  );
});

const transitions = { weaponSwapMs: 900, forgeEntryMs: 110, forgeExitMs: 130, shroudEntryMs: 150, shroudExitMs: 170 };
// Migrated form owners share live execution in these transition contracts.
const simulateRuntime = ({ profession, config, rotation }) =>
  runGw2Runtime({ profession: profession.runtimeFor(config), config, rotation });

test('profession transitions use their own entry and exit settings without charging weapon-swap delay', () => {
  for (const [profession, specialization, entry, exit, simulate = simulateGw2] of [
    [engineerProfession, 'Holosmith', 'Engage Photon Forge', 'Deactivate Photon Forge', simulateRuntime],
    [guardianProfession, 'Luminary', 'Enter Radiant Forge', 'Exit Radiant Forge', simulateRuntime],
    [necromancerProfession, 'Core', 'Death Shroud', 'End Death Shroud', simulateRuntime],
    [necromancerProfession, 'Reaper', "Reaper's Shroud", "Exit Reaper's Shroud", simulateRuntime],
    [thiefProfession, 'Specter', 'Enter Shadow Shroud', 'Exit Shadow Shroud', simulateRuntime]
  ]) {
    const result = simulate({
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

// Live form owners must block input themselves; a recorded lockout event alone does not delay the next command.
test('live form entry blocks the next authored input until its recovery ends', () => {
  for (const [profession, specialization, entry, exit, kind] of [
    [guardianProfession, 'Luminary', 'Enter Radiant Forge', 'Exit Radiant Forge', 'forgeEntryMs'],
    [necromancerProfession, 'Core', 'Death Shroud', 'End Death Shroud', 'shroudEntryMs']
  ]) {
    const result = simulateRuntime({
      profession,
      rotation: [entry, exit],
      config: { specialization, transitionDelays: transitions, initialResource: 100 }
    });
    assert.deepEqual(result.warnings, [], specialization);
    const follow = result.events.find((event) => event.type === 'action' && event.name === exit);
    assert.equal(follow.at, transitions[kind] / 1000, specialization);
  }
});

test('automatic shroud depletion and forge expiry apply exit recovery at the transition timestamp', () => {
  for (const [profession, specialization, entry, waitMs, resource, simulate = simulateGw2] of [
    // Observe depletion on the first 40 ms tick at or after the 500 ms zero crossing.
    [thiefProfession, 'Specter', 'Enter Shadow Shroud', 520, { initialShadowForce: 1 }, simulateRuntime],
    [guardianProfession, 'Luminary', 'Enter Radiant Forge', 20000, {}, simulateRuntime],
    [necromancerProfession, 'Core', 'Death Shroud', 30000, { initialResource: 10 }, simulateRuntime]
  ]) {
    const result = simulate({
      profession,
      rotation: [entry, { type: 'wait', durationMs: waitMs }],
      config: { specialization, transitionDelays: transitions, ...resource }
    });
    assert.deepEqual(result.warnings, [], specialization);
    const exit = result.events.find(
      (event) => event.type === 'gw2.transition-lockout' && event.kind.endsWith('ExitMs')
    );
    assert.ok(exit, specialization);
    assert.ok(result.planningState.atSeconds >= exit.at + exit.duration - 1e-9);
  }
});

test('overheated Photon Forge applies exit recovery only at the explicit exit', () => {
  // Overheat locks Forge attacks; the later rotation command owns the bar exit and its recovery.
  const result = simulateRuntime({
    profession: engineerProfession,
    rotation: ['Engage Photon Forge', { type: 'wait', durationMs: 1000 }, 'Deactivate Photon Forge'],
    config: { specialization: 'Holosmith', transitionDelays: transitions, initialHeat: 99 }
  });
  assert.deepEqual(result.warnings, []);
  const overheat = result.events.find((event) => event.type === 'engineer.heat' && event.reason === 'overheat');
  const exitStep = result.steps.find((step) => step.skill === 'Deactivate Photon Forge');
  assert.ok(overheat.at < exitStep.start / 1000);
  const exits = result.events.filter(
    (event) => event.type === 'gw2.transition-lockout' && event.kind === 'forgeExitMs'
  );
  assert.equal(exits.length, 1);
  assert.equal(exits[0].at, exitStep.end / 1000);
  assert.equal(Math.round(exits[0].duration * 1000), transitions.forgeExitMs);
  assert.ok(result.planningState.atSeconds >= exits[0].at + exits[0].duration - 1e-9);
});

test('transition recovery is occupied timeline time without an injected Wait shape', () => {
  const result = simulate(['Swap Weapons', 'Next cast']);
  assert.equal(
    result.steps.some((step) => step.skill === 'Wait'),
    false
  );
  assert.deepEqual(timelineDeadTimeMarkers(result.steps, result.events), []);
  assert.deepEqual(timelineTransitionDelayMarkers(result.steps, result.events, result.planningState.atSeconds * 1000), [
    { start: 0, end: 100, durationMs: 100, insertionIndex: 1 }
  ]);
});

test('forced-delay markers exclude retained recovery and logged waits, and include final recovery', () => {
  const retained = simulate([{ type: 'cast', skillId: 1, interruptAfterMs: 360 }, 'Swap Weapons', 'Next cast']);
  assert.deepEqual(
    timelineTransitionDelayMarkers(retained.steps, retained.events, retained.planningState.atSeconds * 1000),
    []
  );
  const waited = simulate(['Swap Weapons', { type: 'wait', durationMs: 80 }, 'Next cast']);
  assert.deepEqual(timelineTransitionDelayMarkers(waited.steps, waited.events, waited.planningState.atSeconds * 1000), [
    { start: 80, end: 100, durationMs: 20, insertionIndex: 2 }
  ]);
  const last = simulate(['Swap Weapons']);
  assert.deepEqual(timelineTransitionDelayMarkers(last.steps, last.events, last.planningState.atSeconds * 1000), [
    { start: 0, end: 100, durationMs: 100, insertionIndex: 1 }
  ]);
});

test('automatic exit during final entry recovery extends only the overlapping deadline', () => {
  const result = simulateRuntime({
    profession: thiefProfession,
    rotation: ['Enter Shadow Shroud'],
    config: {
      specialization: 'Specter',
      initialShadowForce: 1,
      transitionDelays: { shroudEntryMs: 600, shroudExitMs: 200 }
    }
  });
  // Depletion at 520 ms adds 200 ms exit recovery, overlapping the 600 ms entry recovery.
  assert.equal(result.rotationEndTime, 0.72);
  assert.equal(result.planningState.profession.shadowShroudActive, false);
  assert.deepEqual(result.warnings, []);
});
