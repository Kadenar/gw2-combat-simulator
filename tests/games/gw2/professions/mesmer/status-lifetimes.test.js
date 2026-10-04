import { createExecutedFacts } from '#gw2/platform/results/executed-facts.js';
import { captureEffectEmissions } from '#tests/helpers/effect-emission.js';
import { createCooldownController } from '#gw2/platform/execution/cooldowns.js';
import { applySkillSideEffects } from '#gw2/platform/simulation/side-effects.js';
import { mesmerCoreHooks } from '#gw2/professions/mesmer/core/hooks.js';
import { projectObservedState } from '#tests/helpers/observed-runtime.js';
import { registerMesmerMechanics } from '#gw2/professions/mesmer/core/mechanics/runtime.js';
import assert from 'node:assert/strict';
import test from 'node:test';
import { mesmerProfession } from '#gw2/professions/mesmer/profession.js';
import { MESMER_SKILL_IDS as ID, MESMER_TRAIT_IDS as TRAIT } from '#gw2/professions/mesmer/data/ids.js';
import { completeMimicCast } from '#gw2/professions/mesmer/core/mechanics/mimic.js';
import { initializeMirageRuntime } from '#gw2/professions/mesmer/specializations/mirage/mechanics/runtime.js';
import { mirageAvailability } from '#gw2/professions/mesmer/specializations/mirage/mechanics/cloak-and-ambushes.js';
import { mirageHooks } from '#gw2/professions/mesmer/specializations/mirage/hooks.js';

// Real profiles and specialization initialization isolate the lifetime contracts from rotation and cast timing.
function lifetimeContext(traits = []) {
  const config = { specialization: 'Mirage', primaryWeapon: 'Sword', selectedTraitIds: traits };
  const profession = mesmerProfession.resolveProfession(config);
  const events = [];
  const gainHandlers = [];
  const context = {
    config,
    traits: new Set(config.selectedTraitIds),
    profession,
    catalog: profession.catalog,
    events,
    gainHandlers,
    start: 0,
    fullEnd: 0,
    rechargeWork: 0,
    action: {},
    state: {
      time: 0,
      activeWeaponSet: 1,
      profession: profession.createState(config),
      cooldowns: new Map(),
      rechargeProgress: new Map(),
      ammo: new Map()
    },
    hasBuff: () => false,
    tasks: { nextAt: () => Infinity },
    eventsOfType: (type) => events.filter((event) => event.type === type),
    mesmerRuntime: {
      ambushAttacks: {},
      cloneAttacks: {},
      shatterResolvedHandlers: [],
      activePrimaryWeapon: () => config.primaryWeapon,
      resourceDefinition: { singular: 'clone', plural: 'clones', maximum: 3 },
      resources: { queueResources() {}, addGainHandler: (handler) => gainHandlers.push(handler) }
    }
  };
  Object.assign(context, context.state);
  // Lifetime fixtures use the same recharge owner as execution for resets and lockout retirement.
  context.cooldownController = createCooldownController({
    state: context,
    rechargeDuration: () => 10,
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
  context.facts = createExecutedFacts(events);
  context.history = events;
  context.schedule = () => {};

  registerMesmerMechanics(context, context.mesmerRuntime);
  initializeMirageRuntime(context);
  return context;
}

function complete(context, cast) {
  context.time = cast.fullEnd;
  if (!cast.cancelled && cast.skill.id === ID.MIMIC)
    applySkillSideEffects(context, cast, 'castCommit', mesmerCoreHooks.sideEffectHandlers);
  completeMimicCast(context, cast);
}

test('Mimic accepts utility starts through its exact deadline and consumes the reset once', () => {
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
      cancelled: Boolean(context.action.cancelled),
      command: {},
      id: 'fixture',
      rechargeWork: 0,
      skill: mimic
    });
    assert.equal(core.mimicUntil, 10.301);
    context.start = start;
    context.fullEnd = start + 1;
    context.cooldownController.setReadyAt(utility.id, 99);
    context.ammo.set(utility.id, { lockoutReadyAt: 99 });
    complete(context, {
      start: context.start,
      fullEnd: context.fullEnd,
      effectiveEnd: context.action.cancelled ? context.start : context.fullEnd,
      cancelled: Boolean(context.action.cancelled),
      command: {},
      id: 'fixture',
      rechargeWork: 0,
      skill: utility
    });
    const consumed = start <= 10.301;
    assert.equal(context.cooldownController.hasCooldown(utility.id), !consumed);
    assert.equal(context.cooldownController.readAmmo(utility.id).lockoutReadyAt, consumed ? 0 : 99);
    assert.equal(context.events.filter((event) => event.source === 'Mimic').length, consumed ? 1 : 0);
    context.cooldownController.setReadyAt(utility.id, 100);
    complete(context, {
      start: context.start,
      fullEnd: context.fullEnd,
      effectiveEnd: context.action.cancelled ? context.start : context.fullEnd,
      cancelled: Boolean(context.action.cancelled),
      command: {},
      id: 'fixture',
      rechargeWork: 0,
      skill: utility
    });
    assert.equal(context.cooldownController.readyAt(utility.id), 100);
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
    cancelled: Boolean(context.action.cancelled),
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
    cancelled: Boolean(context.action.cancelled),
    command: {},
    id: 'fixture',
    rechargeWork: 0,
    skill: mimic
  });
  assert.equal(core.mimicUntil, 11.301);
  context.action.cancelled = true;
  context.fullEnd = 2.301;
  complete(context, {
    start: context.start,
    fullEnd: context.fullEnd,
    effectiveEnd: context.action.cancelled ? context.start : context.fullEnd,
    cancelled: Boolean(context.action.cancelled),
    command: {},
    id: 'fixture',
    rechargeWork: 0,
    skill: mimic
  });
  complete(context, {
    start: context.start,
    fullEnd: context.fullEnd,
    effectiveEnd: context.action.cancelled ? context.start : context.fullEnd,
    cancelled: Boolean(context.action.cancelled),
    command: {},
    id: 'fixture',
    rechargeWork: 0,
    skill: context.catalog.skillsById.get(ID.SIGNET_OF_ILLUSIONS)
  });
  assert.equal(core.mimicUntil, 11.301);
  context.action.cancelled = false;
  complete(context, {
    start: context.start,
    fullEnd: context.fullEnd,
    effectiveEnd: context.action.cancelled ? context.start : context.fullEnd,
    cancelled: Boolean(context.action.cancelled),
    command: {},
    id: 'fixture',
    rechargeWork: 0,
    skill: { id: -1, type: 'Utility', flipParentId: 1 }
  });
  assert.equal(core.mimicUntil, 11.301);
});

test('Mirror availability, palette, projection, and one-time pickup agree on exact half-open boundaries', () => {
  for (const at of [0.300999, 0.301, 8.300999, 8.301, 8.301001]) {
    const context = lifetimeContext();
    const controller = context.mesmerRuntime.mirage;
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
      start: 1,
      fullEnd: 5,
      effectiveEnd: 2,
      skill: {
        castTimeMs: 2000,
        tasks: [{ type: 'mesmer.mirage.create-mirror', timingAnchor, timingScale, atMs }]
      }
    });
    assert.deepEqual(context.profession.specialization.state.pendingMirrorAts, [expected]);
  }
});

test('Mirror retry retains pending creation and overlapping mirrors expire independently', () => {
  const context = lifetimeContext();
  const skill = context.catalog.skillsById.get(ID.PICK_UP_MIRAGE_MIRROR);
  context.profession.specialization.state.pendingMirrorAts.push(0.301);
  assert.equal(mirageAvailability(context, skill).retryAt, 0.301);
  const controller = context.mesmerRuntime.mirage;
  controller.createMirrors(0.301, 1);
  controller.createMirrors(1.301, 1);
  context.time = 8.301;
  assert.equal(mirageAvailability(context, skill).ready, true);
  assert.equal(controller.pickUpMirror(8.301, context.catalog.skillsById.get(ID.PICK_UP_MIRAGE_MIRROR)), true);
  assert.equal(controller.pickUpMirror(8.301, context.catalog.skillsById.get(ID.PICK_UP_MIRAGE_MIRROR)), false);
  controller.createMirrors(8.301, 1);
  // Replacement leaves only its own pickup window after older mirrors expire or are consumed.
  assert.deepEqual(context.profession.specialization.state.mirrors, [{ availableAt: 8.301, expiresAt: 16.301 }]);
});

test('player ambush availability and projection preserve the final live microsecond and refresh exactly', () => {
  const context = lifetimeContext();
  const controller = context.mesmerRuntime.mirage;
  const state = context.profession.specialization.state;
  const skill = context.mesmerRuntime.ambushAttacks.Sword;
  controller.grantMirageCloak(0.1 + 0.201, 'first');
  assert.equal(state.ambushUntil, 1.801);
  for (const at of [1.800999, 1.801, 1.801001]) {
    context.start = context.time = at;
    assert.equal(mirageAvailability(context, skill).ready, at < 1.801);
    assert.equal(
      Boolean(
        projectObservedState(mesmerProfession, { ...context, config: context.config, catalog: context.catalog })
          .availableAmbush
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

test('queued ambushes require a preceding cast that began before expiry and still occupies the lane', () => {
  for (const castStart of [1.800999, 1.801, 1.801001]) {
    const context = lifetimeContext();
    const skill = context.mesmerRuntime.ambushAttacks.Sword;
    context.mesmerRuntime.mirage.grantMirageCloak(0.301, 'test');
    context.events.push({ type: 'action', actorType: 'player', at: castStart, castLockoutEndsAt: 2.5 });
    context.time = 2.5;
    assert.equal(mirageAvailability(context, skill).ready, castStart < 1.801);
    context.time = 2.501;
    assert.equal(mirageAvailability(context, skill).ready, false);
  }
});

test('Infinite Horizon clone gains include exact cloak expiry but reject later gains and the unarmed sentinel', () => {
  const context = lifetimeContext([TRAIT.INFINITE_HORIZON]);
  const controller = context.mesmerRuntime.mirage;
  const state = context.profession.specialization.state;
  const ambushes = [];
  controller.executeCloneAmbushes = (at) => ambushes.push(at);
  const gain = (at) =>
    context.gainHandlers.forEach((handler) =>
      handler({ at, cause: { traitId: TRAIT.DECEPTIVE_EVASION }, createdClones: [{}] })
    );
  gain(0);
  assert.deepEqual(ambushes, []);
  controller.grantMirageCloak(0.1 + 0.201, 'test');
  assert.equal(state.cloneAmbushUntil, 1.051);
  for (const at of [1.050999, 1.051, 1.051001]) gain(at);
  assert.deepEqual(ambushes, [1.050999, 1.051]);
  controller.grantMirageCloak(1.051, 'refresh');
  assert.equal(state.cloneAmbushUntil, 1.801);
  gain(1.051001);
  assert.deepEqual(ambushes, [1.050999, 1.051, 1.051001]);
});
