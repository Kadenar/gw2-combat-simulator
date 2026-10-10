import { bindTriggerPoints } from '#tests/helpers/trigger-points.js';
import { simulationEventLogRows } from '#gw2/app/results/event-log.js';
import { withPatchPreview } from '#gw2/integrations/patches/authoring/profession.js';
import { createRuntimeResources } from '#gw2/platform/simulation/runtime-resources.js';
import { completeMesmerCast, startMesmerCast } from '#gw2/professions/mesmer/core/execution/cast-lifecycle.js';
import { mesmerIllusionHooks } from '#gw2/professions/mesmer/core/mechanics/illusions/lifecycle.js';
import { MESMER_TRAIT_IDS as TRAIT } from '#gw2/professions/mesmer/data/ids.js';
import { createMesmerActions } from '#gw2/professions/mesmer/family-mechanics.js';
import { createMesmerIllusionRewards } from '#gw2/professions/mesmer/family-resources.js';
import { mesmerProfession } from '#gw2/professions/mesmer/profession.js';
import { captureEffectEmissions } from '#tests/helpers/effect-emission.js';
import { runMesmer } from '#tests/helpers/mesmer-simulation.js';
import assert from 'node:assert/strict';
import test from 'node:test';

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
  context.resourceController = createRuntimeResources(
    {
      get time() {
        return context.time;
      },
      mechanics: context
    },
    profession
  );
  context.resourceController.initialize();
  return { context, profession, scheduled, cancelled, ...capture };
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
  const cast = { id: 'resource-cast', start: 0, fullEnd: 1, effectiveEnd: 1, skill };
  startMesmerCast(context, cast, skill);
  assert.equal(scheduled.length, 1);
  const task = scheduled[0];
  assert.ok(task.at < cast.fullEnd);
  context.time = task.at;
  mesmerIllusionHooks.tasks[task.type](context, task.data);
  assert.equal(context.resourceController.value('blades'), 1);
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
  const cast = { id: 'resource-cast', start: 0.1, fullEnd: 0.3, effectiveEnd: 0.3, skill };
  startMesmerCast(context, cast, skill);
  assert.deepEqual(scheduled, []);
  assert.equal(context.profession.core.castDetails.get(cast.id).resourceScheduledDuringCast, false);
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
    const cast = { id: 'resource-cast', start: 0.1, fullEnd: 1, effectiveEnd, cancelled: true, skill, command: {} };
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

for (const [specialization, key, maximum] of [
  ['Virtuoso', 'blades', 5],
  ['Troubadour', 'notes', 3]
]) {
  test(`${specialization} seeds one clock and rewards only the actual capped gain`, () => {
    const { context, profession, events, announcements } = fixture(specialization, maximum - 1);
    mesmerIllusionHooks.initialize(context);
    const clock = context.profession.specialization.state[key];
    assert.equal(clock.value, maximum - 1);
    assert.equal(clock.maximum, maximum);
    assert.equal(clock.rate, 0);
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
    const projected = profession.projectPlanningState({
      profession: context.profession,
      config: context.config,
      catalog: profession.catalog,
      time: context.time,
      activeWeaponSet: 1
    });
    assert.notEqual(projected[key], clock);
    assert.equal(Object.hasOwn(projected, 'resource'), false);
    assert.equal(Object.hasOwn(context.profession.specialization.state, 'numericResource'), false);
    context.resourceController.spend(key, maximum);
    assert.equal(projected[key].value, maximum);
    const empty = profession.projectPlanningState({
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
            [`mesmer.${specialization.toLowerCase()}.resources`]: { fields: { maximumStacks: 2 } }
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
    assert.equal(result.planningState.profession[key].value, 2);
    assert.equal(result.planningState.profession[key].maximum, 2);
    const view = profession.ui
      .resourceViews({
        specialization,
        professionState: result.planningState.profession,
        catalog: profession.runtimeFor({ specialization, patchId: 'numeric-pool-capacity' }).catalog
      })
      .find((entry) => entry.id === key);
    assert.equal(view.maximum, 2);
    assert.equal(view.value, 2);
    const row = simulationEventLogRows(result, null, profession).find((entry) => entry.type === 'resource');
    assert.match(row.description, /2\/2/);
  });
}

test('blade commitment combines reservations with later gains once, retaining excess blades', () => {
  const { context, events } = fixture('Virtuoso', 3);
  const actions = createMesmerActions(context);
  const reserved = actions.reserveResources();
  assert.equal(reserved, 3);
  assert.equal(context.resourceController.value('blades'), 0);
  createMesmerIllusionRewards(context).gainResources(0, 4, 'Sword', 'during cast');
  assert.equal(actions.commitReservedResources(0, reserved, { activationId: 'song' }), 5);
  assert.equal(context.resourceController.value('blades'), 2);
  const spends = events.filter((event) => event.amount < 0);
  assert.equal(spends.length, 1);
  assert.equal(spends[0].amount, -5);
  assert.equal(spends[0].activationId, 'song');
});

test('cancelled blade reservations refund up to capacity without earning rewards or recording spend', () => {
  const { context, events, announcements } = fixture('Virtuoso', 4);
  const actions = createMesmerActions(context);
  const reserved = actions.reserveResources();
  createMesmerIllusionRewards(context).gainResources(0, 3, 'Sword', 'during cast');
  const eventCount = events.length;
  const announcementCount = announcements.length;
  actions.restoreReservedResources(reserved);
  assert.equal(context.resourceController.value('blades'), 5);
  assert.equal(events.length, eventCount);
  assert.equal(announcements.length, announcementCount);
  assert.equal(
    events.some((event) => event.amount < 0),
    false
  );
});
