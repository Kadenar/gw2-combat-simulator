import assert from 'node:assert/strict';
import test from 'node:test';
import { mesmerProfession } from '#gw2/professions/mesmer/profession.js';
import { MESMER_SKILL_IDS as ID, MESMER_TRAIT_IDS as TRAIT } from '#gw2/professions/mesmer/data/ids.js';
import { completeMimicCast } from '#gw2/professions/mesmer/core/mechanics/mimic.js';
import { projectMesmerPlanningState } from '#gw2/professions/mesmer/family-state.js';
import { initializeMirageRuntime } from '#gw2/professions/mesmer/specializations/mirage/mechanics/runtime.js';
import {
  mirageCastRules,
  mirageSchedulerHooks
} from '#gw2/professions/mesmer/specializations/mirage/mechanics/ambush-rules.js';
import { mirageUi } from '#gw2/professions/mesmer/specializations/mirage/presentation.js';

// Real profiles and specialization initialization isolate the lifetime contracts from rotation and cast timing.
function lifetimeContext(traits = []) {
  const config = { specialization: 'Mirage', primaryWeapon: 'Sword', selectedTraitIds: traits };
  const profession = mesmerProfession.resolveRuntime(config);
  const events = [];
  const gainHandlers = [];
  const context = {
    config,
    profession,
    catalog: profession.catalog,
    events,
    gainHandlers,
    start: 0,
    fullEnd: 0,
    action: {},
    state: {
      time: 0,
      activeWeaponSet: 1,
      profession: profession.createProfessionState(config),
      cooldowns: new Map(),
      ammo: new Map()
    },
    cooldownController: { reduceSkillRecharge() {} },
    hasBuff: () => false,
    tasks: { nextAt: () => Infinity },
    eventsOfType: (type) => events.filter((event) => event.type === type),
    mesmerRuntime: {
      traits: new Set(traits),
      ambushAttacks: {},
      cloneAttacks: {},
      shatterResolvedHandlers: [],
      skillsById: profession.catalog.skillsById,
      balanceProfile: (id) => profession.catalog.balanceProfilesById.get(id),
      activePrimaryWeapon: () => config.primaryWeapon,
      resourceDefinition: { singular: 'clone', plural: 'clones', maximum: 3 },
      resources: { queueResources() {}, addGainHandler: (handler) => gainHandlers.push(handler) },
      addEvent: (event) => events.push(event),
      addTraitProc() {},
      addCondition() {},
      addDamage: (skill, at) => events.push({ type: 'damage', skillId: skill.id, at })
    }
  };
  initializeMirageRuntime(context);
  return context;
}

test('Mimic accepts utility starts through its exact deadline and consumes the reset once', () => {
  for (const start of [10.300999, 10.301, 10.301001]) {
    const context = lifetimeContext();
    const core = context.state.profession.core;
    const mimic = context.catalog.skillsById.get(ID.MIMIC);
    const utility = context.catalog.skillsById.get(ID.SIGNET_OF_ILLUSIONS);
    context.fullEnd = 0.1 + 0.201;
    completeMimicCast(context, mimic);
    assert.equal(core.mimicUntil, 10.301);
    context.start = start;
    context.fullEnd = start + 1;
    context.state.cooldowns.set(utility.id, 99);
    context.state.ammo.set(utility.id, { lockoutReadyAt: 99 });
    completeMimicCast(context, utility);
    const consumed = start <= 10.301;
    assert.equal(context.state.cooldowns.has(utility.id), !consumed);
    assert.equal(context.state.ammo.get(utility.id).lockoutReadyAt, consumed ? 0 : 99);
    assert.equal(context.events.filter((event) => event.source === 'Mimic').length, consumed ? 1 : 0);
    context.state.cooldowns.set(utility.id, 100);
    completeMimicCast(context, utility);
    assert.equal(context.state.cooldowns.get(utility.id), 100);
  }
});

test('Mimic refresh replaces the deadline while cancelled casts and flips leave the charge intact', () => {
  const context = lifetimeContext();
  const core = context.state.profession.core;
  const mimic = context.catalog.skillsById.get(ID.MIMIC);
  context.fullEnd = 0.301;
  completeMimicCast(context, mimic);
  context.fullEnd = 1.301;
  completeMimicCast(context, mimic);
  assert.equal(core.mimicUntil, 11.301);
  context.action.cancelled = true;
  context.fullEnd = 2.301;
  completeMimicCast(context, mimic);
  completeMimicCast(context, context.catalog.skillsById.get(ID.SIGNET_OF_ILLUSIONS));
  assert.equal(core.mimicUntil, 11.301);
  context.action.cancelled = false;
  completeMimicCast(context, { id: -1, type: 'Utility', flipParentId: 1 });
  assert.equal(core.mimicUntil, 11.301);
});

test('Mirror availability, palette, cleanup, and one-time pickup agree on exact half-open boundaries', () => {
  for (const at of [0.300999, 0.301, 8.300999, 8.301, 8.301001]) {
    const context = lifetimeContext();
    const controller = context.mesmerRuntime.mirage;
    const state = context.state.profession.specialization.state;
    const skill = context.catalog.skillsById.get(ID.PICK_UP_MIRAGE_MIRROR);
    controller.createMirrors(0.1 + 0.201, 1, 'test');
    assert.deepEqual(state.mirrors[0], { availableAt: 0.301, expiresAt: 8.301, source: 'test' });
    context.start = context.state.time = at;
    const active = at >= 0.301 && at < 8.301;
    const availability = mirageCastRules.availability.handler(context, skill);
    assert.equal(availability.ready, active);
    if (at < 0.301) assert.equal(availability.retryAt, 0.301);
    if (at >= 8.301) assert.equal(availability.retryAt, null);
    const projected = projectMesmerPlanningState({ schedulerContext: context });
    assert.equal(projected.availableMirrors, Number(active));
    assert.equal(mirageUi.paletteSkillAvailability({ professionState: projected }, skill).available, active);
    mirageSchedulerHooks.advance.handler(context, at);
    assert.equal(state.mirrors.length, at < 8.301 ? 1 : 0);
    assert.equal(controller.pickUpMirror(at, 'pickup'), active);
    assert.equal(controller.pickUpMirror(at, 'pickup'), false);
    assert.equal(context.events.filter((event) => event.skillId === ID.MIRAGE_MIRROR_DAMAGE).length, Number(active));
  }
});

test('Mirror retry retains pending creation and overlapping mirrors expire independently', () => {
  const context = lifetimeContext();
  const skill = context.catalog.skillsById.get(ID.PICK_UP_MIRAGE_MIRROR);
  context.tasks.nextAt = () => 0.301;
  assert.equal(mirageCastRules.availability.handler(context, skill).retryAt, 0.301);
  const controller = context.mesmerRuntime.mirage;
  controller.createMirrors(0.301, 1, 'first');
  controller.createMirrors(1.301, 1, 'second');
  mirageSchedulerHooks.advance.handler(context, 8.301);
  assert.deepEqual(
    context.state.profession.specialization.state.mirrors.map((mirror) => mirror.source),
    ['second']
  );
  assert.equal(controller.pickUpMirror(8.301, 'pickup'), true);
  assert.equal(controller.pickUpMirror(8.301, 'pickup'), false);
});

test('player ambush availability and projection preserve the final live microsecond and refresh exactly', () => {
  const context = lifetimeContext();
  const controller = context.mesmerRuntime.mirage;
  const state = context.state.profession.specialization.state;
  const skill = context.mesmerRuntime.ambushAttacks.Sword;
  controller.grantMirageCloak(0.1 + 0.201, 'first');
  assert.equal(state.ambushUntil, 1.801);
  for (const at of [1.800999, 1.801, 1.801001]) {
    context.start = context.state.time = at;
    assert.equal(mirageCastRules.availability.handler(context, skill).ready, at < 1.801);
    assert.equal(Boolean(projectMesmerPlanningState({ schedulerContext: context }).availableAmbush), at < 1.801);
  }

  controller.grantMirageCloak(1.800999, 'refresh');
  assert.equal(state.ambushUntil, 3.300999);
  controller.executePlayerAmbush(skill, 2, 1.9);
  assert.equal(state.ambushUntil, 0);
  assert.equal(state.ambushSource, '');
  context.start = context.state.time = 2;
  assert.equal(mirageCastRules.availability.handler(context, skill).ready, false);
});

test('queued ambushes require a preceding cast that began before expiry and still occupies the lane', () => {
  for (const castStart of [1.800999, 1.801, 1.801001]) {
    const context = lifetimeContext();
    const skill = context.mesmerRuntime.ambushAttacks.Sword;
    context.mesmerRuntime.mirage.grantMirageCloak(0.301, 'test');
    context.events.push({ type: 'action', actorType: 'player', at: castStart, castLockoutEndsAt: 2.5 });
    context.start = 2.5;
    assert.equal(mirageCastRules.availability.handler(context, skill).ready, castStart < 1.801);
    context.start = 2.501;
    assert.equal(mirageCastRules.availability.handler(context, skill).ready, false);
  }
});

test('Infinite Horizon clone gains include exact cloak expiry but reject later gains and the unarmed sentinel', () => {
  const context = lifetimeContext([TRAIT.INFINITE_HORIZON]);
  const controller = context.mesmerRuntime.mirage;
  const state = context.state.profession.specialization.state;
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
