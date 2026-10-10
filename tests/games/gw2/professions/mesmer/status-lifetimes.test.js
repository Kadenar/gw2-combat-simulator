import { createExecutedFacts } from '#gw2/platform/combat/history/executed-facts.js';
import { applySkillSideEffects } from '#gw2/platform/effects/action-dispatch.js';
import { createCooldownController } from '#gw2/platform/execution/cooldowns.js';
import { mesmerCoreHooks } from '#gw2/professions/mesmer/core/hooks.js';
import { completeMimicCast } from '#gw2/professions/mesmer/core/mechanics/mimic.js';
import { MESMER_SKILL_IDS as ID, MESMER_TRAIT_IDS as TRAIT } from '#gw2/professions/mesmer/data/ids.js';
import { createMesmerIllusionRewards } from '#gw2/professions/mesmer/family-resources.js';
import { mesmerProfession } from '#gw2/professions/mesmer/profession.js';
import { mirageHooks } from '#gw2/professions/mesmer/specializations/mirage/hooks.js';
import { mirageAvailability } from '#gw2/professions/mesmer/specializations/mirage/mechanics/cloak-and-ambushes.js';
import {
  createMirageMechanics,
  mesmerAmbushAttacks
} from '#gw2/professions/mesmer/specializations/mirage/mechanics/runtime.js';
import {
  mirageInitialized,
  mirageResourcesGained
} from '#gw2/professions/mesmer/specializations/mirage/mechanics/trait-boundaries.js';
import { bindTriggerPoints } from '#tests/helpers/trigger-points.js';
import { captureEffectEmissions } from '#tests/helpers/effect-emission.js';
import { projectObservedState } from '#tests/helpers/observed-runtime.js';
import assert from 'node:assert/strict';
import test from 'node:test';

// Real profiles and specialization initialization isolate the lifetime contracts from rotation and cast timing.
function lifetimeContext(traits = []) {
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
  context.fireTrigger(mirageInitialized, {});
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
    assert.equal(core.mimic.expiresAt, 10.301);
    context.start = start;
    context.fullEnd = start + 1;
    context.cooldownController.setReadyAt(utility.id, 99);
    context.cooldownController.ensureAmmo({ ...utility, ammo: 1 });
    context.cooldownController.setAmmoLockout({ ...utility, ammo: 1 }, 99, 0);
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
    assert.equal(core.mimic.charges, consumed ? 0 : 1);
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
  assert.equal(core.mimic.expiresAt, 11.301);
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
  assert.equal(core.mimic.expiresAt, 11.301);
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
  assert.equal(core.mimic.expiresAt, 11.301);
});

// Resetting the skill's deadline clears its lockout but leaves independently recharging ammunition spent.
test('Mimic resets cooldown and lockout without restoring ammunition', () => {
  const context = lifetimeContext();
  const mimic = context.catalog.skillsById.get(ID.MIMIC);
  const utility = { ...context.catalog.skillsById.get(ID.SIGNET_OF_ILLUSIONS), ammo: 2 };
  complete(context, { skill: mimic, start: 0, fullEnd: 1, command: {}, id: 'mimic' });
  context.cooldownController.spendAmmo(utility, 2, 100);
  context.cooldownController.setAmmoLockout(utility, 99, 2);
  complete(context, { skill: utility, start: 2, fullEnd: 3, command: {}, id: 'utility' });
  const ammo = context.cooldownController.ensureAmmo(utility);
  assert.equal(ammo.charges, 1);
  assert.equal(ammo.recharges.length, 1);
  assert.equal(ammo.lockoutReadyAt, 0);
  assert.equal(context.cooldownController.hasCooldown(utility.id), false);
});

// Completion consumes the currently armed window, even if it was replaced after the utility started.
test('Mimic rearming during overlapping utilities rewards the first successful completion only', () => {
  const context = lifetimeContext();
  const mimic = context.catalog.skillsById.get(ID.MIMIC);
  const utility = context.catalog.skillsById.get(ID.SIGNET_OF_ILLUSIONS);
  const cast = (skill, start, fullEnd, cancelled = false) => ({
    skill,
    start,
    fullEnd,
    cancelled,
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
  assert.equal(context.cooldownController.hasCooldown(utility.id), false);
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
  const controller = createMirageMechanics(context);
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
    const skill = mesmerAmbushAttacks(context).Sword;
    createMirageMechanics(context).grantMirageCloak(0.301, 'test');
    context.events.push({ type: 'action', actorType: 'player', at: castStart, castLockoutEndsAt: 2.5 });
    context.time = 2.5;
    assert.equal(mirageAvailability(context, skill).ready, castStart < 1.801);
    context.time = 2.501;
    assert.equal(mirageAvailability(context, skill).ready, false);
  }
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
        createdClones: [{ id: 1, weapon: 'Sword', createdAt: 0 }]
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
