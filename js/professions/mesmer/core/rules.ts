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
import { createGw2SchedulerEventFactory } from "../../../platform/gw2/scheduler/event-factory.js";
import { CONDITION_FORMULAS } from "../../../platform/gw2/condition-formulas.js";
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
import { createResourceController } from "./resources.js";
import { createSkillEffectController } from "./skill-effects.js";
import { mesmerResourceDefinition } from "./state.js";
import {
  MESMER_FLIP_CHILD_BY_PARENT_ID,
  mesmerRuntimeFor,
} from "./runtime.js";
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
const PRESERVED_WEAPON_CHAIN_ROOT_IDS = new Set<number>([ID.ETHER_BOLT]);
// Delay before Signet of the Ether's in-game bug re-applies its own cooldown
// after the cast finishes.
const SIGNET_ETHER_RELOCK_DELAY = 0.3;
const SIGNET_ILLUSIONS_INTERVAL = 10;
const SIGNET_ILLUSIONS_OWNER = "mesmer.signet-illusions-passive";
/**
 * Restricts a numeric value to an inclusive range.
 *
 * @param {number} value Candidate value.
 * @param {number} minimum Inclusive lower bound.
 * @param {number} maximum Inclusive upper bound.
 * @returns {number} Clamped value.
 */
const clamp = (value: number, minimum: number, maximum: number): number =>
  Math.max(minimum, Math.min(maximum, value));

/**
 * Converts condition aliases to the canonical event display name.
 *
 * @param {unknown} value Condition name or alias.
 * @returns {string} Canonical condition name.
 */
function conditionName(value: unknown): string {
  const normalized = String(value || "").toLowerCase();
  if (normalized === "poison" || normalized === "poisoned") return "Poisoned";
  return normalized.charAt(0).toUpperCase() + normalized.slice(1);
}

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
        (candidate.name === skill.name ||
          Number(candidate.id) === skill.id)),
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
 * The returned runtime centralizes normalized traits, event factories,
 * resource and illusion controllers, cast-local details, and helper functions
 * shared by lifecycle hooks and task handlers.
 *
 * @param {object} context Scheduler initialization context.
 * @returns {object} Connected Mesmer runtime.
 */
function createMesmerRuntime(
  context: MesmerSchedulerContext,
): MesmerRuntime {
  const { state, config, catalog, cooldownController } = context;
  const traits = traitSet(config, catalog);
  const resourceDefinition = mesmerResourceDefinition(config.specialization);
  const skillsById = catalog.skillsById;
  const allSkills = catalog.skills;
  const flipSkillsByParent = new Map<SkillId, MesmerSkill>(
    Object.entries(MESMER_FLIP_CHILD_BY_PARENT_ID).flatMap(
      ([parentId, childId]) => {
        const child = skillsById.get(childId);
        return child
          ? [[Number(parentId), child] as const]
          : [];
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

  const emit = (
    event: SimulationEventInput,
  ): SimulationEvent | null => {
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
    createGw2SchedulerEventFactory({
      events: context.events,
      emit,
      defaultSource: "Mesmer",
      horizon: Infinity,
      epsilon: EPSILON,
      conditionName,
      conditionFormulas: CONDITION_FORMULAS,
      activePrimaryWeapon,
      activeWeaponSet: () => state.activeWeaponSet,
      decorateDamageEvent(event, { skill, extra }) {
        const explicit = String(event.weapon || "");
        const normalized =
          explicit.charAt(0).toUpperCase() + explicit.slice(1).toLowerCase();
        const independentStrength =
          event.actorType === "phantasm" || event.actorType === "summon"
            ? runtime.weaponStrength[normalized]
            : undefined;
        return {
          ...event,
          blade: Boolean(extra.blade ?? skill.blade),
          weaponStrength: event.weaponStrength ?? independentStrength,
        };
      },
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
    emitCondition: (cause, event) => context.emitDerived(cause, event),
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
    executeCloneAmbushes: () => undefined,
    executePlayerAmbush: () => undefined,
    grantMirageCloak: () => undefined,
    handleMirageShatter: () => undefined,
    handlePostSkill: () => undefined,
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
function preservesAutoattackChain(
  rootId: number,
  skill: MesmerSkill,
): boolean {
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

    let clarityConsumed = false;
    if (skill.ambush) {
      runtime.mirage.executePlayerAmbush(skill, at);
    } else if (skill.id === ID.CONTINUUM_SPLIT) {
      runtime.continuum.beginContinuumSplit(skill, at);
    } else if (runtime.shatters[skill.id]) {
      runtime.actions.handleShatter(
        skill,
        at,
        details.shatterSpent ?? null,
      );
      runtime.mirage.handleMirageShatter(
        skill,
        at,
        Number(details.shatterSpent || 0),
      );
    } else if (runtime.instruments[skill.id]) {
      runtime.actions.handleInstrument(skill, at);
    } else if (skill.id === ID.CRESCENDO) {
      runtime.actions.handleCrescendo(skill, at);
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
    if (disabled) {
      runtime.addEvent({ type: "control", at, skillName: skill.name });
      if (
        runtime.traits.has(TRAIT.DANGER_TIME) &&
        (skill.id === ID.TIME_SINK ||
          runtime.traits.has(TRAIT.DELAYED_REACTIONS))
      ) {
        runtime.addEvent({
          type: "buff",
          at,
          kind: "danger-time",
          stacks: 1,
          duration: 10,
          sourceSkill: skill.name,
        });
        runtime.addTraitProc("Danger Time", at, skill.name);
      }
      if (runtime.traits.has(TRAIT.SYNCOPATE)) {
        const damage = runtime.traitDamage.Syncopate;
        runtime.addDamage(
          {
            id: "Syncopate",
            name: "Syncopate",
            weapon: "Utility",
            blade: false,
          },
          at,
          {
            coefficient: damage.coefficient,
            hits: damage.hits,
            source: "Player",
            weapon: "utility",
          },
        );
        runtime.addTraitProc("Syncopate", at, skill.name);
      }
    }
    if (runtime.blindSkills.has(skill.id)) {
      runtime.addEvent({ type: "blind", at, skillName: skill.name });
    }
    if (
      runtime.aristocracySkills.has(skill.id) ||
      (
        runtime.controlSkills.has(skill.id) &&
        runtime.traits.has(TRAIT.DAZZLING)
      )
    ) {
      runtime.addEvent({
        type: "weakness_vulnerability",
        at,
        skillName: skill.name,
      });
    }
    if (runtime.peithaSkills.has(skill.id)) {
      runtime.addEvent({ type: "peitha", at, skillName: skill.name });
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
    runtime.traits.has(TRAIT.DEADLY_BLADES)
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
  runtime.resources.gainResources(
    0,
    initial,
    config.primaryWeapon,
    "initial",
    { kind: "initial" },
  );
  for (const skill of context.catalog.skills) {
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
  const payloadEvent =
    task.payload.type === "hit" ? task.payload.event : null;
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
  if (skill.id === ID.SWAP_WEAPONS) return Number(skill.cooldown || 0);
  if (skill.id === ID.DODGE_MIRAGE_CLOAK) {
    return Number(skill.cooldown || 0) / (config.boons?.vigor ? 1.5 : 1);
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
  return isSlot1 &&
    mesmerRuntimeFor(context).traits.has(TRAIT.SHATTER_STORM)
    ? 2
    : maximum;
}

/**
 * Projects scheduler-owned Mesmer resources, flips, chains, ambush, and
 * Continuum state into the stable simulation result shape.
 *
 * @param {object} projection Projection inputs.
 * @param {object} projection.schedulerContext Final scheduler context.
 * @returns {object} Serializable Mesmer end-state summary.
 */
export function projectMesmerEndState({
  schedulerContext: context,
}: {
  readonly schedulerContext: MesmerSchedulerContext;
}): MesmerEndState {
  const runtime = mesmerRuntimeFor(context);
  const { state, config } = context;
  const endTime = state.time;
  const definition = runtime.resourceDefinition;
  const publicState = flattenProfessionState(
    state.profession,
  ) as unknown as MesmerProfessionState;
  const availableFlips: Record<string, MesmerProjectedFlip> = {};
  for (const [skillId, flip] of Object.entries(
    publicState.availableFlips,
  )) {
    if (flip.expiresAt < endTime - EPSILON) continue;
    const name = context.catalog.skillsById.get(Number(skillId))?.name;
    if (!name) continue;
    const persistent = !Number.isFinite(flip.expiresAt);
    availableFlips[name] = {
      availableAt: Math.round(flip.availableAt * 1000),
      expiresAt: persistent ? null : Math.round(flip.expiresAt * 1000),
      remaining: persistent
        ? null
        : Math.max(0, Math.round((flip.expiresAt - endTime) * 1000)),
      persistent,
    };
  }
  const activeWeapon =
    state.activeWeaponSet === 1
      ? config.primaryWeapon
      : config.weaponSet2Primary || config.primaryWeapon;
  return {
    resource:
      definition.singular === "clone"
        ? publicState.clones.length
        : publicState.numericResource,
    resourceDefinition: definition,
    clarityRemaining: Math.max(
      0,
      Math.round((publicState.clarityUntil - endTime) * 1000),
    ),
    counterspellAvailable: publicState.counterspellAvailable,
    availableAmbush:
      publicState.ambushSource &&
      publicState.ambushUntil > endTime + EPSILON
        ? {
            name: runtime.ambushAttacks[activeWeapon]?.name || "",
            source: publicState.ambushSource,
            expiresAt: Math.round(publicState.ambushUntil * 1000),
            remaining: Math.max(
              0,
              Math.round((publicState.ambushUntil - endTime) * 1000),
            ),
          }
        : null,
    availableFlips,
    autoattackChains: Object.fromEntries(
      context.catalog.autoattackChains.map((chain) => [
        chain[0],
        publicState.autoattackChains[chain[0]] || chain[0],
      ]),
    ),
    continuumActive: Boolean(publicState.continuum),
    continuumRemaining: publicState.continuum
      ? Math.max(
          0,
          Math.round((publicState.continuum.expiresAt - endTime) * 1000),
        )
      : 0,
  };
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
