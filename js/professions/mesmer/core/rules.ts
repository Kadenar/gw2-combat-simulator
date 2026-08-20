import { professionCoreState } from '../../../platform/engine/profession.js';
/**
 * @fileoverview Owns the Core Mesmer scheduler integration boundary. It assembles
 * shared controllers, normalizes build/runtime data, coordinates cast
 * lifecycle state, dispatches typed tasks, and exposes cast-rule modifiers to
 * the shared profession engine.
 */

import { EPSILON, isInternalCooldownReady } from '../../../platform/engine/clock.js';
import { gw2EffectiveCooldown, gw2RechargeRate } from '../../../platform/gw2/runtime-rules.js';
import { isGw2PlayerActorEvent } from '../../../platform/gw2/event-ownership.js';
import { clamp } from '../../../platform/gw2/numeric.js';
import {
  MESMER_CORE_ARISTOCRACY_SKILLS,
  MESMER_CORE_BLIND_SKILLS,
  MESMER_CORE_CLONE_ATTACKS,
  MESMER_CORE_CONTROL_SKILLS,
  MESMER_CORE_PEITHA_PROJECTILE_DELAYS,
  MESMER_CORE_PEITHA_SKILLS,
  MESMER_CORE_PHANTASM_ATTACK_TIMINGS,
  MESMER_CORE_SHATTERS,
  MESMER_CORE_TRAIT_DAMAGE,
  MESMER_CORE_WEAPON_STRENGTH
} from './mechanics.js';
import { MESMER_SKILL_IDS as ID, MESMER_TRAIT_IDS as TRAIT } from '../data/ids.js';
import { createCloneAttackScheduler } from './clone-attacks.js';
import { createProfessionActionController } from './profession-actions.js';
import { resolveCloneShatter } from './shatters.js';
import { createExpectedProcTracker } from './expected-procs.js';
import { createMesmerEventMaterializer } from './event-materializer.js';
import { createResourceController } from './resources.js';
import { createSkillEffectController } from './skill-effects.js';
import { mesmerResourceDefinition, mesmerResourceProfileId } from '../state.js';
import {
  MESMER_CORE_BALANCE_PROFILE_IDS as PROFILE,
  MESMER_CORE_SHATTER_PROFILE_IDS,
  mesmerBalanceProfile,
  mesmerBalanceValue,
  mesmerProfiledShatters,
  mesmerProfiledTraitDamage
} from './profiles.js';
import { MESMER_FLIP_CHILD_BY_PARENT_ID, mesmerRuntimeFor } from './runtime.js';
import { mesmerAvailability } from './availability.js';
import type { CatalogEntity, SimulationEvent, SimulationEventInput, SkillId } from '../../../platform/engine/types.js';
import type {
  MesmerActiveEmission,
  MesmerCastContext,
  MesmerCastDetails,
  MesmerCatalog,
  MesmerClone,
  MesmerExpectedProcCandidate,
  MesmerMaximumAmmoContext,
  MesmerPendingResource,
  MesmerRechargeContext,
  MesmerRuntime,
  MesmerSchedulerContext,
  MesmerSchedulerTask,
  MesmerSelectedSkill,
  MesmerShatterResolution,
  MesmerSkill
} from '../types.js';

/**
 * Namespaced task types scheduled by Mesmer runtime controllers.
 */
const TASK = Object.freeze({
  cloneAttack: 'mesmer.clone-attack',
  resourceGain: 'mesmer.resource-gain',
  expectedProc: 'mesmer.expected-proc',
  chaoticInterruption: 'mesmer.chaotic-interruption',
  bladeSpend: 'mesmer.blade-spend',
  signetIllusionsPassive: 'mesmer.signet-illusions-passive'
});

const PRESERVED_WEAPON_CHAIN_ROOT_IDS = new Set<number>([ID.ETHER_BOLT]);
// Stable task owner for Signet of Illusions' passive resource cycle.
const SIGNET_ILLUSIONS_OWNER = 'mesmer.signet-illusions-passive';
/**
 * Builds a mixed trait set containing both numeric IDs and names so
 * ID-oriented scheduler code and name-oriented data tables share one lookup.
 *
 * @param {object} config Mesmer build configuration.
 * @param {object} catalog Mesmer catalog containing normalized traits.
 * @returns {Set<number|string>} Selected traits indexed by both identity forms.
 */
function traitSet(config: MesmerSchedulerContext['config'], catalog: MesmerCatalog): Set<number> {
  const configured = new Set<MesmerSelectedSkill>([
    ...(config.selectedTraits || []),
    ...(config.selectedTraitIds || []).map(Number),
    ...(config.traitIds || []).map(Number)
  ]);
  const byId = new Map<number, CatalogEntity>();
  const byName = new Map<string, CatalogEntity>();
  for (const trait of catalog.traits || []) {
    byId.set(Number(trait.id), trait);
    byName.set(trait.name, trait);
  }

  const values = new Set<number>();
  for (const value of configured) {
    const trait = (typeof value === 'string' ? byName.get(value) : undefined) || byId.get(Number(value));
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
function selectedSkillValues(config: MesmerSchedulerContext['config']): MesmerSelectedSkill[] {
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
function equippedSignetOfIllusions(context: MesmerSchedulerContext): MesmerSkill | null {
  const skill = context.catalog.skillsById.get(ID.SIGNET_OF_ILLUSIONS);
  if (!skill) return null;
  const equipped = selectedSkillValues(context.config).some(
    (candidate) =>
      candidate === skill.name ||
      Number(candidate) === skill.id ||
      (typeof candidate === 'object' &&
        candidate !== null &&
        (candidate.name === skill.name || Number(candidate.id) === skill.id))
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
function scheduleSignetIllusionsPassive(context: MesmerSchedulerContext, at: number): void {
  if (!equippedSignetOfIllusions(context)) return;
  context.tasks.cancelOwner(SIGNET_ILLUSIONS_OWNER);
  context.tasks.schedule({
    type: TASK.signetIllusionsPassive,
    at: Math.max(context.state.time, Number(at)),
    priority: -20,
    ownerId: SIGNET_ILLUSIONS_OWNER,
    payload: {}
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
function restartSignetIllusionsPassive(context: MesmerSchedulerContext, activeAt: number): void {
  const skill = equippedSignetOfIllusions(context);
  if (!skill) return;
  const readyAt = Number(context.state.cooldowns.get(skill.id) || 0);
  scheduleSignetIllusionsPassive(
    context,
    Math.max(Number(activeAt), readyAt) + mesmerBalanceValue(context, PROFILE.signetOfIllusions, 'pulseInterval', 10)
  );
}

/** Builds Core trait variations consumed by the shared phantasm lifecycle. */
function runtimeTraitsPhantasmSpawnModifiers(
  context: MesmerSchedulerContext,
  traits: ReadonlySet<number>
): Record<number, { countMultiplier: number; damageMultiplier: number }> {
  if (!traits.has(TRAIT.BOUNTIFUL_BLADES)) return {};
  return {
    [ID.PHANTASMAL_BERSERKER]: {
      countMultiplier: mesmerBalanceValue(context, PROFILE.bountifulBlades, 'summons', 2),
      damageMultiplier: mesmerBalanceValue(context, PROFILE.bountifulBlades, 'damageMultiplier', 0.66)
    }
  };
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
  const { state, config, catalog } = context;
  const traits = traitSet(config, catalog);
  const baseResourceDefinition = mesmerResourceDefinition(config.specialization);
  const resourceDefinition = {
    ...baseResourceDefinition,
    maximum: mesmerBalanceValue(
      context,
      mesmerResourceProfileId(config.specialization),
      'maximumStacks',
      baseResourceDefinition.maximum
    )
  };
  const skillsById = catalog.skillsById;
  const allSkills = catalog.skills;
  const flipSkillsByParent = new Map<SkillId, MesmerSkill>(
    Object.entries(MESMER_FLIP_CHILD_BY_PARENT_ID).flatMap(([parentId, childId]) => {
      const child = skillsById.get(childId);
      return child ? [[Number(parentId), child] as const] : [];
    })
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
    ambushAttacks: {},
    phantasmAttackTimings: Object.fromEntries(
      Object.entries(MESMER_CORE_PHANTASM_ATTACK_TIMINGS).map(([id, timing]) => [Number(id), { ...timing }])
    ) as Record<number, import('../types.js').MesmerPhantasmAttackTiming>,
    phantasmPolicy: {
      spawnModifiers: runtimeTraitsPhantasmSpawnModifiers(context, traits),
      conversionTiming: 'spawn' as const
    },
    traitDamage: {
      ...MESMER_CORE_TRAIT_DAMAGE,
      'Lesser Chaos Storm': mesmerProfiledTraitDamage(
        context,
        MESMER_CORE_TRAIT_DAMAGE['Lesser Chaos Storm'],
        PROFILE.methodOfMadness
      )
    },
    shatters: mesmerProfiledShatters(context, MESMER_CORE_SHATTERS, MESMER_CORE_SHATTER_PROFILE_IDS),
    shatterResolvers: {
      'mesmer.core.clone-shatter': resolveCloneShatter
    },
    shatterResolvedHandlers: [],
    skillCompletionHandlers: [],
    instruments: {},
    balanceProfile: (id: SkillId) => mesmerBalanceProfile(context, id),
    controlSkills: new Set(MESMER_CORE_CONTROL_SKILLS),
    blindSkills: new Set(MESMER_CORE_BLIND_SKILLS),
    aristocracySkills: new Set(MESMER_CORE_ARISTOCRACY_SKILLS),
    peithaSkills: new Set(MESMER_CORE_PEITHA_SKILLS),
    peithaProjectileDelays: { ...MESMER_CORE_PEITHA_PROJECTILE_DELAYS }
  };
  const activePrimaryWeapon = () =>
    state.activeWeaponSet === 1 ? config.primaryWeapon : config.weaponSet2Primary || config.primaryWeapon;

  const emit = (event: SimulationEventInput): SimulationEvent | null => {
    const active = runtime.activeEmission;
    if (active && Number(event.at) > active.effectiveEnd + EPSILON) {
      if (event.type !== 'condition' || !active.skill.applyConditionsOnInterrupt) {
        return null;
      }

      return context.emit({
        activationId: active.activationId,
        ...event,
        at: active.effectiveEnd
      });
    }

    return context.emit({
      ...(active ? { activationId: active.activationId } : {}),
      ...event
    });
  };

  const { addEvent, addTraitProc, addCondition, addDamage } = createMesmerEventMaterializer({
    emit,
    activePrimaryWeapon,
    weaponStrength: runtime.weaponStrength
  });

  const scheduleCloneTask = (clone: MesmerClone, at: number) =>
    context.tasks.schedule({
      type: TASK.cloneAttack,
      at,
      // Legacy temporal semantics resolve a clone's due attack before gains,
      // replacement, shatter, and other profession work at the same timestamp.
      priority: -50,
      ownerId: clone.ownerId,
      payload: { cloneId: clone.id }
    });
  const cloneAttackScheduler = createCloneAttackScheduler({
    state,
    cloneAttacks: runtime.cloneAttacks,
    epsilon: EPSILON,
    addDamage,
    addCondition,
    scheduleTask: scheduleCloneTask
  });
  const destroyClone = (clone: MesmerClone, _at: number) => {
    context.tasks.cancelOwner(clone.ownerId || `mesmer.clone:${clone.id}`);
  };

  const scheduleResourceTask = (candidate: MesmerPendingResource) => {
    if (runtime.activeEmission && candidate.at > runtime.activeEmission.effectiveEnd + EPSILON) return;
    context.tasks.schedule({
      type: TASK.resourceGain,
      at: Math.max(state.time, candidate.at),
      payload: candidate
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
    balanceProfile: runtime.balanceProfile
  });
  const expected = createExpectedProcTracker({
    state,
    config,
    traits,
    criticalChance: (event) => context.schedulerPolicy.critical?.(context, event)?.chance || 0,
    emitEvent: (cause, event) => context.emitDerived(cause, event),
    boonDuration: (boon, duration) =>
      context.schedulerPolicy.effectDuration?.(
        context,
        { id: TRAIT.MASTER_FENCER, name: 'Master Fencer' },
        { type: 'boon', boon, duration },
        duration
      ) ?? duration,
    addTraitProc,
    balanceProfile: runtime.balanceProfile
  });
  const actions = createProfessionActionController({
    state,
    traits,
    resourceDefinition,
    destroyClone,
    epsilon: EPSILON,
    shatters: runtime.shatters,
    shatterResolvers: runtime.shatterResolvers,
    warnings: context.warnings,
    addEvent,
    addTraitProc,
    addCondition,
    balanceProfile: runtime.balanceProfile
  });
  const skillEffects = createSkillEffectController({
    state,
    config,
    traits,
    resourceDefinition,
    phantasmAttackTimings: runtime.phantasmAttackTimings,
    phantasmPolicy: () => runtime.phantasmPolicy,
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
    balanceProfile: runtime.balanceProfile
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
    skillEffects
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
    (PRESERVED_WEAPON_CHAIN_ROOT_IDS.has(rootId) && skill.type === 'Weapon') ||
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
function updateAutoattackChains(runtime: MesmerRuntime, skill: MesmerSkill): void {
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

  if (Number(skill.castTimeMs || 0) > 0 && skill.rechargeAnchor !== 'castStart') {
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
/** Notifies the active specialization after Core has committed a shatter's exact resource spend. */
function dispatchShatterResolved(context: MesmerCastContext, resolution: MesmerShatterResolution): void {
  for (const handler of mesmerRuntimeFor(context).shatterResolvedHandlers) {
    handler(context, resolution);
  }
}

function completeMesmerSkill(context: MesmerCastContext, skill: MesmerSkill): void {
  const runtime = mesmerRuntimeFor(context);
  const details = runtime.castDetails.get(context.reservationId) || {};
  const { state } = context;
  const at = context.fullEnd;
  const interrupted = context.effectiveEnd < context.fullEnd - EPSILON;
  const phantasmSummonProgress = Number(skill.phantasmSummonProgress);
  const phantasmSummonThreshold = context.start + (context.fullEnd - context.start) * phantasmSummonProgress;
  const completedInterruptedPhantasm =
    interrupted && Number.isFinite(phantasmSummonProgress) && context.effectiveEnd >= phantasmSummonThreshold - EPSILON;
  runtime.activeEmission = {
    skill,
    effectiveEnd: interrupted && !completedInterruptedPhantasm ? context.effectiveEnd : Infinity,
    activationId: context.reservationId
  };
  try {
    if (details.reservedShatterResources && context.effectiveEnd < context.fullEnd - EPSILON) {
      runtime.actions.restoreReservedResources(Number(details.shatterSpent || 0));
      return;
    }

    updateAutoattackChains(runtime, skill);
    if (skill.id === -3) {
      state.activeWeaponSet = state.activeWeaponSet === 1 ? 2 : 1;
      runtime.addEvent({
        type: 'weapon_set',
        at: context.effectiveEnd,
        weaponSet: state.activeWeaponSet
      });
      return;
    }

    let clarityConsumed = false;
    let specializationHandled = false;
    for (const handler of runtime.skillCompletionHandlers) {
      const result = handler(context, skill, at);
      if (result === false) continue;
      specializationHandled = true;
      if (typeof result === 'object') dispatchShatterResolved(context, result);
      break;
    }

    if (specializationHandled) {
      // The active specialization committed the replacing skill behavior.
    } else if (runtime.shatters[skill.id]) {
      const resolution = runtime.actions.handleShatter(context, skill, at, details.shatterSpent ?? null, context.start);
      if (resolution) dispatchShatterResolved(context, resolution);
    } else {
      if (skill.mesmerEffects) {
        clarityConsumed = runtime.skillEffects.schedule(
          { ...skill, effects: skill.mesmerEffects },
          at,
          context.start,
          completedInterruptedPhantasm
            ? {
                phantasmSummonAt: context.effectiveEnd,
                playerEffectEnd: context.effectiveEnd
              }
            : undefined
        );
      }

      const armedFlip = runtime.flipSkillsByParent.get(skill.id);
      if (armedFlip && context.maximumAmmoFor(armedFlip)) {
        professionCoreState(state).availableFlips[armedFlip.id] = {
          availableAt: at,
          expiresAt: Infinity
        };
        state.ammo.delete(armedFlip.id);
        state.cooldowns.delete(armedFlip.id);
        context.cooldownController.ensureAmmo(armedFlip, at);
      } else if (armedFlip) {
        const flip = {
          availableAt: context.start + Number(armedFlip.flipDelay || 0),
          expiresAt: context.start + Number(armedFlip.flipDuration || 0)
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
              parentReadyAt + context.rechargeDurationFor(parent, at) * Number(skill.parentCooldownIncrease)
            );
          }
        }
      }
    }

    const core = professionCoreState(state);
    const mimicUntil = Number(core.traitReadyAt.mimicUntil || 0);
    if (skill.id === ID.MIMIC) {
      core.traitReadyAt.mimicUntil = at + mesmerBalanceValue(context, PROFILE.mimic, 'durationMultiplier', 10);
    } else if (
      skill.type === 'Utility' &&
      !skill.mesmerMechanic?.flipParentId &&
      mimicUntil > 0 &&
      mimicUntil >= context.start - EPSILON
    ) {
      state.cooldowns.delete(skill.id);
      core.traitReadyAt.mimicUntil = 0;
      runtime.addEvent({
        type: 'proc',
        at,
        source: 'Mimic',
        sourceId: ID.MIMIC,
        skillId: ID.MIMIC,
        skillName: 'Mimic',
        name: 'Mimic',
        targetSkillId: skill.id,
        targetSkillName: skill.name,
        reduction: context.rechargeDuration
      });
    }

    const disabled = runtime.controlSkills.has(skill.id) || (skill.id === ID.MENTAL_COLLAPSE && clarityConsumed);
    if (disabled && !runtime.instruments[skill.id]) {
      runtime.addEvent({
        type: 'control',
        at,
        source: 'Player',
        sourceId: skill.id,
        actorType: 'player',
        skillId: skill.id,
        skillName: skill.name
      });
    }

    if (runtime.blindSkills.has(skill.id)) {
      runtime.addEvent({ type: 'blind', at, skillName: skill.name });
    }

    if (runtime.aristocracySkills.has(skill.id)) {
      runtime.addEvent({
        type: 'weakness_vulnerability',
        at,
        skillName: skill.name
      });
    }

    if (runtime.peithaSkills.has(skill.id)) {
      // Movement skills trigger Peitha on activation rather than at cast end.
      runtime.addEvent({
        type: 'peitha',
        at: context.start,
        projectileDelay: runtime.peithaProjectileDelays[skill.id] ?? 0,
        skillName: skill.name
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
export function initializeMesmerScheduler(context: MesmerSchedulerContext): void {
  if (context.state.activeWeaponSet === 2 && !context.config.weaponSet2Primary && !context.config.weaponSet2Secondary) {
    context.state.activeWeaponSet = 1;
  }

  const runtime = createMesmerRuntime(context);
  context.mesmerRuntime = runtime;
  const { state, config } = context;
  if (runtime.traits.has(TRAIT.SHARPER_IMAGES) || runtime.traits.has(TRAIT.MASTER_FENCER)) {
    context.schedulerPolicy.requireCriticalFacts?.();
  }

  const initial = clamp(Number(config.initialResource || 0), 0, runtime.resourceDefinition.maximum);
  runtime.resources.gainResources(0, initial, config.primaryWeapon, 'initial', {
    kind: 'initial'
  });
  for (const skill of context.catalog.skills) {
    if (context.maximumAmmoFor(skill) > 0) {
      context.cooldownController.ensureAmmo(skill, 0);
    }
  }

  for (const skill of context.catalog.skills) {
    if (skill.armedAtStart && skill.mesmerMechanic?.flipParentId && context.maximumAmmoFor(skill)) {
      professionCoreState(state).availableFlips[skill.id] = {
        availableAt: 0,
        expiresAt: Infinity
      };
      context.cooldownController.ensureAmmo(skill, 0);
    }
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
export function startMesmerCast(context: MesmerCastContext, skill: MesmerSkill): void {
  const runtime = mesmerRuntimeFor(context);
  const shatter = runtime.shatters[skill.id];
  let shatterSpent = null;
  const spendProgress = Number(shatter?.resourceSpendProgress);
  const delayedResourceSpend =
    shatter?.consumesResources !== false && Number.isFinite(spendProgress) && context.fullEnd > context.start + EPSILON;
  if (delayedResourceSpend) {
    shatterSpent = runtime.actions.reserveResources();
  } else if (shatter && shatter.consumesResources !== false) {
    shatterSpent = runtime.actions.consumeResources(context.start, {
      sourceSkill: skill.name,
      rotationIndex: context.commandIndex
    });
  }

  runtime.castDetails.set(context.reservationId, {
    reservedShatterResources: delayedResourceSpend,
    shatterSpendCommitted: !delayedResourceSpend,
    shatterSpent
  });
  if (delayedResourceSpend) {
    context.tasks.schedule({
      type: TASK.bladeSpend,
      at: spendProgress === 1 ? context.fullEnd : context.start + (context.fullEnd - context.start) * spendProgress,
      // Run before the core cast-completion task (-100) when the spend is
      // scheduled exactly at fullEnd, so completion receives the spent count.
      priority: -110,
      ownerId: context.reservationId,
      payload: {
        reservationId: context.reservationId,
        sourceSkill: skill.name,
        rotationIndex: context.commandIndex
      }
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
export function completeMesmerCast(context: MesmerCastContext, skill: MesmerSkill): void {
  completeMesmerSkill(context, skill);
}

/**
 * Expires shared flip-skill windows as scheduler time advances.
 *
 * @param {object} context Scheduler advancement context.
 * @param {number} target Target simulation time.
 * @returns {void}
 */
export function advanceMesmerScheduler(context: MesmerSchedulerContext, target: number): void {
  const profession = professionCoreState(context);
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
 * Chaotic Interruption recharges a random equipped-weapon skill when you
 * interrupt a foe. The random pick is resolved deterministically to the active
 * weapon set's phantasm — Staff → Warlock, offhand Pistol → Duelist, offhand
 * Torch → Mage. Modeled on {@link triggerIneptitudeFromInterrupt} (same
 * activating-target gate and defiant internal-cooldown pattern) but lives
 * scheduler-side because the recharge mutates scheduler-owned cooldown state
 * the resolver-only trait module cannot reach.
 */
function triggerChaoticInterruption(context: MesmerSchedulerContext, event: SimulationEvent, skillName: string): void {
  const runtime = context.mesmerRuntime;
  if (!runtime?.traits.has(TRAIT.CHAOTIC_INTERRUPTION) || !context.config.target?.activatingSkills) {
    return;
  }

  const defiant = Boolean(context.config.target?.defiant);
  const core = professionCoreState(context);
  if (defiant && !isInternalCooldownReady(event.at, Number(core.traitReadyAt[TRAIT.CHAOTIC_INTERRUPTION] || 0))) {
    return;
  }

  const set = context.state.activeWeaponSet;
  const mainhand =
    set === 1 ? context.config.primaryWeapon : context.config.weaponSet2Primary || context.config.primaryWeapon;
  const offhand =
    set === 1 ? context.config.secondaryWeapon : context.config.weaponSet2Secondary || context.config.secondaryWeapon;

  let targetId: number | null = null;
  if (mainhand === 'Staff') targetId = ID.PHANTASMAL_WARLOCK;
  else if (offhand === 'Pistol') targetId = ID.PHANTASMAL_DUELIST;
  else if (offhand === 'Torch') targetId = ID.PHANTASMAL_MAGE;

  if (targetId == null) return;

  // Only affects weapon skills that are recharging.
  const readyAt = Number(context.state.cooldowns.get(targetId) || 0);
  if (!(readyAt > event.at + EPSILON)) return;
  const reduction = mesmerBalanceValue(context, TRAIT.CHAOTIC_INTERRUPTION, 'recharge', 5);

  const reduced = Math.max(event.at, readyAt - reduction);
  if (reduced > event.at + EPSILON) {
    context.state.cooldowns.set(targetId, reduced);
  } else {
    context.state.cooldowns.delete(targetId);
  }

  if (defiant) {
    core.traitReadyAt[TRAIT.CHAOTIC_INTERRUPTION] =
      event.at + mesmerBalanceValue(context, TRAIT.CHAOTIC_INTERRUPTION, 'internalCooldown', 1);
  }

  runtime.addTraitProc(
    'Chaotic Interruption',
    event.at,
    skillName,
    `${runtime.skillsById.get(targetId)?.name || 'weapon skill'} recharge -${reduction}s`
  );
}

/** Evaluates Chaotic Interruption when a delayed control packet actually lands. */
function handleChaoticInterruptionTask(
  context: MesmerSchedulerContext,
  task: MesmerSchedulerTask<'chaoticInterruption'>
): void {
  triggerChaoticInterruption(
    context,
    { type: 'control', at: task.at, source: 'Skill', sourceId: task.payload.skillId },
    task.payload.skillName
  );
}

/**
 * Observes shared combat-start, control, bleeding, and critical-hit candidates
 * and schedules chronological processing where required.
 *
 * @param {object} context Scheduler event-observer context.
 * @param {object} event Newly scheduled event.
 * @returns {void}
 */
export function observeMesmerEvent(context: MesmerSchedulerContext, event: SimulationEvent): void {
  const runtime = context.mesmerRuntime;
  if (!runtime) return;
  if (event.type === 'control') {
    const skillId = Number(event.skillId);
    const skillName = String(event.skillName || event.name || 'Control effect');
    if (runtime.traits.has(TRAIT.DAZZLING)) {
      runtime.addEvent({
        type: 'weakness_vulnerability',
        at: event.at,
        skillId: Number.isFinite(skillId) ? skillId : undefined,
        skillName
      });
    }

    // Cooldowns can change between scheduling and impact, so delayed control
    // packets must evaluate the recharge against state at their actual hit time.
    if (event.at > context.state.time + EPSILON) {
      context.tasks.schedule({
        type: TASK.chaoticInterruption,
        at: event.at,
        payload: { skillId, skillName }
      });
    } else {
      triggerChaoticInterruption(context, event, skillName);
    }
  }

  if (event.type === 'combat_start') {
    professionCoreState(context).hasExplicitCombatStart = true;
    professionCoreState(context).combatStartTime = event.at;
    restartSignetIllusionsPassive(context, event.at);
  }

  let candidate: MesmerExpectedProcCandidate | null = null;
  if (event.type === 'damage') {
    const tracksCriticalTrait =
      (runtime.traits.has(TRAIT.MASTER_FENCER) &&
        isGw2PlayerActorEvent(event) &&
        Number(event.coefficient) > 0 &&
        event.noCrit !== true &&
        event.canCrit !== false) ||
      (runtime.traits.has(TRAIT.SHARPER_IMAGES) && (event.source === 'Clone' || event.source === 'Phantasm'));

    if (!tracksCriticalTrait) return;
    candidate = {
      type: 'hit',
      at: event.at,
      event,
      cloneId: event.cloneId
    };
  }

  if (!candidate) return;
  context.tasks.schedule({
    type: TASK.expectedProc,
    at: Math.max(context.state.time, event.at),
    priority: -40,
    ownerId: event.cloneId == null ? null : `mesmer.clone:${event.cloneId}`,
    payload: candidate
  });
}

/**
 * Dispatches a scheduled clone attack to the illusion controller.
 *
 * @param {object} context Scheduler task context.
 * @param {object} task Clone-attack task.
 * @returns {void}
 */
export function handleCloneAttackTask(context: MesmerSchedulerContext, task: MesmerSchedulerTask<'cloneAttack'>): void {
  mesmerRuntimeFor(context).cloneAttackScheduler.handleTask(task.payload.cloneId, task.at);
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
  task: MesmerSchedulerTask<'resourceGain'>
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
  task: MesmerSchedulerTask<'expectedProc'>
): void {
  const runtime = mesmerRuntimeFor(context);
  const payloadEvent = task.payload.type === 'hit' ? task.payload.event : null;
  const canonicalEvent = payloadEvent
    ? context.events.find((candidate) => candidate.__order === payloadEvent.__order)
    : null;
  // The trigger materializer runs first and replaces the canonical event with
  // its sampled `didCrit` fact. Preserve Mesmer-only annotations from the
  // original candidate (such as a skill-derived `blade` flag).
  const event = payloadEvent ? { ...payloadEvent, ...(canonicalEvent || {}) } : null;
  runtime.expected.process(task.payload.type === 'hit' && event ? { ...task.payload, event } : task.payload);
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
  task: MesmerSchedulerTask<'signetIllusionsPassive'>
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
    mesmerBalanceValue(context, PROFILE.signetOfIllusions, 'resourceGain', 1),
    runtime.activePrimaryWeapon(),
    skill.name,
    { sourceSkillId: skill.id }
  );
  scheduleSignetIllusionsPassive(
    context,
    task.at + mesmerBalanceValue(context, PROFILE.signetOfIllusions, 'pulseInterval', 10)
  );
}

/**
 * Calculates Mesmer recharge with special handling for ammo lockouts, weapon
 * swap, shared traits, Alacrity, and shatter resources.
 *
 * @param {object} context Recharge-modifier context.
 * @param {number} sharedDuration Shared-engine recharge duration in seconds.
 * @returns {number} Mesmer-adjusted recharge duration.
 */
export function modifyMesmerRecharge(context: MesmerRechargeContext, sharedDuration: number): number {
  const { skill, config } = context;
  if (context.ammoCastLockout) return sharedDuration;
  if (skill.id === ID.SWAP_WEAPONS) {
    return sharedDuration === 0 ? 0 : Number(skill.cooldown || 0);
  }

  const traits = mesmerRuntimeFor(context).traits;
  let multiplier = 1;
  if (
    (mesmerRuntimeFor(context).shatters[skill.id] || mesmerRuntimeFor(context).instruments[skill.id]) &&
    traits.has(TRAIT.MASTER_OF_MISDIRECTION)
  )
    multiplier *= mesmerBalanceValue(context, PROFILE.masterOfMisdirection, 'rechargeMultiplier', 0.85);
  if (skill.weapon === 'Sword' && traits.has(TRAIT.FENCERS_FINESSE)) {
    multiplier *= mesmerBalanceValue(context, PROFILE.fencersFinesse, 'rechargeMultiplier', 0.8);
  }

  const rechargeRate = gw2RechargeRate(config, { alacrityRate: 1.25 });
  const shatter = mesmerRuntimeFor(context).shatters[skill.id];
  if (shatter?.rechargeReductionPerSource) {
    const clones = mesmerRuntimeFor(context).actions.currentResource();
    const reduction = Number(shatter.rechargeReductionPerSource) * (clones + 1);
    const baseCooldown = Number(skill.cooldown ?? skill.recharge ?? 0);
    return Math.max(0, baseCooldown * multiplier - reduction) / rechargeRate;
  }

  return gw2EffectiveCooldown(skill, config, {
    cooldownMultiplier: multiplier,
    rechargeRate
  });
}

/**
 * Adds Shatter Storm's second charge to slot-one shatters or instruments.
 *
 * @param {object} context Maximum-ammo modifier context.
 * @param {number} maximum Shared-engine maximum charge count.
 * @returns {number} Mesmer-adjusted maximum charge count.
 */
export function modifyMesmerMaximumAmmo(context: MesmerMaximumAmmoContext, maximum: number): number {
  const id = context.skill.id;
  const runtime = mesmerRuntimeFor(context);
  const isSlot1 = runtime.shatters[id]?.slot === 1 || runtime.instruments[id]?.slot === 1;
  return isSlot1 && mesmerRuntimeFor(context).traits.has(TRAIT.SHATTER_STORM)
    ? mesmerBalanceValue(context, PROFILE.shatterStorm, 'maximumStacks', 2)
    : maximum;
}

/**
 * Mesmer availability, recharge, ammo, and profession-owned scheduling rules.
 */
export const mesmerCastRules = Object.freeze({
  availability: {
    id: 'mesmer.availability',
    order: 10,
    handler: mesmerAvailability
  },
  modifyRechargeDuration: modifyMesmerRecharge,
  modifyMaximumAmmo: modifyMesmerMaximumAmmo
});

/** Runs skill-authored Core mechanics at their resolved scheduler timestamps. */
export const mesmerCoreSkillMechanicHandlers = Object.freeze({
  'mesmer.core.relock-signet-ether': ({
    context,
    skill,
    at
  }: {
    context: MesmerSchedulerContext;
    skill: MesmerSkill;
    at: number;
  }): void => {
    const readyAt = at + context.rechargeDurationFor(skill, at);
    context.state.cooldowns.set(skill.id, Math.max(Number(context.state.cooldowns.get(skill.id) || 0), readyAt));
  },
  'mesmer.core.restart-signet-illusions-passive': ({
    context,
    at
  }: {
    context: MesmerSchedulerContext;
    at: number;
  }): void => {
    restartSignetIllusionsPassive(context, at);
  }
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
    [TASK.chaoticInterruption]: handleChaoticInterruptionTask,
    [TASK.signetIllusionsPassive]: handleSignetIllusionsPassiveTask
  })
});

import { createModifierHooks, MODIFIER_TARGET } from '../../../platform/gw2/modifier-rules.js';
import { hasTrait } from '../../../platform/gw2/trait-state.js';
import type {
  Gw2ModifierContext,
  Gw2ModifierRule,
  Gw2QueryRuntime,
  Gw2ResolvedStats
} from '../../../platform/gw2/types.js';

const MODIFIER_EPSILON = 0.0001;

export function illusionSource(context: Gw2ModifierContext): boolean {
  return context.event?.source === 'Clone' || context.event?.source === 'Phantasm';
}

export function timedStacks(context: Gw2ModifierContext, kind: string, duration: number, maximum: number): number {
  return context.timeline?.timedStacks(kind, context.time, duration, maximum) || 0;
}

export function timedActive(context: Gw2ModifierContext, kind: string): boolean {
  return Boolean(context.timeline?.timedActive(kind, context.time));
}

function thornsStacksAt(time: number): number {
  if (time < 3 - MODIFIER_EPSILON) return 0;
  return Math.min(10, Math.floor((time - 3 + MODIFIER_EPSILON) / 5) + 1);
}

export function applyMesmerCoreAttributes(context: Gw2ModifierContext, attributes: Gw2ResolvedStats): Gw2ResolvedStats {
  const selectedSkills = Array.isArray(context.config?.selectedSkills) ? context.config.selectedSkills : [];
  const thorns = context.config?.relic === 'Thorns' ? thornsStacksAt(context.time) * 30 : 0;
  const midnightSelected = selectedSkills.includes('Signet of Midnight');
  const midnightBonus = mesmerBalanceValue(context, PROFILE.signetOfMidnight, 'expertiseBonus', 180);
  const midnight = midnightSelected && context.timeline?.skillOnCooldownAt(10234, context.time) ? midnightBonus : 0;
  const dominationSelected = selectedSkills.includes('Signet of Domination');
  const dominationBonus = mesmerBalanceValue(context, PROFILE.signetOfDomination, 'conditionDamageBonus', 180);
  const domination =
    dominationSelected && context.timeline?.skillOnCooldownAt(10232, context.time) ? dominationBonus : 0;
  const chaoticExpertiseDelta = hasTrait(context, PROFILE.chaoticPersistence)
    ? mesmerBalanceValue(context, PROFILE.chaoticPersistence, 'expertiseBonus', 100) - 100
    : 0;
  return {
    ...attributes,
    power: Number(attributes.power || 0),
    precision: Number(attributes.precision || 0),
    ferocity:
      Number(attributes.ferocity || 0) +
      timedStacks(
        context,
        'fencer',
        mesmerBalanceValue(context, PROFILE.fencersFinesse, 'durationMultiplier', 6),
        mesmerBalanceValue(context, PROFILE.fencersFinesse, 'maximumStacks', 10)
      ) *
        mesmerBalanceValue(context, PROFILE.fencersFinesse, 'attributePerStack', 15),
    conditionDamage:
      Number(attributes.conditionDamage || 0) + thorns + (dominationSelected ? dominationBonus - 180 : 0) - domination,
    expertise:
      Number(attributes.expertise || 0) +
      chaoticExpertiseDelta +
      (midnightSelected ? midnightBonus - 180 : 0) -
      midnight,
    concentration:
      Number(attributes.concentration || 0) +
      (hasTrait(context, PROFILE.chaoticPersistence)
        ? mesmerBalanceValue(context, PROFILE.chaoticPersistence, 'concentrationBonus', 250) - 250
        : 0)
  };
}

const modifierParameters = (values: Record<string, number>): Readonly<Record<string, number>> => Object.freeze(values);

function superiorityComplexFactor(
  context: Gw2ModifierContext,
  _target: string,
  parameters: Readonly<Record<string, number>>
): number {
  const targetHealth = Number(context.config?.target?.health || 0);
  const totalDamage = resolvedTotalDamage(context);
  return context.config?.target?.disabled || (targetHealth > 0 && totalDamage >= targetHealth * parameters.threshold)
    ? parameters.lowHealthOrDisabledFactor
    : parameters.highHealthFactor;
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
  return Number(runtime?.totals?.strike || 0) + Number(runtime?.totals?.condition || 0);
}

export const mesmerCoreModifierRules: readonly Gw2ModifierRule[] = Object.freeze([
  {
    id: 'mesmer.phantasmal-fury-critical-chance',
    target: MODIFIER_TARGET.CRITICAL_CHANCE,
    operation: 'add',
    amount: 0.25,
    when: (context) => context.event?.source === 'Phantasm' && hasTrait(context, TRAIT.PHANTASMAL_FURY)
  },
  {
    id: 'mesmer.superiority-complex',
    target: MODIFIER_TARGET.CRITICAL_DAMAGE,
    operation: 'multiply',
    parameters: modifierParameters({
      highHealthFactor: 1.15,
      lowHealthOrDisabledFactor: 1.25,
      threshold: 0.5
    }),
    factor: superiorityComplexFactor,
    when: (context) => hasTrait(context, TRAIT.SUPERIORITY_COMPLEX) && !illusionSource(context)
  },
  {
    id: 'mesmer.compounding-power',
    target: [MODIFIER_TARGET.STRIKE_DAMAGE, MODIFIER_TARGET.CONDITION_DAMAGE],
    operation: 'damage-additive',
    parameters: modifierParameters({
      duration: 8,
      maximumStacks: 5,
      strikePerStack: 0.02,
      conditionPerStack: 0.01
    }),
    amount: (context, target, parameters) =>
      timedStacks(context, 'compounding', parameters.duration, parameters.maximumStacks) *
      (target === MODIFIER_TARGET.STRIKE_DAMAGE ? parameters.strikePerStack : parameters.conditionPerStack),
    when: (context) => !illusionSource(context)
  },
  {
    id: 'mesmer.illusionary-membrane',
    target: MODIFIER_TARGET.CONDITION_DAMAGE,
    operation: 'damage-additive',
    amount: 0.07,
    when: (context) => timedActive(context, 'illusionary-membrane')
  },
  {
    id: 'mesmer.mind-stab-vulnerability',
    target: MODIFIER_TARGET.STRIKE_DAMAGE,
    operation: 'multiply',
    parameters: modifierParameters({ baseFactor: 1, damagePerStack: 0.01 }),
    factor: (context, _target, parameters) =>
      parameters.baseFactor +
      Number(context.query?.vulnerabilityStacksAt(context.time, context.runtime) || 0) * parameters.damagePerStack,
    order: 100,
    when: (context) => context.event?.skillName === 'Mind Stab'
  },
  {
    id: 'mesmer.fragility',
    target: MODIFIER_TARGET.STRIKE_DAMAGE,
    operation: 'multiply',
    parameters: modifierParameters({ baseFactor: 1, damagePerStack: 0.005 }),
    factor: (context, _target, parameters) =>
      parameters.baseFactor +
      Number(context.query?.vulnerabilityStacksAt(context.time, context.runtime) || 0) * parameters.damagePerStack,
    order: 100,
    when: (context) => hasTrait(context, TRAIT.FRAGILITY) && !illusionSource(context)
  },
  {
    id: 'mesmer.vicious-expression',
    target: MODIFIER_TARGET.STRIKE_DAMAGE,
    operation: 'multiply',
    parameters: modifierParameters({
      boonlessFactor: 1.15,
      normalFactor: 1.1
    }),
    factor: (context, _target, parameters) =>
      context.config?.target?.boonless ? parameters.boonlessFactor : parameters.normalFactor,
    order: 100,
    when: (context) => hasTrait(context, TRAIT.VICIOUS_EXPRESSION)
  },
  {
    id: 'mesmer.empowered-illusions',
    target: MODIFIER_TARGET.STRIKE_DAMAGE,
    operation: 'multiply',
    factor: 1.15,
    order: 100,
    when: (context) => illusionSource(context) && hasTrait(context, TRAIT.EMPOWERED_ILLUSIONS)
  },
  {
    id: 'mesmer.phantasmal-force',
    target: MODIFIER_TARGET.STRIKE_DAMAGE,
    operation: 'multiply',
    parameters: modifierParameters({ baseFactor: 1, damagePerMight: 0.01 }),
    factor: (context, _target, parameters) =>
      parameters.baseFactor +
      context.query!.mightStacksAt(context.time, context.runtime, context.event) * parameters.damagePerMight,
    order: 100,
    when: (context) => context.event?.source === 'Phantasm' && hasTrait(context, TRAIT.PHANTASMAL_FORCE)
  },
  {
    id: 'mesmer.mental-anguish',
    target: MODIFIER_TARGET.STRIKE_DAMAGE,
    operation: 'multiply',
    parameters: modifierParameters({
      activatingFactor: 1.25,
      idleFactor: 1.5
    }),
    factor: (context, _target, parameters) =>
      context.config?.target?.activatingSkills ? parameters.activatingFactor : parameters.idleFactor,
    order: 100,
    when: (context) => Boolean(context.event?.shatter) && hasTrait(context, TRAIT.MENTAL_ANGUISH)
  },
  {
    id: 'mesmer.egotism',
    target: MODIFIER_TARGET.STRIKE_DAMAGE,
    operation: 'multiply',
    factor: 1.1,
    order: 100,
    when: (context) =>
      hasTrait(context, TRAIT.EGOTISM) &&
      !illusionSource(context) &&
      Number(context.config?.target?.health || 0) > 0 &&
      resolvedTotalDamage(context) > 0
  },
  {
    id: 'mesmer.event-final-multiplier',
    target: MODIFIER_TARGET.STRIKE_DAMAGE,
    operation: 'multiply',
    parameters: modifierParameters({ fallbackFactor: 1 }),
    factor: (context, _target, parameters) => Number(context.event?.multiplier || parameters.fallbackFactor),
    order: 1000
  },
  {
    id: 'mesmer.malicious-sorcery',
    target: MODIFIER_TARGET.CONDITION_DURATION,
    operation: 'add',
    amount: 0.25,
    when: (context) => context.condition === 'Confusion' && hasTrait(context, TRAIT.MALICIOUS_SORCERY)
  }
]);

export function compileMesmerModifierRules(rules: readonly Gw2ModifierRule[]): ReturnType<typeof createModifierHooks> {
  return createModifierHooks({
    rules,
    damageBuckets: {
      strikeDamage: {
        includeSigil: (context) => !illusionSource(context)
      }
    }
  });
}

export const mesmerCoreAttributeRules = Object.freeze({
  modifyAttributes: applyMesmerCoreAttributes,
  modifierRules: mesmerCoreModifierRules,
  compileModifierRules: compileMesmerModifierRules
});
