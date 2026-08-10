import {
  flattenProfessionState,
  professionCoreState,
} from "../../../platform/engine/profession.js";
/**
 * @fileoverview Owns the Core Mesmer scheduler integration boundary. It assembles
 * specialization controllers, normalizes build/runtime data, coordinates cast
 * lifecycle state, dispatches typed tasks, and exposes cast-rule modifiers to
 * the shared profession engine.
 */

import { EPSILON } from "../../../platform/engine/clock.js";
import {
  gw2EffectiveCooldown,
  gw2RechargeRate,
} from "../../../platform/gw2/runtime-rules.js";
import { isGw2PlayerActorEvent } from "../../../platform/gw2/event-ownership.js";
import { clamp } from "../../../platform/gw2/numeric.js";
import {
  MESMER_CORE_AMBUSH_ATTACKS,
  MESMER_CORE_ARISTOCRACY_SKILLS,
  MESMER_CORE_BLIND_SKILLS,
  MESMER_CORE_CLONE_ATTACKS,
  MESMER_CORE_CONTROL_SKILLS,
  MESMER_CORE_INSTRUMENTS,
  MESMER_CORE_PEITHA_SKILLS,
  MESMER_CORE_PHANTASM_ATTACK_TIMINGS,
  MESMER_CORE_SHATTERS,
  MESMER_CORE_TRAIT_DAMAGE,
  MESMER_CORE_WEAPON_STRENGTH,
} from "./mechanics.js";
import {
  MESMER_SKILL_IDS as ID,
  MESMER_TRAIT_IDS as TRAIT,
} from "../data/ids.js";
import { createCloneAttackScheduler } from "./clone-attacks.js";
import { createProfessionActionController } from "./profession-actions.js";
import { createExpectedProcTracker } from "./expected-procs.js";
import { createMesmerEventMaterializer } from "./event-materializer.js";
import { createResourceController } from "./resources.js";
import { createSkillEffectController } from "./skill-effects.js";
import { mesmerResourceDefinition } from "./state.js";
import { MESMER_FLIP_CHILD_BY_PARENT_ID, mesmerRuntimeFor } from "./runtime.js";
import { mesmerAvailability } from "./availability.js";
import type {
  CatalogEntity,
  SimulationEvent,
  SimulationEventInput,
  SkillId,
} from "../../../platform/engine/types.js";
import type {
  MesmerActiveEmission,
  MesmerAvailableFlip,
  MesmerCastContext,
  MesmerCastDetails,
  MesmerCatalog,
  MesmerClone,
  MesmerEndState,
  MesmerExpectedProcCandidate,
  MesmerMaximumAmmoContext,
  MesmerPendingResource,
  MesmerPrecastContext,
  MesmerProfessionState,
  MesmerProjectedFlip,
  MesmerRechargeContext,
  MesmerRuntime,
  MesmerSchedulerContext,
  MesmerSchedulerTask,
  MesmerSelectedSkill,
  MesmerSkill,
} from "../types.js";

/**
 * Namespaced task types scheduled by Mesmer runtime controllers.
 */
const TASK = Object.freeze({
  cloneAttack: "mesmer.clone-attack",
  resourceGain: "mesmer.resource-gain",
  expectedProc: "mesmer.expected-proc",
  bladeSpend: "mesmer.blade-spend",
  continuumExpire: "mesmer.continuum-expire",
  infiniteForge: "mesmer.infinite-forge",
  signetEtherRelock: "mesmer.signet-ether-relock",
  signetIllusionsPassive: "mesmer.signet-illusions-passive",
});

// Peitha checks its ICD when the movement/deception activates, while the
// projectile impact varies with the ending distance from the target. These
// benchmark delays are characterized from the supplied EVTC.
const PEITHA_PROJECTILE_DELAYS: Readonly<Record<number, number>> =
  Object.freeze({
    [ID.CRYSTAL_SANDS]: 0.241,
    [ID.JAUNT]: 0.241,
    [ID.AXES_OF_SYMMETRY]: 0.519,
    [ID.PHASE_RETREAT]: 0.856,
  });
const PRESERVED_WEAPON_CHAIN_ROOT_IDS = new Set<number>([ID.ETHER_BOLT]);
// Delay before Signet of the Ether's in-game bug re-applies its own cooldown
// after the cast finishes.
const SIGNET_ETHER_RELOCK_DELAY = 0.3;
const SIGNET_ILLUSIONS_INTERVAL = 10;
const SIGNET_ILLUSIONS_OWNER = "mesmer.signet-illusions-passive";
const TROUBADOUR_TALE_IDS = new Set<number>([
  ID.TALE_OF_THE_HONORABLE_ROGUE,
  ID.TALE_OF_THE_SECOND_SCION,
  ID.TALE_OF_THE_SOULKEEPER,
  ID.TALE_OF_THE_AUGUST_QUEEN,
  ID.TALE_OF_THE_TORTURED_MASTERMIND,
  ID.TALE_OF_THE_VALIANT_MARSHAL,
]);
/**
 * Builds a mixed trait set containing both numeric IDs and names so
 * ID-oriented scheduler code and name-oriented data tables share one lookup.
 *
 * @param {object} config Mesmer build configuration.
 * @param {object} catalog Mesmer catalog containing normalized traits.
 * @returns {Set<number|string>} Selected traits indexed by both identity forms.
 */
function traitSet(
  config: MesmerSchedulerContext["config"],
  catalog: MesmerCatalog,
): Set<number> {
  const configured = new Set<MesmerSelectedSkill>([
    ...(config.selectedTraits || []),
    ...(config.selectedTraitIds || []).map(Number),
    ...(config.traitIds || []).map(Number),
  ]);
  const byId = new Map<number, CatalogEntity>();
  const byName = new Map<string, CatalogEntity>();
  for (const trait of catalog.traits || []) {
    byId.set(Number(trait.id), trait);
    byName.set(trait.name, trait);
  }
  const values = new Set<number>();
  for (const value of configured) {
    const trait =
      (typeof value === "string" ? byName.get(value) : undefined) ||
      byId.get(Number(value));
    if (trait) values.add(Number(trait.id));
  }
  return values;
}

/**
 * Normalizes array- and slot-object-shaped selected skill configuration.
 *
 * @param {object} config Mesmer build configuration.
 * @returns {Array<unknown>} Selected skill values.
 */
function selectedSkillValues(
  config: MesmerSchedulerContext["config"],
): MesmerSelectedSkill[] {
  const selected = config.selectedSkills || [];
  return Array.isArray(selected) ? selected : Object.values(selected);
}

/**
 * Resolves Signet of Illusions when it is present in the configured utility
 * loadout.
 *
 * @param {object} context Scheduler context.
 * @returns {object|null} Catalog skill when equipped, otherwise null.
 */
function equippedSignetOfIllusions(
  context: MesmerSchedulerContext,
): MesmerSkill | null {
  const skill = context.catalog.skillsById.get(ID.SIGNET_OF_ILLUSIONS);
  if (!skill) return null;
  const equipped = selectedSkillValues(context.config).some(
    (candidate) =>
      candidate === skill.name ||
      Number(candidate) === skill.id ||
      (typeof candidate === "object" &&
        candidate !== null &&
        (candidate.name === skill.name || Number(candidate.id) === skill.id)),
  );
  return equipped ? skill : null;
}

/**
 * Replaces any pending Signet of Illusions passive task with one at the
 * requested timestamp.
 *
 * @param {object} context Scheduler context.
 * @param {number} at Requested task timestamp.
 * @returns {void}
 */
function scheduleSignetIllusionsPassive(
  context: MesmerSchedulerContext,
  at: number,
): void {
  if (!equippedSignetOfIllusions(context)) return;
  context.tasks.cancelOwner(SIGNET_ILLUSIONS_OWNER);
  context.tasks.schedule({
    type: TASK.signetIllusionsPassive,
    at: Math.max(context.state.time, Number(at)),
    priority: -20,
    ownerId: SIGNET_ILLUSIONS_OWNER,
    payload: {},
  });
}

/**
 * Restarts Signet of Illusions' passive interval after both the supplied time
 * and the signet's current cooldown.
 *
 * @param {object} context Scheduler context.
 * @param {number} activeAt Earliest time the passive may resume.
 * @returns {void}
 */
function restartSignetIllusionsPassive(
  context: MesmerSchedulerContext,
  activeAt: number,
): void {
  const skill = equippedSignetOfIllusions(context);
  if (!skill) return;
  const readyAt = Number(context.state.cooldowns.get(skill.id) || 0);
  scheduleSignetIllusionsPassive(
    context,
    Math.max(Number(activeAt), readyAt) + SIGNET_ILLUSIONS_INTERVAL,
  );
}

/**
 * Creates and connects all Mesmer feature controllers for one simulation.
 *
 * The returned runtime centralizes normalized traits, event materialization,
 * resource and illusion controllers, cast-local details, and helper functions
 * shared by lifecycle hooks and task handlers.
 *
 * @param {object} context Scheduler initialization context.
 * @returns {object} Connected Mesmer runtime.
 */
function createMesmerRuntime(context: MesmerSchedulerContext): MesmerRuntime {
  const { state, config, catalog, cooldownController } = context;
  const traits = traitSet(config, catalog);
  const resourceDefinition = mesmerResourceDefinition(config.specialization);
  const skillsById = catalog.skillsById;
  const allSkills = catalog.skills;
  const flipSkillsByParent = new Map<SkillId, MesmerSkill>(
    Object.entries(MESMER_FLIP_CHILD_BY_PARENT_ID).flatMap(
      ([parentId, childId]) => {
        const child = skillsById.get(childId);
        return child ? [[Number(parentId), child] as const] : [];
      },
    ),
  );
  const runtime = {
    context,
    traits,
    resourceDefinition,
    skillsById,
    flipSkillsByParent,
    activeEmission: null as MesmerActiveEmission | null,
    castDetails: new Map<string, MesmerCastDetails>(),
    weaponStrength: MESMER_CORE_WEAPON_STRENGTH,
    cloneAttacks: MESMER_CORE_CLONE_ATTACKS,
    ambushAttacks: {
      ...MESMER_CORE_AMBUSH_ATTACKS,
    },
    phantasmAttackTimings: Object.fromEntries(
      Object.entries(MESMER_CORE_PHANTASM_ATTACK_TIMINGS).map(
        ([id, timing]) => [Number(id), { ...timing }],
      ),
    ) as Record<number, import("../types.js").MesmerPhantasmAttackTiming>,
    traitDamage: { ...MESMER_CORE_TRAIT_DAMAGE },
    shatters: { ...MESMER_CORE_SHATTERS },
    instruments: { ...MESMER_CORE_INSTRUMENTS },
    controlSkills: new Set(MESMER_CORE_CONTROL_SKILLS),
    blindSkills: new Set(MESMER_CORE_BLIND_SKILLS),
    aristocracySkills: new Set(MESMER_CORE_ARISTOCRACY_SKILLS),
    peithaSkills: new Set(MESMER_CORE_PEITHA_SKILLS),
  };
  const activePrimaryWeapon = () =>
    state.activeWeaponSet === 1
      ? config.primaryWeapon
      : config.weaponSet2Primary || config.primaryWeapon;

  const emit = (event: SimulationEventInput): SimulationEvent | null => {
    const active = runtime.activeEmission;
    if (active && Number(event.at) > active.effectiveEnd + EPSILON) {
      if (
        event.type !== "condition" ||
        !active.skill.applyConditionsOnInterrupt
      ) {
        return null;
      }
      return context.emit({
        activationId: active.activationId,
        ...event,
        at: active.effectiveEnd,
      });
    }
    return context.emit({
      ...(active ? { activationId: active.activationId } : {}),
      ...event,
    });
  };
  const { addEvent, addTraitProc, addCondition, addDamage } =
    createMesmerEventMaterializer({
      emit,
      activePrimaryWeapon,
      weaponStrength: runtime.weaponStrength,
    });

  const scheduleCloneTask = (clone: MesmerClone, at: number) =>
    context.tasks.schedule({
      type: TASK.cloneAttack,
      at,
      // Legacy temporal semantics resolve a clone's due attack before gains,
      // replacement, shatter, and other profession work at the same timestamp.
      priority: -50,
      ownerId: clone.ownerId,
      payload: { cloneId: clone.id },
    });
  const cloneAttackScheduler = createCloneAttackScheduler({
    state,
    cloneAttacks: runtime.cloneAttacks,
    epsilon: EPSILON,
    addDamage,
    addCondition,
    scheduleTask: scheduleCloneTask,
  });
  const destroyClone = (clone: MesmerClone, _at: number) => {
    context.tasks.cancelOwner(clone.ownerId || `mesmer.clone:${clone.id}`);
  };
  const scheduleResourceTask = (candidate: MesmerPendingResource) => {
    if (
      runtime.activeEmission &&
      candidate.at > runtime.activeEmission.effectiveEnd + EPSILON
    )
      return;
    context.tasks.schedule({
      type: TASK.resourceGain,
      at: Math.max(state.time, candidate.at),
      payload: candidate,
    });
  };
  const resources = createResourceController({
    state,
    traits,
    resourceDefinition,
    epsilon: EPSILON,
    clamp,
    activePrimaryWeapon,
    cloneAttackScheduler,
    addEvent,
    addTraitProc,
    destroyClone,
    scheduleResourceTask,
  });
  const expected = createExpectedProcTracker({
    state,
    config,
    traits,
    epsilon: EPSILON,
    criticalChance: (event) =>
      context.schedulerPolicy.critical?.(context, event)?.chance || 0,
    activePrimaryWeapon,
    queueResources: resources.queueResources,
    emitEvent: (cause, event) => context.emitDerived(cause, event),
    boonDuration: (boon, duration) =>
      context.schedulerPolicy.effectDuration?.(
        context,
        { id: TRAIT.MASTER_FENCER, name: "Master Fencer" },
        { type: "boon", boon, duration },
        duration,
      ) ?? duration,
    addTraitProc,
  });
  const actions = createProfessionActionController({
    state,
    traits,
    resourceDefinition,
    destroyClone,
    epsilon: EPSILON,
    shatters: runtime.shatters,
    instruments: runtime.instruments,
    warnings: context.warnings,
    addEvent,
    addTraitProc,
    addCondition,
    addDamage,
    activePrimaryWeapon,
    queueResources: resources.queueResources,
    byId: (id) => skillsById.get(id),
    traitDamage: runtime.traitDamage,
  });
  const continuum = {
    beginContinuumSplit: () => undefined,
    restoreContinuum: () => undefined,
  };
  const mirage = {
    createMirrors: () => undefined,
    executeCloneAmbushes: () => undefined,
    executePlayerAmbush: () => undefined,
    grantMirageCloak: () => undefined,
    handleMirageShatter: () => undefined,
    handlePostSkill: () => undefined,
    pickUpMirror: () => false,
  };
  const skillEffects = createSkillEffectController({
    state,
    config,
    traits,
    resourceDefinition,
    phantasmAttackTimings: runtime.phantasmAttackTimings,
    allSkills,
    epsilon: EPSILON,
    activePrimaryWeapon,
    currentResource: actions.currentResource,
    markCompounding: resources.markCompounding,
    queueResources: resources.queueResources,
    addEvent,
    addTraitProc,
    addCondition,
    addDamage,
    traitDamage: runtime.traitDamage,
    shatters: runtime.shatters,
    instruments: runtime.instruments,
  });
  const connectedRuntime: MesmerRuntime = Object.assign(runtime, {
    activePrimaryWeapon,
    addEvent,
    addTraitProc,
    addCondition,
    addDamage,
    cloneAttackScheduler,
    destroyClone,
    resources,
    expected,
    actions,
    continuum,
    mirage,
    skillEffects,
  });
  return connectedRuntime;
}

/**
 * Determines whether a non-chain cast is allowed to preserve a pending
 * Mesmer autoattack chain.
 *
 * @param {number} rootId Root skill ID of the pending chain.
 * @param {object} skill Newly completed skill.
 * @returns {boolean} Whether the chain should remain pending.
 */
function preservesAutoattackChain(rootId: number, skill: MesmerSkill): boolean {
  return (
    (PRESERVED_WEAPON_CHAIN_ROOT_IDS.has(rootId) && skill.type === "Weapon") ||
    (rootId === ID.LACERATING_CHOP && skill.id === ID.IMAGINARY_AXES)
  );
}

/**
 * Advances, resets, or selectively preserves Mesmer autoattack-chain state
 * after a skill completes.
 *
 * @param {object} runtime Active Mesmer runtime.
 * @param {object} skill Completed skill.
 * @returns {void}
 */
function updateAutoattackChains(
  runtime: MesmerRuntime,
  skill: MesmerSkill,
): void {
  const { state, catalog } = runtime.context;
  const chains = professionCoreState(state).autoattackChains;
  const position = catalog.autoattackChainPositions.get(skill.id);
  if (position) {
    // Object.keys yields string keys; chain roots are numeric skill ids, so
    // coerce before comparing against or passing to numeric-id consumers.
    for (const root of Object.keys(chains).map(Number)) {
      if (root !== position.root) delete chains[root];
    }
    if (position.next == null) {
      delete chains[position.root];
    } else {
      chains[position.root] = position.next;
    }
    return;
  }
  if (skill.id === -3) {
    professionCoreState(state).autoattackChains = {};
    return;
  }
  if (
    Number(skill.castTimeMs || 0) > 0 &&
    skill.rechargeAnchor !== "castStart"
  ) {
    for (const root of Object.keys(chains).map(Number)) {
      const preserve = preservesAutoattackChain(root, skill);
      if (!preserve) delete chains[root];
    }
  }
}

/** Returns whether a completed Mesmer field of the requested type is active. */
function activeComboField(
  context: MesmerCastContext,
  type: string,
  at: number,
): boolean {
  return context.events.some((event) => {
    if (
      event.type !== "action" ||
      event.cancelled === true ||
      Number(event.endsAt) > at + EPSILON ||
      event.skillId == null
    ) {
      return false;
    }
    const field = context.catalog.skillsById.get(event.skillId);
    return (
      field?.comboField === type &&
      Number(field.duration || 0) > 0 &&
      Number(event.endsAt) + Number(field.duration) >= at - EPSILON
    );
  });
}

/**
 * Commits all completion-time Mesmer mechanics for a skill.
 *
 * This includes interrupted resource restoration, profession actions,
 * autoattack chains, flips, phantasms, specialization controllers, trait
 * events, and signet task scheduling.
 *
 * @param {object} context Scheduler cast-completion context.
 * @param {object} skill Completed or interrupted skill.
 * @returns {void}
 */
function completeMesmerSkill(
  context: MesmerCastContext,
  skill: MesmerSkill,
): void {
  const runtime = mesmerRuntimeFor(context);
  const details = runtime.castDetails.get(context.reservationId) || {};
  const { state } = context;
  const at = context.fullEnd;
  const interrupted = context.effectiveEnd < context.fullEnd - EPSILON;
  const phantasmSummonProgress = Number(skill.phantasmSummonProgress);
  const phantasmSummonThreshold =
    context.start + (context.fullEnd - context.start) * phantasmSummonProgress;
  const completedInterruptedPhantasm =
    interrupted &&
    Number.isFinite(phantasmSummonProgress) &&
    context.effectiveEnd >= phantasmSummonThreshold - EPSILON;
  runtime.activeEmission = {
    skill,
    effectiveEnd:
      interrupted && !completedInterruptedPhantasm
        ? context.effectiveEnd
        : Infinity,
    activationId: context.reservationId,
  };
  try {
    if (
      details.reservedShatterResources &&
      context.effectiveEnd < context.fullEnd - EPSILON
    ) {
      runtime.actions.restoreReservedResources(
        Number(details.shatterSpent || 0),
      );
      return;
    }
    updateAutoattackChains(runtime, skill);
    if (skill.id === -3) {
      state.activeWeaponSet = state.activeWeaponSet === 1 ? 2 : 1;
      runtime.addEvent({
        type: "weapon_set",
        at: context.effectiveEnd,
        weaponSet: state.activeWeaponSet,
      });
      return;
    }
    if (skill.id === -4) {
      runtime.continuum.restoreContinuum(context.effectiveEnd, "manual shift");
      return;
    }
    if (skill.id === -1) {
      runtime.mirage.grantMirageCloak(context.effectiveEnd, skill.name);
      if (runtime.traits.has(TRAIT.DECEPTIVE_EVASION)) {
        runtime.resources.queueResources(
          context.effectiveEnd + EPSILON,
          1,
          runtime.activePrimaryWeapon(),
          "Deceptive Evasion",
          {
            traitId: TRAIT.DECEPTIVE_EVASION,
            traitName: "Deceptive Evasion",
          },
        );
      }
      return;
    }
    if (skill.id === ID.DODGE_TROUBADOUR) {
      if (runtime.traits.has(TRAIT.MAYHEM)) {
        const flute = runtime.skillsById.get(ID.FLUSTERING_FLUTE);
        const readyAt = flute ? state.cooldowns.get(flute.id) : null;
        if (flute && readyAt != null) {
          state.cooldowns.set(
            flute.id,
            Math.max(context.effectiveEnd, readyAt - 1.5),
          );
          runtime.addTraitProc("Mayhem", context.effectiveEnd, skill.name);
        }
      }
      return;
    }
    if (skill.id === ID.PICK_UP_MIRAGE_MIRROR) {
      runtime.mirage.pickUpMirror(context.effectiveEnd, skill.name);
      return;
    }

    let clarityConsumed = false;
    if (skill.ambush) {
      runtime.mirage.executePlayerAmbush(skill, at, context.start);
    } else if (skill.id === ID.CONTINUUM_SPLIT) {
      runtime.continuum.beginContinuumSplit(skill, at);
    } else if (runtime.shatters[skill.id]) {
      runtime.actions.handleShatter(
        skill,
        at,
        details.shatterSpent ?? null,
        context.start,
      );
      runtime.mirage.handleMirageShatter(
        skill,
        at,
        Number(details.shatterSpent || 0),
      );
    } else if (runtime.instruments[skill.id]) {
      runtime.actions.handleInstrument(skill, at, context.start, {
        sourceSkill: skill.name,
        rotationIndex: context.commandIndex,
      });
    } else if (skill.id === ID.CRESCENDO) {
      runtime.actions.handleCrescendo(skill, at, context.start);
    } else {
      if (skill.mesmerEffects) {
        clarityConsumed = runtime.skillEffects.schedule(
          { ...skill, effects: skill.mesmerEffects },
          at,
          context.start,
          completedInterruptedPhantasm
            ? {
                phantasmSummonAt: context.effectiveEnd,
                playerEffectEnd: context.effectiveEnd,
              }
            : undefined,
        );
      }
      if (
        skill.id === ID.LINGERING_THOUGHTS &&
        activeComboField(context, "Ethereal", at)
      ) {
        runtime.addCondition(
          skill.name,
          at,
          {
            name: "Confusion",
            duration: 5,
            stacks: 1,
            applications: 2,
          },
          "Player",
          `${skill.name} — Confounding Bolts`,
          { skillId: skill.id, sourceId: skill.id },
        );
      }
      runtime.mirage.handlePostSkill(skill, at);
      const armedFlip = runtime.flipSkillsByParent.get(skill.id);
      if (armedFlip && context.maximumAmmoFor(armedFlip)) {
        professionCoreState(state).availableFlips[armedFlip.id] = {
          availableAt: at,
          expiresAt: Infinity,
        };
        state.ammo.delete(armedFlip.id);
        state.cooldowns.delete(armedFlip.id);
        context.cooldownController.ensureAmmo(armedFlip, at);
      } else if (armedFlip) {
        const flip = {
          availableAt: context.start + Number(armedFlip.flipDelay || 0),
          expiresAt: context.start + Number(armedFlip.flipDuration || 0),
        };
        if (flip.expiresAt >= at - EPSILON) {
          professionCoreState(state).availableFlips[armedFlip.id] = flip;
          if (armedFlip.id === ID.COUNTERSPELL) {
            professionCoreState(state).counterspellAvailable = true;
          }
        }
      }
      const flipParentId = skill.mesmerMechanic?.flipParentId;
      if (flipParentId) {
        const flipAmmo = state.ammo.get(skill.id);
        if (flipAmmo?.maximum) {
          if (flipAmmo.charges <= 0) {
            delete professionCoreState(state).availableFlips[skill.id];
            state.ammo.delete(skill.id);
            state.cooldowns.delete(skill.id);
          }
        } else {
          delete professionCoreState(state).availableFlips[skill.id];
        }
        if (skill.id === ID.COUNTERSPELL) {
          professionCoreState(state).counterspellAvailable = false;
        }
        if (skill.parentCooldownIncrease) {
          const parent = runtime.skillsById.get(flipParentId);
          const parentReadyAt = parent ? state.cooldowns.get(parent.id) : null;
          if (parent && parentReadyAt != null) {
            state.cooldowns.set(
              parent.id,
              parentReadyAt +
                context.rechargeDurationFor(parent, at) *
                  Number(skill.parentCooldownIncrease),
            );
          }
        }
      }
    }
    if (
      context.config.specialization === "Troubadour" &&
      TROUBADOUR_TALE_IDS.has(skill.id)
    ) {
      runtime.actions.handleTale(skill, at, context.start);
      if (skill.id === ID.TALE_OF_THE_HONORABLE_ROGUE) {
        const dodge = runtime.skillsById.get(ID.DODGE_TROUBADOUR);
        const ammo = dodge
          ? context.cooldownController.refreshAmmo(dodge, at)
          : null;
        if (dodge && ammo && ammo.charges < ammo.maximum) {
          ammo.charges += 1;
          if (ammo.charges >= ammo.maximum) ammo.nextRechargeAt = null;
          state.cooldowns.delete(dodge.id);
        }
      }
    }
    if (
      context.config.specialization === "Troubadour" &&
      skill.resource?.mode === "phantasm" &&
      (!interrupted || completedInterruptedPhantasm)
    ) {
      runtime.resources.queueResources(
        at + EPSILON,
        1,
        runtime.activePrimaryWeapon(),
        "Harmonize",
        { traitId: TRAIT.HARMONIZE, traitName: "Harmonize" },
      );
    }
    const core = professionCoreState(state);
    if (skill.id === ID.MIMIC) {
      core.traitReadyAt.mimicUntil = at + 10;
    } else if (
      skill.type === "Utility" &&
      !skill.mesmerMechanic?.flipParentId &&
      Number(core.traitReadyAt.mimicUntil || 0) >= context.start - EPSILON
    ) {
      state.cooldowns.delete(skill.id);
      core.traitReadyAt.mimicUntil = 0;
      runtime.addEvent({
        type: "proc",
        at,
        source: "Mimic",
        sourceId: ID.MIMIC,
        skillId: ID.MIMIC,
        skillName: "Mimic",
        name: "Mimic",
        targetSkillId: skill.id,
        targetSkillName: skill.name,
        reduction: context.rechargeDuration,
      });
    }
    if (skill.id === ID.SIGNET_OF_THE_ETHER) {
      // In-game bug: the signet re-applies its own cooldown 300ms after the
      // cast completes.
      context.tasks.schedule({
        type: TASK.signetEtherRelock,
        at: context.fullEnd + SIGNET_ETHER_RELOCK_DELAY,
        payload: { skillId: skill.id },
      });
    }
    if (skill.id === ID.SIGNET_OF_ILLUSIONS) {
      restartSignetIllusionsPassive(context, context.fullEnd);
    }
    const disabled =
      runtime.controlSkills.has(skill.id) ||
      (skill.id === ID.MENTAL_COLLAPSE && clarityConsumed);
    if (disabled && !runtime.instruments[skill.id]) {
      runtime.addEvent({
        type: "control",
        at,
        skillId: skill.id,
        skillName: skill.name,
      });
    }
    if (runtime.blindSkills.has(skill.id)) {
      runtime.addEvent({ type: "blind", at, skillName: skill.name });
    }
    if (runtime.aristocracySkills.has(skill.id)) {
      runtime.addEvent({
        type: "weakness_vulnerability",
        at,
        skillName: skill.name,
      });
    }
    if (runtime.peithaSkills.has(skill.id)) {
      // Shadowsteps and deception skills trigger Peitha on activation, not at
      // cast end or when a Mirage Mirror is collected.
      runtime.addEvent({
        type: "peitha",
        at: context.start,
        projectileDelay: PEITHA_PROJECTILE_DELAYS[skill.id] ?? 0,
        skillName: skill.name,
      });
    }
  } finally {
    runtime.activeEmission = null;
    runtime.castDetails.delete(context.reservationId);
  }
}

/**
 * Initializes the per-simulation Mesmer runtime, weapon set, resource pool,
 * ammo, persistent flips, critical-fact requirements, and passive tasks.
 *
 * @param {object} context Scheduler initialization context.
 * @returns {void}
 */
export function initializeMesmerScheduler(
  context: MesmerSchedulerContext,
): void {
  if (
    context.state.activeWeaponSet === 2 &&
    !context.config.weaponSet2Primary &&
    !context.config.weaponSet2Secondary
  ) {
    context.state.activeWeaponSet = 1;
  }
  const runtime = createMesmerRuntime(context);
  context.mesmerRuntime = runtime;
  const { state, config } = context;
  if (
    runtime.traits.has(TRAIT.JAGGED_MIND) ||
    runtime.traits.has(TRAIT.SHARPER_IMAGES) ||
    runtime.traits.has(TRAIT.DEADLY_BLADES) ||
    runtime.traits.has(TRAIT.MASTER_FENCER)
  ) {
    context.schedulerPolicy.requireCriticalFacts?.();
  }
  if (state.profession.specialization.kind === "Mirage") {
    state.profession.specialization.state.riddleOfSandReady =
      runtime.traits.has(TRAIT.RIDDLE_OF_SAND);
  }
  const initial = clamp(
    Number(config.initialResource || 0),
    0,
    runtime.resourceDefinition.maximum,
  );
  runtime.resources.gainResources(0, initial, config.primaryWeapon, "initial", {
    kind: "initial",
  });
  for (const skill of context.catalog.skills) {
    if (
      skill.id === ID.DODGE_TROUBADOUR &&
      config.specialization !== "Troubadour"
    ) {
      continue;
    }
    if (context.maximumAmmoFor(skill) > 0) {
      context.cooldownController.ensureAmmo(skill, 0);
    }
  }
  for (const skill of context.catalog.skills) {
    if (
      skill.armedAtStart &&
      skill.mesmerMechanic?.flipParentId &&
      context.maximumAmmoFor(skill)
    ) {
      professionCoreState(state).availableFlips[skill.id] = {
        availableAt: 0,
        expiresAt: Infinity,
      };
      context.cooldownController.ensureAmmo(skill, 0);
    }
  }
  if (runtime.traits.has(TRAIT.INFINITE_FORGE)) {
    context.tasks.schedule({
      type: TASK.infiniteForge,
      at: 3,
      priority: -20,
      ownerId: "mesmer.infinite-forge",
      payload: {},
    });
  }
  restartSignetIllusionsPassive(context, 0);
}

/**
 * Reserves or consumes shatter resources at the correct cast progress and
 * stores cast-local details for completion or interruption handling.
 *
 * @param {object} context Scheduler cast-start context.
 * @param {object} skill Skill beginning its cast.
 * @returns {void}
 */
export function startMesmerCast(
  context: MesmerCastContext,
  skill: MesmerSkill,
): void {
  const runtime = mesmerRuntimeFor(context);
  const shatter = runtime.shatters[skill.id];
  let shatterSpent = null;
  const spendProgress = Number(shatter?.resourceSpendProgress);
  const delayedBladeSpend =
    shatter?.kind.startsWith("blade") &&
    Number.isFinite(spendProgress) &&
    context.fullEnd > context.start + EPSILON;
  if (delayedBladeSpend) {
    shatterSpent = runtime.actions.reserveResources();
  } else if (shatter && shatter.kind !== "continuum") {
    shatterSpent = runtime.actions.consumeResources(context.start, {
      sourceSkill: skill.name,
      rotationIndex: context.commandIndex,
    });
  }
  runtime.castDetails.set(context.reservationId, {
    reservedShatterResources: delayedBladeSpend,
    shatterSpendCommitted: !delayedBladeSpend,
    shatterSpent,
  });
  if (delayedBladeSpend) {
    context.tasks.schedule({
      type: TASK.bladeSpend,
      at:
        spendProgress === 1
          ? context.fullEnd
          : context.start + (context.fullEnd - context.start) * spendProgress,
      // Run before the core cast-completion task (-100) when the spend is
      // scheduled exactly at fullEnd, so completion receives the spent count.
      priority: -110,
      ownerId: context.reservationId,
      payload: {
        reservationId: context.reservationId,
        sourceSkill: skill.name,
        rotationIndex: context.commandIndex,
      },
    });
  }
}

/**
 * Public cast-completion hook that delegates to the Mesmer runtime processor.
 *
 * @param {object} context Scheduler cast-completion context.
 * @param {object} skill Completed or interrupted skill.
 * @returns {void}
 */
export function completeMesmerCast(
  context: MesmerCastContext,
  skill: MesmerSkill,
): void {
  completeMesmerSkill(context, skill);
}

/**
 * Expires temporary instruments and flip-skill windows as scheduler time
 * advances.
 *
 * @param {object} context Scheduler advancement context.
 * @param {number} target Target simulation time.
 * @returns {void}
 */
export function advanceMesmerScheduler(
  context: MesmerSchedulerContext,
  target: number,
): void {
  const profession = professionCoreState(context);
  const active = context.state.profession.specialization;
  if (active.kind === "Troubadour") {
    for (const [instrument, expiresAt] of Object.entries(
      active.state.instruments,
    )) {
      if (expiresAt <= target + EPSILON) {
        delete active.state.instruments[instrument];
      }
    }
  }
  if (active.kind === "Mirage") {
    active.state.mirrors = active.state.mirrors.filter(
      (mirror) => mirror.expiresAt > target + EPSILON,
    );
  }
  for (const [skillId, flip] of Object.entries(profession.availableFlips)) {
    if (flip.expiresAt < target - EPSILON) {
      delete profession.availableFlips[skillId];
      if (Number(skillId) === ID.COUNTERSPELL) {
        profession.counterspellAvailable = false;
      }
    }
  }
}

/**
 * Observes combat-start, bleeding, and critical-hit candidates and schedules
 * chronological critical-proc processing where required.
 *
 * @param {object} context Scheduler event-observer context.
 * @param {object} event Newly scheduled event.
 * @returns {void}
 */
export function observeMesmerEvent(
  context: MesmerSchedulerContext,
  event: SimulationEvent,
): void {
  const runtime = context.mesmerRuntime;
  if (!runtime) return;
  const triggerSyncopate = (skillName: string): void => {
    if (!runtime.traits.has(TRAIT.SYNCOPATE)) return;
    const damage = runtime.traitDamage.Syncopate;
    if (!damage) return;
    runtime.addDamage(
      {
        id: "Syncopate",
        name: "Syncopate",
        weapon: "Utility",
        blade: false,
      },
      event.at,
      {
        coefficient: damage.coefficient,
        hits: damage.hits,
        source: "Player",
        actorType: "player",
        weapon: "utility",
        weaponStrengthProfileId: "nonweapon.unequipped",
      },
      {
        source: "Player",
        sourceId: TRAIT.SYNCOPATE,
        actorType: "player",
      },
    );
    runtime.addTraitProc("Syncopate", event.at, skillName);
  };
  if (event.type === "control") {
    const skillId = Number(event.skillId);
    const skillName = String(event.skillName || event.name || "Control effect");
    if (
      runtime.traits.has(TRAIT.DANGER_TIME) &&
      (skillId === ID.TIME_SINK || runtime.traits.has(TRAIT.DELAYED_REACTIONS))
    ) {
      runtime.addEvent({
        type: "buff",
        at: event.at,
        kind: "danger-time",
        stacks: 1,
        duration: 10,
        sourceSkill: skillName,
      });
      runtime.addTraitProc("Danger Time", event.at, skillName);
    }
    triggerSyncopate(skillName);
    if (runtime.traits.has(TRAIT.DAZZLING)) {
      runtime.addEvent({
        type: "weakness_vulnerability",
        at: event.at,
        skillId: Number.isFinite(skillId) ? skillId : undefined,
        skillName,
      });
    }
  }
  if (
    event.type === "proc" &&
    event.sourceId === "sigil.energy" &&
    context.config.specialization === "Mirage"
  ) {
    const dodge = runtime.skillsById.get(ID.DODGE_MIRAGE_CLOAK);
    const ammo = dodge
      ? context.cooldownController.refreshAmmo(dodge, event.at)
      : null;
    if (dodge && ammo && ammo.charges < ammo.maximum) {
      ammo.charges += 1;
      if (ammo.charges >= ammo.maximum) ammo.nextRechargeAt = null;
      context.state.cooldowns.delete(dodge.id);
    }
  }
  if (event.type === "combat_start") {
    professionCoreState(context).hasExplicitCombatStart = true;
    professionCoreState(context).combatStartTime = event.at;
    restartSignetIllusionsPassive(context, event.at);
  }
  let candidate: MesmerExpectedProcCandidate | null = null;
  if (event.type === "condition" && event.condition === "Bleeding") {
    candidate = {
      type: "bleeding",
      at: event.at,
      stacks: event.stacks,
      source: event.source,
      cloneId: event.cloneId,
      sourceSkill: event.skillName,
    };
  } else if (event.type === "damage") {
    const skill = runtime.skillsById.get(Number(event.skillId));
    const isBlade = Boolean(event.blade || skill?.blade);
    const tracksCriticalTrait =
      (runtime.traits.has(TRAIT.MASTER_FENCER) &&
        isGw2PlayerActorEvent(event) &&
        Number(event.coefficient) > 0 &&
        event.noCrit !== true &&
        event.canCrit !== false) ||
      (isBlade &&
        (runtime.traits.has(TRAIT.JAGGED_MIND) ||
          runtime.traits.has(TRAIT.DEADLY_BLADES))) ||
      (runtime.traits.has(TRAIT.SHARPER_IMAGES) &&
        (event.source === "Clone" || event.source === "Phantasm"));
    if (!tracksCriticalTrait) return;
    candidate = {
      type: "hit",
      at: event.at,
      event: isBlade && !event.blade ? { ...event, blade: true } : event,
      cloneId: event.cloneId,
    };
  }
  if (!candidate) return;
  context.tasks.schedule({
    type: TASK.expectedProc,
    at: Math.max(context.state.time, event.at),
    priority: -40,
    ownerId: event.cloneId == null ? null : `mesmer.clone:${event.cloneId}`,
    payload: candidate,
  });
}

/**
 * Dispatches a scheduled clone attack to the illusion controller.
 *
 * @param {object} context Scheduler task context.
 * @param {object} task Clone-attack task.
 * @returns {void}
 */
export function handleCloneAttackTask(
  context: MesmerSchedulerContext,
  task: MesmerSchedulerTask<"cloneAttack">,
): void {
  mesmerRuntimeFor(context).cloneAttackScheduler.handleTask(
    task.payload.cloneId,
    task.at,
  );
}

/**
 * Applies a delayed clone or blade resource gain.
 *
 * @param {object} context Scheduler task context.
 * @param {object} task Resource-gain task.
 * @returns {void}
 */
export function handleResourceGainTask(
  context: MesmerSchedulerContext,
  task: MesmerSchedulerTask<"resourceGain">,
): void {
  const runtime = mesmerRuntimeFor(context);
  const { count, weapon, reason, cause } = task.payload;
  runtime.resources.gainResources(task.at, count, weapon, reason, cause);
}

/**
 * Resolves delayed critical trait procs. Deterministic mode uses critical-hit
 * probability; stochastic mode consumes the canonical sampled hit fact.
 *
 * @param {object} context Scheduler task context.
 * @param {object} task Expected-proc task.
 * @returns {void}
 */
export function handleExpectedProcTask(
  context: MesmerSchedulerContext,
  task: MesmerSchedulerTask<"expectedProc">,
): void {
  const runtime = mesmerRuntimeFor(context);
  const payloadEvent = task.payload.type === "hit" ? task.payload.event : null;
  const canonicalEvent = payloadEvent
    ? context.events.find(
        (candidate) => candidate.__order === payloadEvent.__order,
      )
    : null;
  // The trigger materializer runs first and replaces the canonical event with
  // its sampled `didCrit` fact. Preserve Mesmer-only annotations from the
  // original candidate (such as a skill-derived `blade` flag).
  const event = payloadEvent
    ? { ...payloadEvent, ...(canonicalEvent || {}) }
    : null;
  if (
    event?.blade &&
    !event.noCrit &&
    event.canCrit !== false &&
    runtime.traits.has(TRAIT.DEADLY_BLADES)
  ) {
    const vulnerabilityStacks =
      context.config.randomness?.mode === "stochastic"
        ? event.didCrit
          ? 1
          : 0
        : context.schedulerPolicy.critical?.(context, event)?.chance || 0;
    if (vulnerabilityStacks > EPSILON) {
      context.emitDerived(event, {
        type: "buff",
        at: event.at,
        kind: "target-vulnerability",
        stacks: vulnerabilityStacks,
        duration: 5,
        source: "Trait",
        sourceId: TRAIT.DEADLY_BLADES,
        sourceSkill: event.skillName,
      });
      context.emitDerived(event, {
        type: "weakness_vulnerability",
        at: event.at,
        source: "Trait",
        sourceId: TRAIT.DEADLY_BLADES,
        skillName: event.skillName,
      });
    }
  }
  runtime.expected.process(
    task.payload.type === "hit" && event
      ? { ...task.payload, event }
      : task.payload,
  );
}

/**
 * Reapplies Signet of the Ether's full cooldown at the delayed in-game bug
 * timestamp without shortening an existing longer cooldown.
 *
 * @param {object} context Scheduler task context.
 * @param {object} task Signet cooldown re-lock task.
 * @returns {void}
 */
export function handleSignetEtherRelockTask(
  context: MesmerSchedulerContext,
  task: MesmerSchedulerTask<"signetEtherRelock">,
): void {
  const skill = context.catalog.skillsById.get(task.payload.skillId);
  if (!skill) return;
  // Restart the full recharge from the re-lock moment, mirroring the in-game
  // bug. Guard against ever shortening a longer cooldown already in place.
  const readyAt = task.at + context.rechargeDurationFor(skill, task.at);
  context.state.cooldowns.set(
    skill.id,
    Math.max(Number(context.state.cooldowns.get(skill.id) || 0), readyAt),
  );
}

/**
 * Grants Signet of Illusions' passive resource when available or defers the
 * pulse until its cooldown and combat-start requirements are satisfied.
 *
 * @param {object} context Scheduler task context.
 * @param {object} task Signet passive task.
 * @returns {void}
 */
export function handleSignetIllusionsPassiveTask(
  context: MesmerSchedulerContext,
  task: MesmerSchedulerTask<"signetIllusionsPassive">,
): void {
  const runtime = mesmerRuntimeFor(context);
  const skill = equippedSignetOfIllusions(context);
  if (!skill) return;
  if (context.hasExplicitCombatStart && context.combatStartTime == null) return;
  const readyAt = Number(context.state.cooldowns.get(skill.id) || 0);
  if (readyAt > task.at + EPSILON) {
    restartSignetIllusionsPassive(context, readyAt);
    return;
  }
  runtime.resources.gainResources(
    task.at,
    1,
    runtime.activePrimaryWeapon(),
    skill.name,
    { sourceSkillId: skill.id },
  );
  scheduleSignetIllusionsPassive(context, task.at + SIGNET_ILLUSIONS_INTERVAL);
}

/**
 * Calculates Mesmer recharge with special handling for ammo lockouts, weapon
 * swap, Mirage endurance, traits, Chronomancer Alacrity, and shatter resources.
 *
 * @param {object} context Recharge-modifier context.
 * @param {number} sharedDuration Shared-engine recharge duration in seconds.
 * @returns {number} Mesmer-adjusted recharge duration.
 */
export function modifyMesmerRecharge(
  context: MesmerRechargeContext,
  sharedDuration: number,
): number {
  const { skill, config } = context;
  if (context.ammoCastLockout) return sharedDuration;
  if (skill.id === ID.SWAP_WEAPONS) {
    return sharedDuration === 0 ? 0 : Number(skill.cooldown || 0);
  }
  if (skill.id === ID.DODGE_MIRAGE_CLOAK) {
    return Number(skill.cooldown || 0) / (config.boons?.vigor ? 1.5 : 1);
  }
  if (skill.id === ID.DODGE_TROUBADOUR) {
    const active =
      mesmerRuntimeFor(context).context.state.profession.specialization;
    const flutePlaying =
      active.kind === "Troubadour" &&
      Number(active.state.instruments.Flute || 0) >
        mesmerRuntimeFor(context).context.state.time;
    return Number(skill.cooldown || 0) / (flutePlaying ? 1.25 : 1);
  }
  const traits = mesmerRuntimeFor(context).traits;
  let multiplier = 1;
  if (
    mesmerRuntimeFor(context).shatters[skill.id] &&
    traits.has(TRAIT.MASTER_OF_MISDIRECTION)
  )
    multiplier *= 0.85;
  if (skill.weapon === "Sword" && traits.has(TRAIT.FENCERS_FINESSE)) {
    multiplier *= 0.8;
  }
  const rechargeRate = gw2RechargeRate(config, {
    alacrityRate: config.specialization === "Chronomancer" ? 1.5 : 1.25,
  });
  const shatter = mesmerRuntimeFor(context).shatters[skill.id];
  if (shatter?.rechargeReductionPerSource) {
    const clones = mesmerRuntimeFor(context).actions.currentResource();
    const reduction = Number(shatter.rechargeReductionPerSource) * (clones + 1);
    const baseCooldown = Number(skill.cooldown ?? skill.recharge ?? 0);
    return Math.max(0, baseCooldown * multiplier - reduction) / rechargeRate;
  }
  return gw2EffectiveCooldown(skill, config, {
    cooldownMultiplier: multiplier,
    rechargeRate,
  });
}

/**
 * Adds Shatter Storm's second charge to slot-one shatters or instruments.
 *
 * @param {object} context Maximum-ammo modifier context.
 * @param {number} maximum Shared-engine maximum charge count.
 * @returns {number} Mesmer-adjusted maximum charge count.
 */
export function modifyMesmerMaximumAmmo(
  context: MesmerMaximumAmmoContext,
  maximum: number,
): number {
  const id = context.skill.id;
  const runtime = mesmerRuntimeFor(context);
  const isSlot1 =
    runtime.shatters[id]?.slot === 1 || runtime.instruments[id]?.slot === 1;
  return isSlot1 && mesmerRuntimeFor(context).traits.has(TRAIT.SHATTER_STORM)
    ? 2
    : maximum;
}

/**
 * Mesmer availability, recharge, ammo, and profession-owned scheduling rules.
 */
export const mesmerCastRules = Object.freeze({
  availability: {
    id: "mesmer.availability",
    order: 10,
    handler: mesmerAvailability,
  },
  modifyRechargeDuration: modifyMesmerRecharge,
  modifyMaximumAmmo: modifyMesmerMaximumAmmo,
});

export const mesmerCoreSchedulerHooks = Object.freeze({
  initialize: initializeMesmerScheduler,
  advance: advanceMesmerScheduler,
  onCastStart: startMesmerCast,
  onCastComplete: completeMesmerCast,
  onEventScheduled: observeMesmerEvent,
  taskHandlers: Object.freeze({
    [TASK.cloneAttack]: handleCloneAttackTask,
    [TASK.resourceGain]: handleResourceGainTask,
    [TASK.expectedProc]: handleExpectedProcTask,
    [TASK.signetEtherRelock]: handleSignetEtherRelockTask,
    [TASK.signetIllusionsPassive]: handleSignetIllusionsPassiveTask,
  }),
});

import {
  createModifierHooks,
  MODIFIER_TARGET,
} from "../../../platform/gw2/modifier-rules.js";
import { hasTrait } from "../../../platform/gw2/trait-state.js";
import type {
  Gw2ModifierContext,
  Gw2ModifierRule,
  Gw2QueryRuntime,
  Gw2ResolvedStats,
} from "../../../platform/gw2/types.js";

export { snapshotMesmerState } from "./state.js";

const MODIFIER_EPSILON = 0.0001;

export function illusionSource(context: Gw2ModifierContext): boolean {
  return (
    context.event?.source === "Clone" || context.event?.source === "Phantasm"
  );
}

export function timedStacks(
  context: Gw2ModifierContext,
  kind: string,
  duration: number,
  maximum: number,
): number {
  return (
    context.timeline?.timedStacks(kind, context.time, duration, maximum) || 0
  );
}

export function timedActive(
  context: Gw2ModifierContext,
  kind: string,
): boolean {
  return Boolean(context.timeline?.timedActive(kind, context.time));
}

function thornsStacksAt(time: number): number {
  if (time < 3 - MODIFIER_EPSILON) return 0;
  return Math.min(10, Math.floor((time - 3 + MODIFIER_EPSILON) / 5) + 1);
}

export function applyMesmerCoreAttributes(
  context: Gw2ModifierContext,
  attributes: Gw2ResolvedStats,
): Gw2ResolvedStats {
  const thorns =
    context.config?.relic === "Thorns" ? thornsStacksAt(context.time) * 30 : 0;
  const midnight =
    Array.isArray(context.config?.selectedSkills) &&
    context.config.selectedSkills.includes("Signet of Midnight") &&
    context.timeline?.skillOnCooldownAt(10234, context.time)
      ? 180
      : 0;
  const domination =
    Array.isArray(context.config?.selectedSkills) &&
    context.config.selectedSkills.includes("Signet of Domination") &&
    context.timeline?.skillOnCooldownAt(10232, context.time)
      ? 180
      : 0;
  return {
    ...attributes,
    power: Number(attributes.power || 0),
    precision: Number(attributes.precision || 0),
    ferocity:
      Number(attributes.ferocity || 0) +
      timedStacks(context, "fencer", 6, 10) * 15,
    conditionDamage:
      Number(attributes.conditionDamage || 0) + thorns - domination,
    expertise: Number(attributes.expertise || 0) - midnight,
  };
}

function superiorityComplexFactor(context: Gw2ModifierContext): number {
  const targetHealth = Number(context.config?.target?.health || 0);
  const totalDamage = resolvedTotalDamage(context);
  return context.config?.target?.disabled ||
    (targetHealth > 0 && totalDamage >= targetHealth * 0.5)
    ? 1.25
    : 1.15;
}

function resolvedTotalDamage(context: Gw2ModifierContext): number {
  const runtime = context.runtime as
    | (Gw2QueryRuntime & {
        readonly totals?: {
          readonly strike?: number;
          readonly condition?: number;
        };
      })
    | null
    | undefined;
  return (
    Number(runtime?.totals?.strike || 0) +
    Number(runtime?.totals?.condition || 0)
  );
}

export const mesmerCoreModifierRules: readonly Gw2ModifierRule[] =
  Object.freeze([
    {
      id: "mesmer.phantasmal-fury-critical-chance",
      target: MODIFIER_TARGET.CRITICAL_CHANCE,
      operation: "add",
      amount: (context) =>
        context.config?.specialization === "Virtuoso" ? 0.4 : 0.25,
      when: (context) =>
        context.event?.source === "Phantasm" &&
        hasTrait(context, TRAIT.PHANTASMAL_FURY),
    },
    {
      id: "mesmer.superiority-complex",
      target: MODIFIER_TARGET.CRITICAL_DAMAGE,
      operation: "multiply",
      factor: superiorityComplexFactor,
      when: (context) =>
        hasTrait(context, TRAIT.SUPERIORITY_COMPLEX) &&
        !illusionSource(context),
    },
    {
      id: "mesmer.compounding-power",
      target: [MODIFIER_TARGET.STRIKE_DAMAGE, MODIFIER_TARGET.CONDITION_DAMAGE],
      operation: "damage-additive",
      amount: (context, target) =>
        timedStacks(context, "compounding", 8, 5) *
        (target === MODIFIER_TARGET.STRIKE_DAMAGE ? 0.02 : 0.01),
      when: (context) => !illusionSource(context),
    },
    {
      id: "mesmer.illusionary-membrane",
      target: MODIFIER_TARGET.CONDITION_DAMAGE,
      operation: "damage-additive",
      amount: 0.07,
      when: (context) => timedActive(context, "illusionary-membrane"),
    },
    {
      id: "mesmer.mind-stab-vulnerability",
      target: MODIFIER_TARGET.STRIKE_DAMAGE,
      operation: "multiply",
      factor: (context) =>
        1 +
        Number(
          context.query?.vulnerabilityStacksAt(context.time, context.runtime) ||
            0,
        ) *
          0.01,
      order: 100,
      when: (context) => context.event?.skillName === "Mind Stab",
    },
    {
      id: "mesmer.fragility",
      target: MODIFIER_TARGET.STRIKE_DAMAGE,
      operation: "multiply",
      factor: (context) =>
        1 +
        Number(
          context.query?.vulnerabilityStacksAt(context.time, context.runtime) ||
            0,
        ) *
          0.005,
      order: 100,
      when: (context) =>
        hasTrait(context, TRAIT.FRAGILITY) && !illusionSource(context),
    },
    {
      id: "mesmer.vicious-expression",
      target: MODIFIER_TARGET.STRIKE_DAMAGE,
      operation: "multiply",
      factor: (context) => (context.config?.target?.boonless ? 1.15 : 1.1),
      order: 100,
      when: (context) => hasTrait(context, TRAIT.VICIOUS_EXPRESSION),
    },
    {
      id: "mesmer.empowered-illusions",
      target: MODIFIER_TARGET.STRIKE_DAMAGE,
      operation: "multiply",
      factor: 1.15,
      order: 100,
      when: (context) =>
        illusionSource(context) && hasTrait(context, TRAIT.EMPOWERED_ILLUSIONS),
    },
    {
      id: "mesmer.phantasmal-force",
      target: MODIFIER_TARGET.STRIKE_DAMAGE,
      operation: "multiply",
      factor: (context) =>
        1 +
        context.query!.mightStacksAt(
          context.time,
          context.runtime,
          context.event,
        ) *
          0.01,
      order: 100,
      when: (context) =>
        context.event?.source === "Phantasm" &&
        hasTrait(context, TRAIT.PHANTASMAL_FORCE),
    },
    {
      id: "mesmer.mental-anguish",
      target: MODIFIER_TARGET.STRIKE_DAMAGE,
      operation: "multiply",
      factor: (context) =>
        context.config?.target?.activatingSkills ? 1.25 : 1.5,
      order: 100,
      when: (context) =>
        Boolean(context.event?.shatter) &&
        hasTrait(context, TRAIT.MENTAL_ANGUISH),
    },
    {
      id: "mesmer.egotism",
      target: MODIFIER_TARGET.STRIKE_DAMAGE,
      operation: "multiply",
      factor: 1.1,
      order: 100,
      when: (context) =>
        hasTrait(context, TRAIT.EGOTISM) &&
        !illusionSource(context) &&
        Number(context.config?.target?.health || 0) > 0 &&
        resolvedTotalDamage(context) > 0,
    },
    {
      id: "mesmer.event-final-multiplier",
      target: MODIFIER_TARGET.STRIKE_DAMAGE,
      operation: "multiply",
      factor: (context) => Number(context.event?.multiplier || 1),
      order: 1000,
    },
    {
      id: "mesmer.malicious-sorcery",
      target: MODIFIER_TARGET.CONDITION_DURATION,
      operation: "add",
      amount: 0.25,
      when: (context) =>
        context.condition === "Confusion" &&
        hasTrait(context, TRAIT.MALICIOUS_SORCERY),
    },
  ]);

export function compileMesmerModifierRules(
  rules: readonly Gw2ModifierRule[],
): ReturnType<typeof createModifierHooks> {
  return createModifierHooks({
    rules,
    damageBuckets: {
      strikeDamage: {
        includeSigil: (context) => !illusionSource(context),
      },
    },
  });
}

export const mesmerCoreAttributeRules = Object.freeze({
  modifyAttributes: applyMesmerCoreAttributes,
  modifierRules: mesmerCoreModifierRules,
  compileModifierRules: compileMesmerModifierRules,
});
