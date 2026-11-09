import assert from 'node:assert/strict';
import test from 'node:test';

import { simulationEventLogRows } from '#gw2/app/results/event-log.js';
import { withPatchPreview } from '#gw2/integrations/patches/authoring/profession.js';
import { createResourceController } from '#gw2/platform/combat/resources/resource-controller.js';
import { createResourceDepletionWake } from '#gw2/platform/simulation/task-scheduler.js';
import { completeMesmerCast, startMesmerCast } from '#gw2/professions/mesmer/core/execution/cast-lifecycle.js';
import { mesmerIllusionHooks } from '#gw2/professions/mesmer/core/mechanics/illusions/lifecycle.js';
import { MESMER_SKILL_IDS as ID, MESMER_TRAIT_IDS as TRAIT } from '#gw2/professions/mesmer/data/ids.js';
import { createMesmerIllusionRewards } from '#gw2/professions/mesmer/family-resources.js';
import { mesmerProfession } from '#gw2/professions/mesmer/profession.js';
import { consumeMesmerResources, mesmerShatterLifecycle } from '#gw2/professions/mesmer/shatter-lifecycle.js';
import { PROFESSION_STATE_IDS as STATE } from '#gw2/professions/state-ids.js';
import { canonicalTime } from '#kernel/core/clock.js';
import { captureEffectEmissions } from '#tests/helpers/effect-emission.js';
import { runMesmer } from '#tests/helpers/mesmer-simulation.js';
import { projectObservedState } from '#tests/helpers/observed-runtime.js';
import { bindTriggerPoints } from '#tests/helpers/trigger-points.js';

// Exercise the real policies and reward owner without damage or cast-speed dependencies.
function fixture(specialization, initialResource) {
  const config = { specialization, initialResource, primaryWeapon: 'Sword' };
  const profession = mesmerProfession.runtimeFor(config);
  const scheduled = [];
  const cancelled = [];
  const context = {
    config,
    time: 0,
    activeWeaponSet: 1,
    traits: new Set([TRAIT.COMPOUNDING_POWER]),
    profession: profession.createState(config),
    helpers: profession.catalog,
    combat: { warn() {} },
    schedule: (type, at, data, owner) => scheduled.push({ type, at, data, owner }),
    cancelOwner: (owner) => cancelled.push(owner)
  };
  // Resource callbacks use the same compiled trait ownership as simulations.
  bindTriggerPoints(context, mesmerProfession, config);
  const capture = captureEffectEmissions({ now: () => context.time });
  context.effects = capture.effects;
  context.resourceController = createResourceController({
    clock: context,
    context: () => context,
    policies: profession.resources,
    depletion: createResourceDepletionWake(context)
  });
  context.resourceController.initialize();
  return { context, profession, scheduled, cancelled, ...capture };
}

// Ordinary completion still clears its activation without inventing a resource transaction.
test('completion without a resource declaration leaves resources and their queue unchanged', () => {
  const { context, scheduled, events } = fixture('Virtuoso', 2);
  const skill = { id: 'no-resource', name: 'No resource' };
  const cast = { id: 'ordinary-cast', start: 0, fullEnd: 1, effectiveEnd: 1, skill, command: {} };
  startMesmerCast(context, cast, skill);
  context.time = cast.fullEnd;
  completeMesmerCast(context, cast, skill);
  assert.deepEqual(scheduled, []);
  assert.equal(context.resourceController.value('blades'), 2);
  assert.equal(
    events.some((event) => event.type === 'resource'),
    false
  );
  assert.equal(context.profession.core.castDetails.has(cast.id), false);
});

// Add grants cover each resource owner; only Virtuoso's Blade Renewal declares a fill grant.
for (const [specialization, key, maximum, modes] of [
  ['Core', 'clones', 3, ['add']],
  ['Virtuoso', 'blades', 5, ['add', 'fill']],
  ['Troubadour', 'notes', 3, ['add']]
]) {
  test(`${specialization} completion queues supported grants with their declared weapon and earned rewards`, () => {
    for (const mode of modes) {
      const initial = mode === 'fill' ? 1 : 0;
      const { context, scheduled, events } = fixture(specialization, initial);
      mesmerIllusionHooks.initialize(context);
      const value = () =>
        key === 'clones' ? context.profession.core.clones.length : context.resourceController.value(key);
      const skill =
        mode === 'fill'
          ? context.helpers.skillsById.get(ID.BLADE_RENEWAL)
          : {
              id: 'direct-resource',
              name: 'Direct resource',
              weapon: 'Staff',
              resource: { mode, count: 2, timingAnchor: 'castEnd', atMs: 250 }
            };
      const cast = { id: 'direct-cast', start: 0, fullEnd: 1, effectiveEnd: 1, skill, command: {} };
      startMesmerCast(context, cast, skill);
      context.time = cast.fullEnd;
      completeMesmerCast(context, cast, skill);
      assert.equal(value(), initial);
      assert.equal(
        events.some((event) => event.reason === skill.name),
        false
      );
      const tasks = scheduled.filter((task) => task.type === 'mesmer.resource-gain');
      assert.equal(tasks.length, 1);
      const task = tasks[0];
      assert.equal(task.at, cast.fullEnd + (mode === 'add' ? 0.25 : 0));
      assert.equal(task.data.weapon, skill.weapon || context.config.primaryWeapon);
      assert.deepEqual(task.data.cause, { kind: 'skill', sourceSkillId: skill.id });
      context.time = task.at;
      mesmerIllusionHooks.tasks[task.type](context, task.data);
      const expectedValue = mode === 'fill' ? maximum : 2;
      assert.equal(value(), expectedValue);
      const reward = events.find((event) => event.reason === skill.name);
      assert.equal(reward.amount, expectedValue - initial);
      assert.equal(reward.value, expectedValue);
      assert.ok(events.some((event) => event.kind === 'compounding'));

      if (key === 'clones') {
        assert.ok(context.profession.core.clones.every((clone) => clone.weapon === task.data.weapon));
      }

      assert.equal(context.profession.core.castDetails.has(cast.id), false);
    }
  });
}

// Resource ownership follows canonical boundaries, including the last microsecond before completion.
test('cast-start resources before completion are available to concurrent actions', () => {
  const { context, scheduled } = fixture('Virtuoso', 0);
  const skill = {
    id: 'resource-boundary',
    name: 'Resource boundary',
    resource: {
      mode: 'add',
      timingAnchor: 'castStart',
      atMs: 999.999,
      count: 1
    }
  };
  const cast = { id: 'resource-cast', start: 0, fullEnd: 1, effectiveEnd: 1, skill, command: {} };
  startMesmerCast(context, cast, skill);
  assert.equal(scheduled.length, 1);
  const task = scheduled[0];
  assert.ok(task.at < cast.fullEnd);
  context.time = task.at;
  mesmerIllusionHooks.tasks[task.type](context, task.data);
  assert.equal(context.resourceController.value('blades'), 1);
  // A concurrent shatter can spend the grant, and completion must not grant it again.
  assert.equal(consumeMesmerResources(context, context.time), 1);
  context.time = cast.fullEnd;
  completeMesmerCast(context, cast, skill);
  assert.equal(scheduled.length, 1);
  assert.equal(context.resourceController.value('blades'), 0);
});

test('resource gain at completion belongs to completion rather than a second task', () => {
  const { context, scheduled } = fixture('Virtuoso', 0);
  const skill = {
    id: 'resource-boundary',
    name: 'Resource boundary',
    resource: {
      mode: 'add',
      timingAnchor: 'castStart',
      atMs: 200,
      count: 1
    }
  };
  const cast = { id: 'resource-cast', start: 0.1, fullEnd: 0.3, effectiveEnd: 0.3, skill, command: {} };
  startMesmerCast(context, cast, skill);
  assert.deepEqual(scheduled, []);
  assert.equal(context.profession.core.castDetails.get(cast.id).resourceScheduledDuringCast, false);
  context.time = cast.fullEnd;
  completeMesmerCast(context, cast, skill);
  assert.equal(scheduled.length, 1);
  // This fixture captures before the shared scheduler canonicalizes floating-point inputs.
  assert.equal(canonicalTime(scheduled[0].at), cast.fullEnd);
  assert.equal(context.resourceController.value('blades'), 0);
  mesmerIllusionHooks.tasks[scheduled[0].type](context, scheduled[0].data);
  assert.equal(context.resourceController.value('blades'), 1);
});

test('resource gain at an interrupted endpoint survives roundoff but a later gain loses its owner', () => {
  for (const effectiveEnd of [0.299999, 0.3]) {
    const { context, scheduled, cancelled } = fixture('Virtuoso', 0);
    const skill = {
      id: 'resource-boundary',
      name: 'Resource boundary',
      resource: {
        mode: 'add',
        timingAnchor: 'castStart',
        atMs: 200,
        count: 1
      }
    };
    const cast = {
      id: 'resource-cast',
      start: 0.1,
      fullEnd: 1,
      effectiveEnd,
      cancelledBeforeCommit: true,
      skill,
      command: {}
    };
    startMesmerCast(context, cast, skill);
    context.time = effectiveEnd;
    completeMesmerCast(context, cast, skill);
    assert.equal(context.profession.core.castDetails.has(cast.id), false);

    if (effectiveEnd === 0.3) {
      assert.equal(scheduled.length, 1);
      assert.equal(scheduled[0].at, effectiveEnd);
      assert.deepEqual(cancelled, []);
    } else {
      assert.deepEqual(scheduled, []);
      assert.deepEqual(cancelled, [{ id: 'resource-cast:mesmer.resource', generation: 0 }]);
    }
  }
});

for (const [specialization, key, id, maximum] of [
  ['Virtuoso', 'blades', STATE.BLADES, 5],
  ['Troubadour', 'notes', STATE.NOTES, 3]
]) {
  test(`${specialization} seeds one clock and rewards only the actual capped gain`, () => {
    const { context, profession, events, announcements } = fixture(specialization, maximum - 1);
    mesmerIllusionHooks.initialize(context);
    const clock = context.profession.specialization.state[key];
    assert.equal(clock.value, maximum - 1);
    assert.equal(clock.maximum, maximum);
    assert.equal(clock.unitsPerSecond, 0);
    assert.equal(events.filter((event) => event.reason === 'initial').length, 1);
    assert.equal(
      events.some((event) => event.kind === 'compounding'),
      false
    );
    assert.equal(announcements.length, 0);

    context.time = 1;
    createMesmerIllusionRewards(context).gainResources(1, 2, 'Sword', 'earned');
    const reward = events.find((event) => event.reason === 'earned');
    assert.equal(reward.amount, 1);
    assert.equal(reward.value, maximum);
    assert.equal(events.filter((event) => event.kind === 'compounding').length, 1);
    const count = events.length;
    createMesmerIllusionRewards(context).gainResources(1, 2, 'Sword', 'capped');
    assert.equal(events.length, count);

    // Public clocks are detached observations and preserve a genuine zero over a configured initial value.
    const projected = projectObservedState(mesmerProfession, {
      profession: context.profession,
      config: context.config,
      catalog: profession.catalog,
      time: context.time,
      activeWeaponSet: 1
    });
    assert.notEqual(projected[id], clock);
    assert.equal(Object.hasOwn(projected, 'resource'), false);
    assert.equal(Object.hasOwn(context.profession.specialization.state, 'numericResource'), false);
    context.resourceController.spend(key, maximum);
    assert.equal(projected[id].value, maximum);
    const empty = projectObservedState(mesmerProfession, {
      profession: context.profession,
      config: context.config,
      catalog: profession.catalog,
      time: context.time,
      activeWeaponSet: 1
    });
    const view = mesmerProfession.ui
      .resourceViews({ specialization, professionState: empty, catalog: profession.catalog, value: maximum })
      .find((entry) => entry.id === key);
    assert.equal(view.value, 0);
    assert.equal(view.maximum, maximum);
    context.time = 100;
    assert.equal(context.resourceController.value(key), 0);
    assert.equal(context.resourceController.readyAt(key, 1), null);
  });

  test(`${specialization} profile capacity controls seeding, palette pips, and event-log transactions`, () => {
    const profession = withPatchPreview(mesmerProfession, {
      id: 'numeric-pool-capacity',
      label: 'Numeric pool capacity',
      professions: {
        mesmer: {
          balanceProfiles: {
            [specialization === 'Virtuoso' ? TRAIT.PSYCHIC_BLADES : TRAIT.WANDERING_MINSTREL]: {
              fields: { maximumStacks: 2 }
            }
          }
        }
      }
    });
    const result = runMesmer(
      [],
      { specialization, initialResource: 9, patchId: 'numeric-pool-capacity' },
      { profession }
    );
    assert.deepEqual(result.warnings, []);
    assert.equal(result.planningState.profession[id].value, 2);
    assert.equal(result.planningState.profession[id].maximum, 2);
    const view = profession.ui
      .resourceViews({
        specialization,
        professionState: result.planningState.profession,
        catalog: profession.runtimeFor({ specialization, patchId: 'numeric-pool-capacity' }).catalog
      })
      .find((entry) => entry.id === key);
    assert.equal(view.maximum, 2);
    assert.equal(view.value, 2);
    const row = simulationEventLogRows(result, null, { profession, catalog: profession.catalog }).find(
      (entry) => entry.type === 'resource'
    );
    assert.match(row.description, /2\/2/);
  });
}

// Exercise acceptance, scheduled work, declared actions, and retirement through the mechanic's hook interface.
function shatterCast(context, id = 'song', cancelledBeforeCommit = false) {
  const skill = context.helpers.skillsById.get(ID.BLADESONG_HARMONY);
  return { id, start: 0, fullEnd: 1, effectiveEnd: 1, skill, command: {}, cancelledBeforeCommit };
}

function resolveShatter(context, cast) {
  mesmerShatterLifecycle.sideEffectHandlers['mesmer.shatter'](context, { kind: 'cast', cast, skill: cast.skill });
}

// Missing lifecycle setup or authored metadata must fail before a shatter silently loses its effects.
for (const missing of ['start hook', 'definition']) {
  test(`shatter resolution rejects a missing ${missing}`, () => {
    const { context, events, scheduled } = fixture('Virtuoso', 3);
    const cast = shatterCast(context);

    if (missing === 'definition') {
      cast.skill = { ...cast.skill, id: 'missing-shatter-definition' };
      mesmerShatterLifecycle.onCastStart(context, cast);
    }

    assert.throws(() => resolveShatter(context, cast), /Missing Mesmer shatter data/);
    assert.equal(context.resourceController.value('blades'), 3);
    assert.deepEqual(events, []);
    assert.deepEqual(scheduled, []);
  });
}

for (const first of ['task', 'action']) {
  test(`shatter ${first} commitment settles later gains once and retires its pending work`, () => {
    const { context, events, scheduled } = fixture('Virtuoso', 3);
    const cast = shatterCast(context);
    mesmerShatterLifecycle.onCastStart(context, cast);
    assert.equal(context.resourceController.value('blades'), 0);
    assert.equal(
      events.some((event) => event.amount < 0),
      false
    );
    createMesmerIllusionRewards(context).gainResources(0, 4, 'Sword', 'during cast');
    const task = scheduled.find((entry) => Object.hasOwn(mesmerShatterLifecycle.tasks, entry.type));
    assert.ok(task);
    context.time = cast.fullEnd;
    const spendTask = () => mesmerShatterLifecycle.tasks[task.type]({ ...context }, task.data);

    if (first === 'task') spendTask();
    else resolveShatter(context, cast);

    assert.equal(context.resourceController.value('blades'), 2);
    createMesmerIllusionRewards(context).gainResources(context.time, 1, 'Sword', 'after spend');
    spendTask();
    resolveShatter(context, cast);
    resolveShatter(context, cast);
    assert.equal(context.resourceController.value('blades'), 3);
    const spends = events.filter((event) => event.amount < 0);
    assert.equal(spends.length, 1);
    assert.equal(spends[0].amount, -5);
    assert.equal(spends[0].activationId, cast.id);
    assert.equal(events.filter((event) => event.type === 'marker' && event.name === cast.skill.name).length, 1);

    mesmerShatterLifecycle.onCastCommit(context, cast);
    createMesmerIllusionRewards(context).gainResources(context.time, 1, 'Sword', 'after retirement');
    const eventCount = events.length;
    spendTask();
    assert.equal(context.resourceController.value('blades'), 4);
    assert.equal(events.length, eventCount);
  });
}

test('cancelled shatters schedule no spending and refund up to capacity without rewards', () => {
  const { context, events, announcements, scheduled } = fixture('Virtuoso', 4);
  const cast = shatterCast(context, 'song', true);
  mesmerShatterLifecycle.onCastStart(context, cast);
  assert.deepEqual(scheduled, []);
  createMesmerIllusionRewards(context).gainResources(0, 3, 'Sword', 'during cast');
  const eventCount = events.length;
  const announcementCount = announcements.length;
  mesmerShatterLifecycle.onCastCancel(context, cast);
  assert.equal(context.resourceController.value('blades'), 5);
  assert.equal(events.length, eventCount);
  assert.equal(announcements.length, announcementCount);
  assert.equal(
    events.some((event) => event.amount < 0),
    false
  );

  // A retired reservation cannot refund twice.
  consumeMesmerResources(context, context.time);
  const afterSpend = events.length;
  mesmerShatterLifecycle.onCastCancel(context, cast);
  assert.equal(context.resourceController.value('blades'), 0);
  assert.equal(events.length, afterSpend);
});

test('interleaved runs keep identical shatter activation IDs independent', () => {
  const first = fixture('Virtuoso', 2);
  const second = fixture('Virtuoso', 4);
  const firstCast = shatterCast(first.context);
  const secondCast = shatterCast(second.context, 'song', true);
  mesmerShatterLifecycle.onCastStart(first.context, firstCast);
  mesmerShatterLifecycle.onCastStart(second.context, secondCast);
  first.context.time = firstCast.fullEnd;
  resolveShatter({ ...first.context }, firstCast);
  mesmerShatterLifecycle.onCastCommit(first.context, firstCast);
  mesmerShatterLifecycle.onCastCancel({ ...second.context }, secondCast);
  assert.equal(first.context.resourceController.value('blades'), 0);
  assert.equal(second.context.resourceController.value('blades'), 4);
  assert.equal(first.events.filter((event) => event.amount < 0).length, 1);
  assert.equal(
    second.events.some((event) => event.amount < 0),
    false
  );
});
