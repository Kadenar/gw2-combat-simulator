/** Connects Core Mesmer illusion, resource, shatter, and effect controllers for one simulation. */
import {
  balanceProfileFromContext,
  balanceProfileValueFromContext
} from '#gw2/platform/combat/state/balance-profiles.js';
import { EPSILON } from '#kernel/core/clock.js';
import { clamp } from '#gw2/platform/combat/numeric.js';
import { gw2ActivePrimaryWeapon } from '#gw2/platform/equipment/weapons/loadout.js';
import type { SimulationEvent, SimulationEventInput, SkillId } from '#gw2/platform/engine/types.js';
import { gw2SchedulerBoonDuration } from '#gw2/platform/scheduler/policy.js';
import { MESMER_SKILL_IDS as ID, MESMER_TRAIT_IDS as TRAIT } from '#gw2/professions/mesmer/data/ids.js';
import { mesmerResourceDefinition, mesmerResourceProfileId } from '#gw2/professions/mesmer/state/index.js';
import type { MesmerRuntime, MesmerSchedulerContext } from '#gw2/professions/mesmer/types.js';
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
} from '#gw2/professions/mesmer/core/mechanics/definitions.js';
import { createProfessionActionController } from '#gw2/professions/mesmer/core/mechanics/profession-actions.js';
import { createResourceController } from '#gw2/professions/mesmer/core/mechanics/resources.js';
import { MESMER_FLIP_CHILD_BY_PARENT_ID } from '#gw2/professions/mesmer/core/mechanics/runtime.js';
import { resolveCloneShatter } from '#gw2/professions/mesmer/core/mechanics/shatters.js';
import {
  MESMER_CORE_BALANCE_PROFILE_IDS as PROFILE,
  MESMER_CORE_SHATTER_PROFILE_IDS,
  mesmerProfiledShatters,
  mesmerProfiledTraitDamage
} from '#gw2/professions/mesmer/core/profiles.js';
import { createSkillEffectController } from '#gw2/professions/mesmer/core/execution/effect-controller.js';
import { createCloneAttackScheduler } from '#gw2/professions/mesmer/core/mechanics/illusions/clone-attacks.js';
import { createExpectedProcTracker } from '#gw2/professions/mesmer/core/mechanics/illusions/expected-procs.js';
import { createMesmerEventEmitters } from '#gw2/professions/mesmer/core/mechanics/illusions/event-emission.js';
import type { MesmerActiveEmission, MesmerCastDetails } from '#gw2/professions/mesmer/core/execution/effect-types.js';
import type {
  MesmerClone,
  MesmerPhantasmAttackTiming
} from '#gw2/professions/mesmer/core/mechanics/illusions/types.js';
import type { MesmerPendingResource } from '#gw2/professions/mesmer/core/mechanics/resource-types.js';
import type { MesmerSkill } from '#gw2/professions/mesmer/data/types.js';

/** Builds Core trait variations consumed by the shared phantasm lifecycle. */
function runtimeTraitsPhantasmSpawnModifiers(
  context: MesmerSchedulerContext,
  traits: ReadonlySet<number>
): Record<number, { countMultiplier: number; damageMultiplier: number }> {
  if (!traits.has(TRAIT.BOUNTIFUL_BLADES)) return {};
  return {
    [ID.PHANTASMAL_BERSERKER]: {
      countMultiplier: balanceProfileValueFromContext(context, PROFILE.bountifulBlades, 'summons', 2),
      damageMultiplier: balanceProfileValueFromContext(context, PROFILE.bountifulBlades, 'damageMultiplier', 0.66)
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
 * Connected Mesmer runtime.
 */
export function createMesmerRuntime(context: MesmerSchedulerContext): MesmerRuntime {
  const { state, config, catalog } = context;
  // Normalize canonical selected IDs once for all Mesmer controllers.
  const traits = new Set((config.selectedTraitIds || []).map(Number));
  const baseResourceDefinition = mesmerResourceDefinition(config.specialization);
  const resourceDefinition = {
    ...baseResourceDefinition,
    maximum: balanceProfileValueFromContext(
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
    ) as Record<number, MesmerPhantasmAttackTiming>,
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
    balanceProfile: (id: SkillId) => balanceProfileFromContext(context, id),
    controlSkills: new Set(MESMER_CORE_CONTROL_SKILLS),
    blindSkills: new Set(MESMER_CORE_BLIND_SKILLS),
    aristocracySkills: new Set(MESMER_CORE_ARISTOCRACY_SKILLS),
    peithaSkills: new Set(MESMER_CORE_PEITHA_SKILLS),
    peithaProjectileDelays: { ...MESMER_CORE_PEITHA_PROJECTILE_DELAYS }
  };
  const activePrimaryWeapon = () => {
    const weaponSet = state.activeWeaponSet === 1 ? 1 : 2;
    return gw2ActivePrimaryWeapon(config, weaponSet) || '';
  };

  const emit = (event: SimulationEventInput): SimulationEvent | null => {
    const active = runtime.activeEmission;
    // Packets committed by a landed projectile remain scheduled after the player interrupts its cast animation.
    if (active && Number(event.at) > active.effectiveEnd + EPSILON && event.persistsAfterInterrupt !== true) {
      if (event.type !== 'condition' || !active.skill.applyConditionsOnInterrupt) {
        return null;
      }

      return context.emit({
        activationId: active.activationId,
        ...event,
        at: active.effectiveEnd
      });
    }

    const attributed = {
      ...(active ? { activationId: active.activationId } : {}),
      ...event
    };
    if (
      event.type === 'buff' &&
      event.audience &&
      event.audience.recipients !== 'self' &&
      Number(event.at) > state.time + EPSILON
    ) {
      // Party boons select currently active companions when their packet lands, after same-time state changes.
      context.tasks.schedule({
        type: 'mesmer.party-buff',
        at: Number(event.at),
        priority: 10,
        payload: { event: attributed }
      });
      return null;
    }

    return context.emit(attributed);
  };

  const { addEvent, addTraitProc, addCondition, addDamage } = createMesmerEventEmitters({
    context,
    emit,
    activePrimaryWeapon,
    weaponStrength: runtime.weaponStrength
  });

  const scheduleCloneTask = (clone: MesmerClone, at: number) =>
    context.tasks.schedule({
      type: 'mesmer.clone-attack',
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
      type: 'mesmer.resource-gain',
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
      gw2SchedulerBoonDuration(context, { id: TRAIT.MASTER_FENCER, name: 'Master Fencer' }, boon, duration),
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
