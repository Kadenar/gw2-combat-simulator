import { createCloneAttackScheduler } from "../mechanics/illusion-actions.js";
import { createMirageActionController } from "../mechanics/mirage-actions.js";
import { createProfessionActionController } from "../mechanics/profession-actions.js";
import { createCastController } from "./cast-controller.js";
import { createContinuumController } from "./continuum-controller.js";
import { createCooldownController } from "./cooldown-controller.js";
import { createEventFactory } from "./event-factory.js";
import { createExpectedProcTracker } from "./expected-procs.js";
import { createResourceController } from "./resource-controller.js";
import { createSchedulerState } from "./scheduler-state.js";
import { createSkillEffectController } from "./skill-effects.js";

/**
 * Thin simulation scheduler: coordinates combat state, timing, and mechanic controllers.
 * Two-phase pipeline: 1) Player actions via cast(), 2) Clone/phantasm attacks are sequenced.
 *
 * Creates a scheduler by composing state, events, and focused mechanic controllers.
 * @param {Object} config - Simulation config (specialization, stats, boons, target)
 * @param {Set} traits - Selected trait names for this build
 * @param {number} horizon - Simulation end time (seconds)
 * @param {Object} model - Scheduler model with skill lookups, data tables, helper functions
 * @returns {Object} Scheduler with: state, events[], warnings[], cast(skill), advanceTo(time), cloneDeaths
 *
 * @example
 * const scheduler = createScheduler(config, traits, 30, SCHEDULER_MODEL);
 * scheduler.cast(skillById(123)); // queue action at current time
 * scheduler.advanceTo(5); // process all pending events until 5s
 * console.log(scheduler.events); // all scheduled events up to 5s
 */
export function createScheduler(config, traits, horizon, model) {
  const {
    AMBUSH_ATTACKS,
    ARISTOCRACY_SKILLS,
    BLIND_SKILLS,
    CLONE_ATTACKS,
    CONDITION_FORMULAS,
    CONTINUUM_UNAFFECTED_COOLDOWN_IDS,
    CONTROL_SKILLS,
    EPSILON,
    INSTRUMENTS,
    PEITHA_SKILLS,
    PHANTASM_ATTACK_TIMINGS,
    PHANTASM_NAME_BY_SKILL,
    SHATTERS,
    TRAIT_DAMAGE,
    adjustedCooldown,
    allSkills,
    autoattackChainPositions,
    baseCriticalChance,
    byName,
    clamp,
    conditionName,
    flipSkillsByParent,
    getResourceDefinition,
    preservedWeaponChainRoots,
    skillAvailable,
    skillsById,
    skillsByName,
  } = model;
  const events = [];
  const warnings = [];
  const resourceDefinition = getResourceDefinition(config.specialization);
  const cloneDeaths = new Map();

  const state = createSchedulerState({
    infiniteForge: traits.has("Infinite Forge"),
  });
  const {
    ammoMaximum,
    ensureAmmo,
    refreshAmmo,
  } = createCooldownController({
    state,
    traits,
    config,
    epsilon: EPSILON,
    adjustedCooldown,
  });
  let expectedProcs = null;

  const activePrimaryWeapon = () =>
    state.activeWeaponSet === 1
      ? config.primaryWeapon
      : config.weaponSet2Primary || config.primaryWeapon;

  const queueExpectedProc = (candidate) => {
    if (candidate.at > horizon + EPSILON) return;
    expectedProcs.queue(candidate);
  };

  const {
    addEvent,
    addTraitProc,
    addCondition,
    addDamage,
  } = createEventFactory({
    events,
    horizon,
    epsilon: EPSILON,
    conditionName,
    conditionFormulas: CONDITION_FORMULAS,
    queueExpectedProc,
    activePrimaryWeapon,
    activeWeaponSet: () => state.activeWeaponSet,
  });

  const cloneAttackScheduler = createCloneAttackScheduler({
    state,
    cloneAttacks: CLONE_ATTACKS,
    epsilon: EPSILON,
    addDamage,
    addCondition,
  });

  const {
    gainResources,
    markCompounding,
    queueResources,
    setAmbushCreatedClones,
  } = createResourceController({
    state,
    traits,
    resourceDefinition,
    cloneDeaths,
    epsilon: EPSILON,
    clamp,
    activePrimaryWeapon,
    cloneAttackScheduler,
    addEvent,
    addTraitProc,
  });

  expectedProcs = createExpectedProcTracker({
    state,
    config,
    traits,
    cloneDeaths,
    epsilon: EPSILON,
    baseCriticalChance,
    activePrimaryWeapon,
    queueResources,
  });

  let restoreContinuum = () => {};

  /**
   * Advances scheduler to target time, processing all pending events in order:
   * clone attacks → expected procs → continuum expiry → Infinite Forge → resource gains.
   * Cleanup: expires instruments, flips, refreshes ammo.
   * @param {number} target - Target time to advance to
   */
  const advanceTo = (target) => {
    let guard = 0;
    while (guard++ < 100_000) {
      const pendingAt = state.profession.pendingResources[0]?.at ?? Infinity;
      const expectedProcAt = expectedProcs.nextAt();
      const continuumAt = state.profession.continuum?.expiresAt ?? Infinity;
      const cloneAttackAt = cloneAttackScheduler.nextAttackAt();
      const next = Math.min(
        pendingAt,
        expectedProcAt,
        continuumAt,
        cloneAttackAt,
        state.profession.nextForgeAt,
      );
      if (next > target + EPSILON) break;

      if (next === cloneAttackAt) {
        cloneAttackScheduler.scheduleAt(cloneAttackAt);
        continue;
      }
      if (next === expectedProcAt) {
        expectedProcs.processNext();
        continue;
      }
      if (next === continuumAt) {
        restoreContinuum(continuumAt, "split expired");
        continue;
      }
      if (next === state.profession.nextForgeAt) {
        gainResources(next, 1, activePrimaryWeapon(), "Infinite Forge");
        state.profession.nextForgeAt += 3;
        continue;
      }
      const pending = state.profession.pendingResources.shift();
      gainResources(
        pending.at,
        pending.count,
        pending.weapon,
        pending.reason,
      );
    }

    for (const [instrument, expiresAt] of state.profession.instruments) {
      if (expiresAt <= target + EPSILON) {
        state.profession.instruments.delete(instrument);
      }
    }
    for (const [name, flip] of state.profession.availableFlips) {
      if (flip.expiresAt < target - EPSILON) {
        state.profession.availableFlips.delete(name);
        if (name === "Counterspell") {
          state.profession.counterspellAvailable = false;
        }
      }
    }
    for (const [id] of state.ammo) {
      const ammoSkill = skillsById.get(id);
      if (ammoSkill) refreshAmmo(ammoSkill, target);
    }
  };

  const {
    consumeResources,
    currentResource,
    handleCrescendo,
    handleInstrument,
    handleShatter,
    triggerShatterTraits,
  } = createProfessionActionController({
    state,
    traits,
    resourceDefinition,
    cloneDeaths,
    epsilon: EPSILON,
    shatters: SHATTERS,
    instruments: INSTRUMENTS,
    warnings,
    addEvent,
    addTraitProc,
    addCondition,
    addDamage,
    activePrimaryWeapon,
    queueResources,
    byName,
    traitDamage: TRAIT_DAMAGE,
  });

  const continuum = createContinuumController({
    state,
    unaffectedCooldownIds: CONTINUUM_UNAFFECTED_COOLDOWN_IDS,
    epsilon: EPSILON,
    skillsById,
    refreshAmmo,
    consumeResources,
    triggerShatterTraits,
    addEvent,
  });
  restoreContinuum = continuum.restoreContinuum;
  const handleContinuumSplit = continuum.beginContinuumSplit;

  const {
    executeCloneAmbushes,
    executePlayerAmbush,
    grantMirageCloak,
    handleMirageShatter,
    handlePostSkill: handleMiragePostSkill,
  } = createMirageActionController({
    state,
    config,
    traits,
    ambushAttacks: AMBUSH_ATTACKS,
    cloneAttacks: CLONE_ATTACKS,
    skillsByName,
    epsilon: EPSILON,
    addEvent,
    addTraitProc,
    addCondition,
    addDamage,
    activePrimaryWeapon,
    queueResources,
    currentResource,
  });
  setAmbushCreatedClones(executeCloneAmbushes);

  const { handleGenericSkill } = createSkillEffectController({
    state,
    config,
    traits,
    resourceDefinition,
    phantasmNameBySkill: PHANTASM_NAME_BY_SKILL,
    phantasmAttackTimings: PHANTASM_ATTACK_TIMINGS,
    allSkills,
    skillsByName,
    epsilon: EPSILON,
    activePrimaryWeapon,
    currentResource,
    markCompounding,
    queueResources,
    addEvent,
    addTraitProc,
    addCondition,
    addDamage,
    traitDamage: TRAIT_DAMAGE,
  });
  /** Initializes scheduler: sets starting weapon set, initial resources, Split Second ammo. */
  const initialize = () => {
    state.profession.riddleOfSandReady = traits.has("Riddle of Sand");
    if (config.startingWeaponSet === 2 && config.weaponSet2Primary) {
      state.activeWeaponSet = 2;
      addEvent({ type: "weapon_set", at: 0, weaponSet: 2 });
    }
    const initial = clamp(
      Number(config.initialResource || 0),
      0,
      resourceDefinition.maximum,
    );
    gainResources(0, initial, config.primaryWeapon, "initial");
    const splitSecond = skillsByName.get("Split Second");
    if (splitSecond) ensureAmmo(splitSecond);
    const dodge = skillsByName.get("Dodge / Mirage Cloak");
    if (dodge) ensureAmmo(dodge);
    // Mantras are pre-channeled on the bench: arm their ammo-based flips (e.g.
    // Power Spike) from the opening with a full set of charges.
    for (const skill of allSkills) {
      if (skill.armedAtStart && skill.flipParent && ammoMaximum(skill)) {
        state.profession.availableFlips.set(skill.name, {
          availableAt: 0,
          expiresAt: Infinity,
        });
        ensureAmmo(skill);
      }
    }
  };

  const { cast } = createCastController({
    state,
    config,
    traits,
    horizon,
    warnings,
    rules: {
      ambushAttacks: AMBUSH_ATTACKS,
      aristocracySkills: ARISTOCRACY_SKILLS,
      autoattackChainPositions,
      blindSkills: BLIND_SKILLS,
      controlSkills: CONTROL_SKILLS,
      epsilon: EPSILON,
      flipSkillsByParent,
      instruments: INSTRUMENTS,
      peithaSkills: PEITHA_SKILLS,
      preservedWeaponChainRoots,
      shatters: SHATTERS,
      traitDamage: TRAIT_DAMAGE,
      adjustedCooldown,
      skillAvailable,
      skillsById,
      skillsByName,
    },
    cooldowns: {
      ammoMaximum,
      ensureAmmo,
      refreshAmmo,
    },
    actions: {
      activePrimaryWeapon,
      advanceTo,
      consumeResources,
      currentResource,
      executePlayerAmbush,
      grantMirageCloak,
      handleContinuumSplit,
      handleCrescendo,
      handleGenericSkill,
      handleInstrument,
      handleMiragePostSkill,
      handleMirageShatter,
      handleShatter,
      queueResources,
      restoreContinuum,
      addEvent,
      addDamage,
      addTraitProc,
    },
  });

  initialize();
  return {
    state,
    events,
    warnings,
    cloneDeaths,
    advanceTo,
    cast,
  };
}
