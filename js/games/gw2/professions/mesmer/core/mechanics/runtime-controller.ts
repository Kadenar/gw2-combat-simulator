import type { EffectDelivery } from '#gw2/platform/simulation/effect-emission.js';
import { MESMER_CORE_PHANTASM_ATTACK_TIMINGS } from '#gw2/professions/mesmer/core/skills/index.js';
import { bountifulBladesSpawnModifiers, methodOfMadnessDamage } from '#gw2/professions/mesmer/core/traits/behavior.js';
import { EPSILON } from '#kernel/core/clock.js';
/** Connects Core Mesmer resources, profession actions, player effects, and illusions into one simulation runtime. */
import { gw2ActivePrimaryWeapon } from '#gw2/platform/equipment/weapons/loadout.js';
import { createSkillEffectController } from '#gw2/professions/mesmer/core/execution/effect-controller.js';
import type { MesmerCastDetails } from '#gw2/professions/mesmer/core/execution/effect-types.js';
import {
  MESMER_CORE_CLONE_ATTACKS,
  MESMER_CORE_WEAPON_STRENGTH
} from '#gw2/professions/mesmer/core/mechanics/definitions.js';
import { createCloneAttackScheduler } from '#gw2/professions/mesmer/core/mechanics/illusions/clone-attacks.js';
import { createCriticalTraitDispatcher } from '#gw2/professions/mesmer/core/mechanics/illusions/critical-traits.js';
import type {
  MesmerClone,
  MesmerPhantasmAttackTiming
} from '#gw2/professions/mesmer/core/mechanics/illusions/types.js';
import { createProfessionActionController } from '#gw2/professions/mesmer/core/mechanics/profession-actions.js';
import type { MesmerPendingResource } from '#gw2/professions/mesmer/core/mechanics/resource-types.js';
import { createResourceController } from '#gw2/professions/mesmer/core/mechanics/resources.js';
import { resolveCloneShatter } from '#gw2/professions/mesmer/core/mechanics/shatters.js';
import { mesmerProfiledShatters } from '#gw2/professions/mesmer/core/profiles.js';
import { MESMER_CORE_SHATTERS } from '#gw2/professions/mesmer/core/skills/profession-skills.js';
import { mesmerResourceDefinition } from '#gw2/professions/mesmer/family-state.js';
import type { MesmerMechanics, MesmerRuntime } from '#gw2/professions/mesmer/types.js';
import { clamp } from '#kernel/core/numeric.js';

/**
 * Creates and connects all Mesmer feature controllers for one simulation.
 *
 * The returned runtime centralizes event materialization,
 * resource and illusion controllers, cast-local details, and helper functions
 * shared by lifecycle hooks and task handlers. Traits and catalog lookups stay
 * on the canonical context so every controller reads the same build and patch.
 *
 * Connected Mesmer runtime.
 */
export function createMesmerMechanics(context: MesmerRuntime): MesmerMechanics {
  const state = context;
  const { config } = context;
  const resourceDefinition = mesmerResourceDefinition(config.specialization ?? 'Core', context);
  const runtime = {
    context,
    resourceDefinition,
    castDetails: new Map<string, MesmerCastDetails>(),
    weaponStrength: MESMER_CORE_WEAPON_STRENGTH,
    cloneAttacks: MESMER_CORE_CLONE_ATTACKS,
    ambushAttacks: {},
    phantasmAttackTimings: Object.fromEntries(
      Object.entries(MESMER_CORE_PHANTASM_ATTACK_TIMINGS).map(([id, timing]) => [Number(id), { ...timing }])
    ) as Record<number, MesmerPhantasmAttackTiming>,
    phantasmPolicy: {
      spawnModifiers: bountifulBladesSpawnModifiers(context),
      conversionTiming: 'spawn' as const
    },
    traitDamage: {
      'Lesser Chaos Storm': methodOfMadnessDamage(context)
    },
    shatters: mesmerProfiledShatters(context, MESMER_CORE_SHATTERS),
    shatterResolvers: {
      'mesmer.core.clone-shatter': resolveCloneShatter
    },
    shatterResolvedHandlers: [],
    instruments: {}
  };
  const activePrimaryWeapon = () => {
    const weaponSet = state.activeWeaponSet === 1 ? 1 : 2;
    return gw2ActivePrimaryWeapon(config, weaponSet) || '';
  };

  const scheduleCloneTask = (clone: MesmerClone, at: number) =>
    context.schedule('mesmer.clone-attack', at, clone.id, { id: clone.ownerId!, generation: 0 }, -50);
  const cloneAttackScheduler = createCloneAttackScheduler({
    state,
    cloneAttacks: runtime.cloneAttacks,

    scheduleTask: scheduleCloneTask
  });
  // Cancelling the clone owner invalidates its pending attacks on replacement or shatter.
  const destroyClone = (clone: MesmerClone) => context.cancelOwner({ id: clone.ownerId!, generation: 0 });
  const scheduleResourceTask = (candidate: MesmerPendingResource, delivery: EffectDelivery = {}) => {
    // Resource work shares the explicit cast commitment boundary with its originating effects.
    if (delivery.cast?.effectiveEnd != null && candidate.at > delivery.cast.effectiveEnd + EPSILON) return;
    context.schedule('mesmer.resource-gain', Math.max(context.time, candidate.at), candidate);
  };

  const resources = createResourceController({
    state,
    resourceDefinition,
    clamp,
    activePrimaryWeapon,
    cloneAttackScheduler,

    destroyClone,
    scheduleResourceTask
  });
  const criticalTraits = createCriticalTraitDispatcher({
    state
  });
  const actions = createProfessionActionController({
    state,
    resourceDefinition,
    destroyClone,
    shatters: runtime.shatters,
    shatterResolvers: runtime.shatterResolvers,
    warnings: context.warnings
  });
  const skillEffects = createSkillEffectController({
    state,
    resourceDefinition,
    phantasmAttackTimings: runtime.phantasmAttackTimings,
    phantasmPolicy: () => runtime.phantasmPolicy,
    activePrimaryWeapon,
    queueResources: resources.queueResources
  });
  const connectedRuntime: MesmerMechanics = Object.assign(runtime, {
    activePrimaryWeapon,

    cloneAttackScheduler,
    resources,
    criticalTraits,
    actions,
    skillEffects
  });
  return connectedRuntime;
}
