import assert from 'node:assert/strict';
import test from 'node:test';

import { createExecutedFacts } from '#gw2/platform/combat/history/executed-facts.js';
import { applySkillSideEffects } from '#gw2/platform/effects/action-dispatch.js';
import { createCooldownController } from '#gw2/platform/execution/cooldowns.js';
import { mesmerCoreHooks } from '#gw2/professions/mesmer/core/hooks.js';
import { completeMimicCast } from '#gw2/professions/mesmer/core/mechanics/mimic.js';
import { MESMER_SKILL_IDS as ID, MESMER_TRAIT_IDS as TRAIT } from '#gw2/professions/mesmer/data/ids.js';
import { createMesmerIllusionRewards } from '#gw2/professions/mesmer/family-resources.js';
import { mesmerProfession } from '#gw2/professions/mesmer/profession.js';
import { mirageHooks } from '#gw2/professions/mesmer/specializations/mirage/hooks.js';
import {
  createMirageMechanics,
  mesmerAmbushAttacks,
  mirageAvailability
} from '#gw2/professions/mesmer/specializations/mirage/mechanics/cloak-and-ambushes.js';
import {
  mirageInitialized,
  mirageResourcesGained
} from '#gw2/professions/mesmer/specializations/mirage/mechanics/trigger-points.js';
import { PROFESSION_STATE_IDS as STATE } from '#gw2/professions/state-ids.js';
import { canonicalTime } from '#kernel/core/clock.js';
import { captureEffectEmissions } from '#tests/helpers/effect-emission.js';
import { projectObservedState } from '#tests/helpers/observed-runtime.js';
import { bindTriggerPoints } from '#tests/helpers/trigger-points.js';

// Real profiles and specialization initialization isolate the lifetime contracts from rotation and cast timing.
function lifetimeContext(traits = [], rechargeRate = 1) {
  const config = { specialization: 'Mirage', primaryWeapon: 'Sword', selectedTraitIds: traits };
  const profession = mesmerProfession.resolveProfession(config);
  const events = [];
  const context = {
    config,
    traits: new Set(config.selectedTraitIds),
    profession,
    catalog: profession.catalog,
    events,
    start: 0,
    fullEnd: 0,
    rechargeWork: 0,
    action: {},
    state: {
      time: 0,
      activeWeaponSet: 1,
      profession: profession.createState(config)
    },
    hasBuff: () => false,
    tasks: { nextAt: () => Infinity },
    eventsOfType: (type) => events.filter((event) => event.type === type)
  };
  Object.assign(context, context.state);
  // Lifetime fixtures use the same recharge owner as execution for resets and lockout retirement.
  context.cooldownController = createCooldownController({
    clock: context,
    rechargeDuration: () => 10,
    rechargeIntervals: (_skill, start, end) => [{ start, end, rate: rechargeRate }],
    skillFor: (id) => context.catalog.skillsById.get(id)
  });
  context.helpers = context.catalog;
  context.effects = captureEffectEmissions({
    now: () => context.time,
    submit: (event) => {
      events.push(event);
      return event;
    },
    announce: (request) => {
      const event = { ...request.attribution, ...request.announcement, type: 'proc' };

      if (request.log) events.push(event);

      return event;
    }
  }).effects;
  const facts = createExecutedFacts(events);
  context.facts = facts.reader;
  context.observations = facts.writer;
  context.history = events;
  context.schedule = () => {};

  bindTriggerPoints(context, mesmerProfession, config);
  context.fireTrigger(mirageInitialized);
  return context;
}

function complete(context, cast) {
  context.time = cast.fullEnd;

  if (!cast.cancelledBeforeCommit && cast.skill.id === ID.MIMIC)
    applySkillSideEffects(context, cast, 'castCommit', mesmerCoreHooks.sideEffectHandlers);

  completeMimicCast(context, cast);
}

// Exercise creation admission through the real owner while leaving the shared scheduler outside this fixture.
function queueMirror(context, activationId, at) {
  const taskDefinition = {
    type: 'mesmer.mirage.create-mirror',
    count: 1,
    atMs: at * 1000,
    timingAnchor: 'castStart',
    timingScale: 'fixed'
  };
  const cast = {
    id: activationId,
    skill: { ...context.catalog.skillsById.get(ID.CRYSTAL_SANDS), tasks: [taskDefinition] },
    command: {},
    start: 0,
    fullEnd: 0,
    effectiveEnd: 0,
    laneEnd: 0
  };
  mirageHooks.onCastCommit(context, cast);
  return { cast, taskDefinition };
}

test('Mimic accepts utility starts through its exact deadline and consumes the reduction once', () => {
  for (const start of [10.300999, 10.301, 10.301001]) {
    const context = lifetimeContext();
    const core = context.profession.core;
    const mimic = context.catalog.skillsById.get(ID.MIMIC);
    const utility = context.catalog.skillsById.get(ID.SIGNET_OF_ILLUSIONS);
    context.fullEnd = 0.1 + 0.201;
    complete(context, {
      start: context.start,
      fullEnd: context.fullEnd,
      effectiveEnd: context.action.cancelled ? context.start : context.fullEnd,
      cancelledBeforeCommit: Boolean(context.action.cancelled),
      command: {},
      id: 'fixture',
      rechargeWork: 0,
      skill: mimic
    });
    assert.equal(core.mimic.expiresAt, 10.301);
    context.start = start;
    context.fullEnd = start + 1;
    context.cooldownController.setReadyAt(utility.id, 99);
    complete(context, {
      start: context.start,
      fullEnd: context.fullEnd,
      effectiveEnd: context.action.cancelled ? context.start : context.fullEnd,
      cancelledBeforeCommit: Boolean(context.action.cancelled),
      command: {},
      id: 'fixture',
      rechargeWork: 0,
      skill: utility
    });
    const consumed = start <= 10.301;
    assert.equal(context.cooldownController.readyAt(utility.id), consumed ? canonicalTime(start + 2) : 99);
    assert.equal(core.mimic.charges, consumed ? 0 : 1);
    assert.equal(context.events.filter((event) => event.source === 'Mimic').length, consumed ? 1 : 0);
    context.cooldownController.setReadyAt(utility.id, 100);
    complete(context, {
      start: context.start,
      fullEnd: context.fullEnd,
      effectiveEnd: context.action.cancelled ? context.start : context.fullEnd,
      cancelledBeforeCommit: Boolean(context.action.cancelled),
      command: {},
      id: 'fixture',
      rechargeWork: 0,
      skill: utility
    });
    assert.equal(context.cooldownController.readyAt(utility.id), 100);
  }
});

// Transfer original recharge once, preserving elapsed work and applying the owner's recharge rate to both skills.
test('Mimic gives one second of base recharge and adds the original utility recharge to its remaining cooldown', () => {
  for (const rate of [1, 1.25, 1.5]) {
    const context = lifetimeContext([], rate);
    const mimic = context.catalog.skillsById.get(ID.MIMIC);
    const utility = { ...context.catalog.skillsById.get(ID.SIGNET_OF_ILLUSIONS), cooldown: 30 };
    assert.equal(mimic.cooldown, 20);
    context.cooldownController.startRecharge(mimic, 1, mimic.cooldown);
    const originalReadyAt = context.cooldownController.readyAt(mimic.id);
    complete(context, { skill: mimic, start: 0, fullEnd: 1 });

    // The accepted utility may have adjusted recharge; Mimic inherits its original authored value.
    context.cooldownController.startRecharge(utility, 5, 7);
    complete(context, { skill: utility, start: 4, fullEnd: 5, rechargeWork: 7 });
    assert.deepEqual(context.cooldownController.rechargeFor(utility.id), { workAnchorAt: 5, work: 1 });
    assert.equal(context.cooldownController.readyAt(utility.id), canonicalTime(5 + 1 / rate));
    assert.deepEqual(context.cooldownController.rechargeFor(mimic.id), {
      workAnchorAt: 5,
      work: 20 - 4 * rate + 30
    });
    assert.ok(Math.abs(context.cooldownController.readyAt(mimic.id) - originalReadyAt - 30 / rate) < 0.000002);

    const extendedReadyAt = context.cooldownController.readyAt(mimic.id);
    complete(context, { skill: utility, start: 6, fullEnd: 7 });
    assert.equal(context.cooldownController.readyAt(mimic.id), extendedReadyAt);
  }
});

test('Mimic refresh replaces the deadline while cancelled casts and flips leave the charge intact', () => {
  const context = lifetimeContext();
  const core = context.profession.core;
  const mimic = context.catalog.skillsById.get(ID.MIMIC);
  context.fullEnd = 0.301;
  complete(context, {
    start: context.start,
    fullEnd: context.fullEnd,
    effectiveEnd: context.action.cancelled ? context.start : context.fullEnd,
    cancelledBeforeCommit: Boolean(context.action.cancelled),
    command: {},
    id: 'fixture',
    rechargeWork: 0,
    skill: mimic
  });
  context.fullEnd = 1.301;
  complete(context, {
    start: context.start,
    fullEnd: context.fullEnd,
    effectiveEnd: context.action.cancelled ? context.start : context.fullEnd,
    cancelledBeforeCommit: Boolean(context.action.cancelled),
    command: {},
    id: 'fixture',
    rechargeWork: 0,
    skill: mimic
  });
  assert.equal(core.mimic.expiresAt, 11.301);
  context.action.cancelled = true;
  context.fullEnd = 2.301;
  complete(context, {
    start: context.start,
    fullEnd: context.fullEnd,
    effectiveEnd: context.action.cancelled ? context.start : context.fullEnd,
    cancelledBeforeCommit: Boolean(context.action.cancelled),
    command: {},
    id: 'fixture',
    rechargeWork: 0,
    skill: mimic
  });
  complete(context, {
    start: context.start,
    fullEnd: context.fullEnd,
    effectiveEnd: context.action.cancelled ? context.start : context.fullEnd,
    cancelledBeforeCommit: Boolean(context.action.cancelled),
    command: {},
    id: 'fixture',
    rechargeWork: 0,
    skill: context.catalog.skillsById.get(ID.SIGNET_OF_ILLUSIONS)
  });
  assert.equal(core.mimic.expiresAt, 11.301);
  context.action.cancelled = false;
  complete(context, {
    start: context.start,
    fullEnd: context.fullEnd,
    effectiveEnd: context.action.cancelled ? context.start : context.fullEnd,
    cancelledBeforeCommit: Boolean(context.action.cancelled),
    command: {},
    id: 'fixture',
    rechargeWork: 0,
    skill: { id: -1, type: 'Utility', flipParentId: 1 }
  });
  assert.equal(core.mimic.expiresAt, 11.301);
});

// Shortening availability must leave independently recharging ammunition spent.
test('Mimic does not restore ammunition or restart its count recharge', () => {
  const context = lifetimeContext();
  const mimic = context.catalog.skillsById.get(ID.MIMIC);
  const utility = { ...context.catalog.skillsById.get(ID.SIGNET_OF_ILLUSIONS), ammo: 2 };
  complete(context, { skill: mimic, start: 0, fullEnd: 1, command: {}, id: 'mimic' });
  context.cooldownController.spendAmmo(utility, 2, 100);
  context.cooldownController.setAmmoLockout(utility, 99, 2);
  complete(context, { skill: utility, start: 2, fullEnd: 3, command: {}, id: 'utility' });
  context.cooldownController.ensureAmmo(utility);
  const ammo = context.cooldownController.readAmmo(utility.id);
  assert.equal(ammo.charges, 1);
  assert.equal(ammo.recharges.length, 1);
  assert.deepEqual(ammo.recharges, [{ workAnchorAt: 2, work: 100 }]);
});

// Completion consumes the currently armed window, even if it was replaced after the utility started.
test('Mimic rearming during overlapping utilities rewards the first successful completion only', () => {
  const context = lifetimeContext();
  const mimic = context.catalog.skillsById.get(ID.MIMIC);
  const utility = context.catalog.skillsById.get(ID.SIGNET_OF_ILLUSIONS);
  const cast = (skill, start, fullEnd, cancelledBeforeCommit = false) => ({
    skill,
    start,
    fullEnd,
    cancelledBeforeCommit,
    command: {},
    id: String(fullEnd),
    rechargeWork: 0
  });
  complete(context, cast(mimic, 0, 1));
  complete(context, cast(mimic, 3, 4));
  context.cooldownController.setReadyAt(utility.id, 99);
  complete(context, cast(utility, 2, 5, true));
  assert.equal(context.cooldownController.readyAt(utility.id), 99);
  complete(context, cast(utility, 2, 15));
  assert.equal(context.cooldownController.readyAt(utility.id), 16);
  context.cooldownController.setReadyAt(utility.id, 99);
  complete(context, cast(utility, 3, 16));
  assert.equal(context.cooldownController.readyAt(utility.id), 99);
  assert.equal(context.events.filter((event) => event.source === 'Mimic').length, 1);
});

test('Mirror availability, palette, projection, and one-time pickup agree on exact half-open boundaries', () => {
  for (const at of [0.300999, 0.301, 8.300999, 8.301, 8.301001]) {
    const context = lifetimeContext();
    const controller = createMirageMechanics(context);
    const state = context.profession.specialization.state;
    const skill = context.catalog.skillsById.get(ID.PICK_UP_MIRAGE_MIRROR);
    controller.createMirrors(0.1 + 0.201, 1);
    assert.deepEqual(state.mirrors[0], { availableAt: 0.301, expiresAt: 8.301 });
    context.start = context.time = at;
    const active = at >= 0.301 && at < 8.301;
    const availability = mirageAvailability(context, skill);
    assert.equal(availability.ready, active);

    if (at < 0.301) assert.equal(availability.retryAt, 0.301);

    if (at >= 8.301) assert.equal(availability.retryAt, null);

    context.time = at;
    assert.equal(state.mirrors.length, 1, 'Availability does not purge the live owner');
    assert.equal(controller.pickUpMirror(at, context.catalog.skillsById.get(ID.PICK_UP_MIRAGE_MIRROR)), active);
    assert.equal(controller.pickUpMirror(at, context.catalog.skillsById.get(ID.PICK_UP_MIRAGE_MIRROR)), false);
    assert.equal(
      context.events.filter((event) => event.type === 'damage' && event.skillId === ID.MIRAGE_MIRROR_DAMAGE).length,
      Number(active)
    );
  }
});

// Readiness must describe the queued task even when its anchor, scale, or already-past offset changes.
test('pending mirrors use task anchors, cast scaling, and the live-clock clamp', () => {
  for (const [timingAnchor, timingScale, atMs, expected] of [
    ['castStart', 'fixed', 2000, 3],
    ['castEnd', 'fixed', 1000, 6],
    ['castCommit', 'fixed', 1000, 3],
    ['castStart', 'cast', 1000, 3],
    ['castCommit', 'cast', 1000, 4],
    ['castStart', 'fixed', 0, 2],
    [undefined, undefined, undefined, 5]
  ]) {
    const context = lifetimeContext();
    context.time = 2;
    mirageHooks.onCastCommit(context, {
      id: 'mirror-cast',
      start: 1,
      fullEnd: 5,
      effectiveEnd: 2,
      skill: {
        castTimeMs: 2000,
        tasks: [{ type: 'mesmer.mirage.create-mirror', timingAnchor, timingScale, atMs }]
      }
    });
    assert.deepEqual(context.profession.specialization.state.pendingMirrors, [
      { activationId: 'mirror-cast', at: expected }
    ]);
  }
});

test('Mirror retry retains pending creation and overlapping mirrors expire independently', () => {
  const context = lifetimeContext();
  const skill = context.catalog.skillsById.get(ID.PICK_UP_MIRAGE_MIRROR);
  const pending = queueMirror(context, 'mirror-cast', 0.301);
  assert.equal(mirageAvailability(context, skill).retryAt, 0.301);
  const controller = createMirageMechanics(context);
  context.time = 0.301;
  mirageHooks.tasks['mesmer.mirage.create-mirror'](context, pending);
  controller.createMirrors(1.301, 1);
  context.time = 8.301;
  assert.equal(mirageAvailability(context, skill).ready, true);
  assert.equal(controller.pickUpMirror(8.301, context.catalog.skillsById.get(ID.PICK_UP_MIRAGE_MIRROR)), true);
  assert.equal(controller.pickUpMirror(8.301, context.catalog.skillsById.get(ID.PICK_UP_MIRAGE_MIRROR)), false);
  controller.createMirrors(8.301, 1);
  // Replacement leaves only its own pickup window after older mirrors expire or are consumed.
  assert.deepEqual(context.profession.specialization.state.mirrors, [{ availableAt: 8.301, expiresAt: 16.301 }]);
});

// Same-time work must consume only its own activation, and replaying a retired task cannot create another mirror.
test('mirror creation consumes its own pending activation and pickup cannot reuse a consumed mirror', () => {
  const context = lifetimeContext();
  const first = queueMirror(context, 'first', 1);
  const second = queueMirror(context, 'second', 1);
  context.time = 1;
  const create = mirageHooks.tasks['mesmer.mirage.create-mirror'];
  const controller = createMirageMechanics(context);
  const pickup = context.catalog.skillsById.get(ID.PICK_UP_MIRAGE_MIRROR);
  create(context, first);
  assert.deepEqual(context.profession.specialization.state.pendingMirrors, [{ activationId: 'second', at: 1 }]);
  assert.equal(controller.pickUpMirror(1, pickup), true);
  assert.equal(controller.pickUpMirror(1, pickup), false);
  create(context, first);
  assert.equal(controller.pickUpMirror(1, pickup), false);
  create(context, second);
  assert.deepEqual(context.profession.specialization.state.pendingMirrors, []);
  assert.equal(controller.pickUpMirror(1, pickup), true);
});

// Retiring one admission must preserve unrelated pending work and prevent its own stale task from granting a mirror.
test('cancelled mirror admissions cannot supply retry readiness or create mirrors', () => {
  const context = lifetimeContext();
  const first = queueMirror(context, 'cancelled', 1);
  queueMirror(context, 'surviving', 2);
  mirageHooks.onCastCancel(context, first.cast);
  const pickup = context.catalog.skillsById.get(ID.PICK_UP_MIRAGE_MIRROR);
  assert.equal(mirageAvailability(context, pickup).retryAt, 2);
  context.time = 1;
  mirageHooks.tasks['mesmer.mirage.create-mirror'](context, first);
  assert.deepEqual(context.profession.specialization.state.mirrors, []);
  assert.equal(mirageAvailability(context, pickup).retryAt, 2);
});

test('player ambush availability and projection preserve the final live microsecond and refresh exactly', () => {
  const context = lifetimeContext();
  const controller = createMirageMechanics(context);
  const state = context.profession.specialization.state;
  const skill = mesmerAmbushAttacks(context).Sword;
  controller.grantMirageCloak(0.1 + 0.201, 'first');
  assert.equal(state.ambushUntil, 1.801);
  for (const at of [1.800999, 1.801, 1.801001]) {
    context.start = context.time = at;
    assert.equal(mirageAvailability(context, skill).ready, at < 1.801);
    assert.equal(
      Boolean(
        projectObservedState(mesmerProfession, { ...context, config: context.config, catalog: context.catalog })[
          STATE.AVAILABLE_AMBUSH
        ]
      ),
      at < 1.801
    );
  }

  controller.grantMirageCloak(1.800999, 'refresh');
  assert.equal(state.ambushUntil, 3.300999);
  controller.acceptPlayerAmbush(skill, 2, 1.9);
  assert.equal(state.ambushUntil, 0);
  assert.equal(state.ambushSource, '');
  context.start = context.time = 2;
  assert.equal(mirageAvailability(context, skill).ready, false);
});

test('queued ambush admission uses accepted cast occupancy without consulting action history', () => {
  for (const castStart of [1.800999, 1.801, 1.801001]) {
    const context = lifetimeContext();
    const skill = mesmerAmbushAttacks(context).Sword;
    createMirageMechanics(context).grantMirageCloak(0.301, 'test');
    context.time = castStart;
    mirageHooks.onCastStart(context, {
      id: 'preceding',
      skill: context.catalog.skillsById.get(ID.CRYSTAL_SANDS),
      command: {},
      start: castStart,
      fullEnd: 2.5,
      effectiveEnd: 2.5,
      laneEnd: 2.5
    });
    context.facts = { read: () => assert.fail('Mirage admission must use its accepted state.') };
    context.time = 2.5;
    assert.equal(mirageAvailability(context, skill).ready, castStart < 1.801);
    context.time = 2.501;
    assert.equal(mirageAvailability(context, skill).ready, false);
  }
});

// Cloak may arrive after a cast starts; its entitlement still ends with that accepted occupancy.
test('cloak granted during an accepted cast preserves ambush admission without extending idle time', () => {
  const context = lifetimeContext();
  mirageHooks.onCastStart(context, {
    id: 'preceding',
    skill: context.catalog.skillsById.get(ID.CRYSTAL_SANDS),
    command: {},
    start: 0,
    fullEnd: 3,
    effectiveEnd: 3,
    laneEnd: 3
  });
  context.time = 1;
  createMirageMechanics(context).grantMirageCloak(1, 'test');
  const ambush = mesmerAmbushAttacks(context).Sword;
  context.time = 3;
  assert.equal(mirageAvailability(context, ambush).ready, true);
  context.time = 3.1;
  assert.equal(mirageAvailability(context, ambush).ready, false);
});

test('Infinite Horizon clone gains include exact cloak expiry but reject later gains and the unarmed sentinel', () => {
  const context = lifetimeContext([TRAIT.INFINITE_HORIZON]);
  const controller = createMirageMechanics(context);
  const state = context.profession.specialization.state;
  const ambushes = () => context.events.filter((event) => event.type === 'damage' && event.metadata?.cloneId === 1);
  const gain = (at) =>
    context.fireTrigger(mirageResourcesGained, {
      gain: {
        at,
        cause: { traitId: TRAIT.DECEPTIVE_EVASION },
        createdClones: [{ id: 1, weapon: 'Sword', createdAt: 0, attackSequenceIndex: 0 }]
      }
    });
  gain(0);
  assert.equal(ambushes().length, 0);
  controller.grantMirageCloak(0.1 + 0.201, 'test');
  assert.equal(state.cloneAmbushUntil, 1.051);
  gain(1.050999);
  const first = ambushes().length;
  assert.ok(first > 0);
  gain(1.051);
  assert.equal(ambushes().length, 2 * first);
  gain(1.051001);
  assert.equal(ambushes().length, 2 * first);
  controller.grantMirageCloak(1.051, 'refresh');
  assert.equal(state.cloneAmbushUntil, 1.801);
  gain(1.051001);
  assert.equal(ambushes().length, 3 * first);
});

// Committed gains invoke the injected reaction once and ambush only the clones created by that transaction.
test('Infinite Horizon reacts once per qualifying resource transaction across controller rebinding', () => {
  for (const cause of [
    { traitId: TRAIT.DECEPTIVE_EVASION },
    { traitId: TRAIT.SELF_DECEPTION, sourceSkillId: ID.ILLUSIONARY_AMBUSH }
  ]) {
    const context = lifetimeContext([TRAIT.INFINITE_HORIZON]);
    createMirageMechanics(context).grantMirageCloak(1, 'test');
    const procs = () =>
      context.events.filter((event) => event.type === 'proc' && event.sourceId === TRAIT.INFINITE_HORIZON);
    const ambushCloneIds = () =>
      new Set(context.events.filter((event) => event.type === 'damage').map((event) => event.metadata?.cloneId));
    const firstClonePackets = () =>
      context.events.filter((event) => event.type === 'damage' && event.metadata?.cloneId === 1);

    createMesmerIllusionRewards(context).gainResources(1.1, 1, 'Sword', 'test', cause);
    assert.equal(procs().length, 1);
    assert.deepEqual(ambushCloneIds(), new Set([1]));
    const firstAmbush = firstClonePackets();
    createMesmerIllusionRewards({ ...context }).gainResources(1.2, 1, 'Sword', 'test', cause);
    assert.equal(procs().length, 2);
    assert.deepEqual(ambushCloneIds(), new Set([1, 2]));
    assert.deepEqual(firstClonePackets(), firstAmbush);

    createMesmerIllusionRewards(context).gainResources(1.3, 1, 'Sword', 'unrelated gain', {
      sourceSkillId: ID.ILLUSIONARY_AMBUSH
    });
    assert.equal(context.profession.core.clones.length, 3);
    assert.equal(procs().length, 2);
    assert.deepEqual(ambushCloneIds(), new Set([1, 2]));
  }
});
