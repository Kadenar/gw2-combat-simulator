import { EPSILON } from '#kernel/core/clock.js';
/** Connects Core Mesmer resources, profession actions, player effects, and illusions into one simulation runtime. */
import {
  balanceProfileFromContext,
  requireBalanceProfileFromContext,
  balanceProfileNumber
} from '#gw2/platform/engine/skills/balance-profiles.js';
import { gw2ActivePrimaryWeapon } from '#gw2/platform/equipment/weapons/loadout.js';
import type { SimulationEvent, SimulationEventBase } from '#gw2/platform/engine/events/events.js';
import type { SkillId } from '#gw2/platform/engine/skills/types.js';
import { gw2ResolverBoonDuration } from '#gw2/platform/resolver/boons.js';
import { emitMesmerPacket } from '#gw2/professions/mesmer/core/events.js';
import { MESMER_SKILL_IDS as ID, MESMER_TRAIT_IDS as TRAIT } from '#gw2/professions/mesmer/data/ids.js';
import { mesmerResourceDefinition } from '#gw2/professions/mesmer/family-state.js';
import type { MesmerMechanics, MesmerRuntime } from '#gw2/professions/mesmer/types.js';
import {
  MESMER_CORE_CLONE_ATTACKS,
  MESMER_CORE_PHANTASM_ATTACK_TIMINGS,
  MESMER_CORE_SHATTERS,
  MESMER_CORE_TRAIT_DAMAGE,
  MESMER_CORE_WEAPON_STRENGTH
} from '#gw2/professions/mesmer/core/mechanics/definitions.js';
import { createProfessionActionController } from '#gw2/professions/mesmer/core/mechanics/profession-actions.js';
import { createResourceController } from '#gw2/professions/mesmer/core/mechanics/resources.js';
import { resolveCloneShatter } from '#gw2/professions/mesmer/core/mechanics/shatters.js';
import {
  MESMER_CORE_BALANCE_PROFILE_IDS as PROFILE,
  MESMER_CORE_SHATTER_PROFILE_IDS,
  mesmerProfiledShatters,
  mesmerProfiledTraitDamage
} from '#gw2/professions/mesmer/core/profiles.js';
import { createSkillEffectController } from '#gw2/professions/mesmer/core/execution/effect-controller.js';
import { createCloneAttackScheduler } from '#gw2/professions/mesmer/core/mechanics/illusions/clone-attacks.js';
import { createCriticalTraitDispatcher } from '#gw2/professions/mesmer/core/mechanics/illusions/critical-traits.js';
import { createMesmerEventEmitters } from '#gw2/professions/mesmer/core/mechanics/illusions/event-emission.js';
import type { MesmerActiveEmission, MesmerCastDetails } from '#gw2/professions/mesmer/core/execution/effect-types.js';
import type {
  MesmerClone,
  MesmerPhantasmAttackTiming
} from '#gw2/professions/mesmer/core/mechanics/illusions/types.js';
import type { MesmerPendingResource } from '#gw2/professions/mesmer/core/mechanics/resource-types.js';
import type { MesmerSkill } from '#gw2/professions/mesmer/data/types.js';
import { clamp } from '#kernel/core/numeric.js';

/** Builds Core trait variations consumed by the shared phantasm lifecycle. */
function runtimeTraitsPhantasmSpawnModifiers(
  context: MesmerRuntime,
  traits: ReadonlySet<number>
): Record<number, { countMultiplier: number; damageMultiplier: number }> {
  if (!traits.has(TRAIT.BOUNTIFUL_BLADES)) return {};
  const bountifulBladesProfile = requireBalanceProfileFromContext(context, PROFILE.bountifulBlades);
  return {
    [ID.PHANTASMAL_BERSERKER]: {
      countMultiplier: balanceProfileNumber(bountifulBladesProfile, 'summons'),
      damageMultiplier: balanceProfileNumber(bountifulBladesProfile, 'damageMultiplier')
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
export function createMesmerMechanics(context: MesmerRuntime): MesmerMechanics {
  const state = context;
  const { config } = context;
  const catalog = context.helpers as import('#gw2/platform/engine/skills/types.js').CanonicalCatalog<MesmerSkill>;
  // Normalize canonical selected IDs once for all Mesmer controllers.
  const traits = new Set((config.selectedTraitIds || []).map(Number));
  const resourceDefinition = mesmerResourceDefinition(config.specialization ?? 'Core', context);
  const skillsById = catalog.skillsById;
  const allSkills = catalog.skills;
  const flipSkillsByParent = new Map<SkillId, MesmerSkill>(
    allSkills.flatMap((skill) => (skill.flipParentId == null ? [] : ([[skill.flipParentId, skill]] as const)))
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
    balanceProfile: (id: SkillId) => balanceProfileFromContext(context, id)
  };
  const activePrimaryWeapon = () => {
    const weaponSet = state.activeWeaponSet === 1 ? 1 : 2;
    return gw2ActivePrimaryWeapon(config, weaponSet) || '';
  };

  const emit = (event: SimulationEventBase): SimulationEvent | null => {
    const active = runtime.activeEmission;
    // Packets committed by a landed projectile remain scheduled after the player interrupts its cast animation.
    if (active && Number(event.at) > active.effectiveEnd + EPSILON && event.persistsAfterInterrupt !== true) {
      if (event.type !== 'condition' || !active.skill.applyConditionsOnInterrupt) {
        return null;
      }

      return context.emit({
        activationId: active.activationId,
        offTarget: active.offTarget,
        ...event,
        at: active.effectiveEnd
      });
    }

    const attributed = {
      ...(active
        ? {
            // Trait projectiles own their strength roll; the originating cast still supplies interruption and targeting.
            activationId:
              event.type === 'damage' && event.sourceId !== active.skill.id
                ? `${active.activationId}:mesmer:${event.sourceId}`
                : active.activationId,
            offTarget: active.offTarget
          }
        : {}),
      ...event
    };
    return emitMesmerPacket(context, attributed);
  };

  const { addEvent, addTraitProc, addCondition, addDamage } = createMesmerEventEmitters({
    context,
    emit,
    activePrimaryWeapon,
    weaponStrength: runtime.weaponStrength
  });

  const scheduleCloneTask = (clone: MesmerClone, at: number) =>
    context.schedule('mesmer.clone-attack', at, clone.id, { id: clone.ownerId!, generation: 0 }, -50);
  const cloneAttackScheduler = createCloneAttackScheduler({
    state,
    cloneAttacks: runtime.cloneAttacks,
    addDamage,
    addCondition,
    scheduleTask: scheduleCloneTask
  });
  const destroyClone = (clone: MesmerClone, _at: number) => context.cancelOwner({ id: clone.ownerId!, generation: 0 });
  const scheduleResourceTask = (candidate: MesmerPendingResource) => {
    if (runtime.activeEmission && candidate.at > runtime.activeEmission.effectiveEnd + EPSILON) return;
    context.schedule('mesmer.resource-gain', Math.max(context.time, candidate.at), candidate);
  };

  const resources = createResourceController({
    state,
    traits,
    resourceDefinition,
    clamp,
    activePrimaryWeapon,
    cloneAttackScheduler,
    addEvent,
    addTraitProc,
    destroyClone,
    scheduleResourceTask,
    balanceProfile: runtime.balanceProfile
  });
  const criticalTraits = createCriticalTraitDispatcher({
    state,
    traits,
    emitEvent: (cause, event) => context.emitDerived(cause, event),
    boonDuration: (boon, duration) =>
      gw2ResolverBoonDuration(
        context,
        { type: 'buff', at: context.time, source: 'Trait', sourceId: TRAIT.MASTER_FENCER, actorType: 'player' },
        boon,
        duration
      ),
    addTraitProc,
    balanceProfile: runtime.balanceProfile
  });
  const actions = createProfessionActionController({
    state,
    traits,
    resourceDefinition,
    destroyClone,
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
    cooldownController: context.cooldownController,
    traits,
    resourceDefinition,
    phantasmAttackTimings: runtime.phantasmAttackTimings,
    phantasmPolicy: () => runtime.phantasmPolicy,
    allSkills,
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
  const connectedRuntime: MesmerMechanics = Object.assign(runtime, {
    activePrimaryWeapon,
    addEvent,
    addTraitProc,
    addCondition,
    addDamage,
    cloneAttackScheduler,
    destroyClone,
    resources,
    criticalTraits,
    actions,
    skillEffects
  });
  return connectedRuntime;
}
