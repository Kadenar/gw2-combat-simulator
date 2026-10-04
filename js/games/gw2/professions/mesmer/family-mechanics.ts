import { gw2ActivePrimaryWeapon } from '#gw2/platform/equipment/weapons/loadout.js';
import { createSkillEffectController } from '#gw2/professions/mesmer/core/execution/effect-controller.js';
import { MESMER_CORE_CLONE_ATTACKS } from '#gw2/professions/mesmer/core/mechanics/definitions.js';
import { createCloneAttackScheduler } from '#gw2/professions/mesmer/core/mechanics/illusions/clone-attacks.js';
import type {
  MesmerClone,
  MesmerPhantasmPolicy,
  MesmerPhantasmAttackTiming
} from '#gw2/professions/mesmer/core/mechanics/illusions/types.js';
import { createProfessionActionController } from '#gw2/professions/mesmer/core/mechanics/profession-actions.js';
import { createResourceController } from '#gw2/professions/mesmer/core/mechanics/resources.js';
import { resolveCloneShatter } from '#gw2/professions/mesmer/core/mechanics/shatters.js';
import type { MesmerShatterResolution } from '#gw2/professions/mesmer/core/mechanics/shatter-types.js';
import { mesmerProfiledShatters } from '#gw2/professions/mesmer/core/profiles.js';
import { MESMER_CORE_SHATTERS } from '#gw2/professions/mesmer/core/skills/profession-skills.js';
import { bountifulBladesSpawnModifiers } from '#gw2/professions/mesmer/core/traits/behavior.js';
import { mesmerResourceDefinition } from '#gw2/professions/mesmer/family-state.js';
import { MESMER_CHRONOMANCER_PHANTASM_ATTACK_TIMINGS } from '#gw2/professions/mesmer/specializations/chronomancer/mechanics/definitions.js';
import { MESMER_CHRONOMANCER_SHATTERS } from '#gw2/professions/mesmer/specializations/chronomancer/skills/index.js';
import {
  chronophantasmaPolicy,
  resolveChronomancerShatterBoons,
  resolveIllusionaryReversion
} from '#gw2/professions/mesmer/specializations/chronomancer/traits/behavior.js';
import { createMirageMechanics } from '#gw2/professions/mesmer/specializations/mirage/mechanics/runtime.js';
import { reactToMirageResourceGain } from '#gw2/professions/mesmer/specializations/mirage/traits/behavior.js';
import { resolveBladesong } from '#gw2/professions/mesmer/specializations/virtuoso/mechanics/bladesongs.js';
import { MESMER_VIRTUOSO_PHANTASM_ATTACK_TIMINGS } from '#gw2/professions/mesmer/specializations/virtuoso/mechanics/definitions.js';
import { MESMER_VIRTUOSO_SHATTERS } from '#gw2/professions/mesmer/specializations/virtuoso/skills/index.js';
import {
  phantasmalBladesDamage,
  phantasmalBladesPolicy,
  resolveDeadlyBlades,
  resolveInfiniteForgeRefund
} from '#gw2/professions/mesmer/specializations/virtuoso/traits/behavior.js';
import type { MesmerRuntime } from '#gw2/professions/mesmer/types.js';
import { EPSILON } from '#kernel/core/clock.js';
import { clamp } from '#kernel/core/numeric.js';

/** Select content from the build and patch directly; no initialization or context-identity lookup is required. */
export function mesmerShatters(context: MesmerRuntime) {
  const specialization = context.profession.specialization.kind;
  return mesmerProfiledShatters(context, {
    ...MESMER_CORE_SHATTERS,
    ...(specialization === 'Chronomancer'
      ? MESMER_CHRONOMANCER_SHATTERS
      : specialization === 'Virtuoso'
        ? MESMER_VIRTUOSO_SHATTERS
        : {})
  });
}

export function mesmerActivePrimaryWeapon(context: MesmerRuntime): string {
  return gw2ActivePrimaryWeapon(context.config, context.activeWeaponSet === 1 ? 1 : 2) || '';
}

function destroyClone(context: MesmerRuntime, clone: MesmerClone): void {
  context.cancelOwner({ id: clone.ownerId!, generation: 0 });
}

/** These short-lived operations retain no private run state; clone identity and progress belong to profession state. */
export function createMesmerCloneScheduler(context: MesmerRuntime) {
  return createCloneAttackScheduler({
    state: context,
    cloneAttacks: MESMER_CORE_CLONE_ATTACKS,
    scheduleTask: (clone, at) =>
      context.schedule('mesmer.clone-attack', at, clone.id, { id: clone.ownerId!, generation: 0 }, -50)
  });
}

/** Resource reactions are selected explicitly rather than registered into a live service container. */
export function createMesmerResources(context: MesmerRuntime) {
  return createResourceController({
    state: context,
    resourceDefinition: mesmerResourceDefinition(context.profession.specialization.kind, context),
    clamp,
    activePrimaryWeapon: () => mesmerActivePrimaryWeapon(context),
    cloneAttackScheduler: createMesmerCloneScheduler(context),
    destroyClone: (clone) => destroyClone(context, clone),
    onGain: (gain) => {
      if (context.profession.specialization.kind === 'Mirage') reactToMirageResourceGain(context, gain);
    },
    scheduleResourceTask(candidate, delivery = {}) {
      if (delivery.cast?.effectiveEnd != null && candidate.at > delivery.cast.effectiveEnd + EPSILON) return;
      context.schedule('mesmer.resource-gain', Math.max(context.time, candidate.at), candidate);
    }
  });
}

/** Bind only shatter operations; their reservations and refunds mutate the caller's owned state. */
export function createMesmerActions(context: MesmerRuntime) {
  return createProfessionActionController({
    state: context,
    resourceDefinition: mesmerResourceDefinition(context.profession.specialization.kind, context),
    destroyClone: (clone) => destroyClone(context, clone),
    shatters: mesmerShatters(context),
    shatterResolvers: {
      'mesmer.core.clone-shatter': resolveCloneShatter,
      'mesmer.virtuoso.bladesong': resolveBladesong
    },
    warn: context.combat.warn
  });
}

/** Preserve specialization reaction order after the core resource transaction has committed. */
export function dispatchShatterResolved(context: MesmerRuntime, resolution: MesmerShatterResolution): void {
  switch (context.profession.specialization.kind) {
    case 'Chronomancer':
      resolveChronomancerShatterBoons(context, resolution);
      resolveIllusionaryReversion(context, resolution);
      break;
    case 'Virtuoso':
      resolveDeadlyBlades(context, resolution);
      resolveInfiniteForgeRefund(context, resolution);
      break;
    case 'Mirage':
      createMirageMechanics(context).handleMirageShatter(
        resolution.skill,
        resolution.at,
        resolution.spent,
        resolution.delivery
      );
      break;
  }
}

/** Select phantasm content and policies for this call without storing controllers or tables on a run registry. */
export function createMesmerSkillEffects(context: MesmerRuntime) {
  const specialization = context.profession.specialization.kind;
  const policy: MesmerPhantasmPolicy = {
    spawnModifiers: bountifulBladesSpawnModifiers(context),
    conversionTiming: 'spawn'
  };
  const selectedPolicy =
    specialization === 'Chronomancer'
      ? chronophantasmaPolicy(context)
      : specialization === 'Virtuoso'
        ? {
            conversionTiming: 'blade-tick' as const,
            ...phantasmalBladesPolicy(context, phantasmalBladesDamage(context))
          }
        : {};
  const timings = Object.fromEntries(
    context.helpers.skills.flatMap((skill) => (skill.phantasmTiming ? [[skill.id, skill.phantasmTiming]] : []))
  ) as Record<number, MesmerPhantasmAttackTiming>;
  const overrides =
    specialization === 'Chronomancer'
      ? MESMER_CHRONOMANCER_PHANTASM_ATTACK_TIMINGS
      : specialization === 'Virtuoso'
        ? MESMER_VIRTUOSO_PHANTASM_ATTACK_TIMINGS
        : {};
  for (const [id, timing] of Object.entries(overrides)) timings[Number(id)] = { ...timings[Number(id)], ...timing };
  return createSkillEffectController({
    state: context,
    resourceDefinition: mesmerResourceDefinition(specialization, context),
    phantasmAttackTimings: timings,
    phantasmPolicy: () => ({
      ...policy,
      ...selectedPolicy,
      spawnModifiers: { ...policy.spawnModifiers, ...selectedPolicy?.spawnModifiers }
    }),
    activePrimaryWeapon: () => mesmerActivePrimaryWeapon(context),
    queueResources: createMesmerResources(context).queueResources
  });
}
