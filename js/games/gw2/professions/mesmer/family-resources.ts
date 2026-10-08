import { gw2ActivePrimaryWeapon } from '#gw2/platform/equipment/weapons/loadout.js';
import { createCloneAttackScheduler } from '#gw2/professions/mesmer/core/mechanics/illusions/clone-attacks.js';
import type { MesmerClone } from '#gw2/professions/mesmer/core/mechanics/illusions/types.js';
import { createIllusionRewardController } from '#gw2/professions/mesmer/core/mechanics/resources.js';
import { MESMER_CORE_CLONE_ATTACKS } from '#gw2/professions/mesmer/core/skills/weapons/clone-attacks.js';
import { mesmerResourceDefinition } from '#gw2/professions/mesmer/family-state.js';
import { createMirageMechanics } from '#gw2/professions/mesmer/specializations/mirage/mechanics/runtime.js';
import { reactToMirageResourceGain } from '#gw2/professions/mesmer/specializations/mirage/traits/behavior.js';
import type { MesmerRuntime } from '#gw2/professions/mesmer/types.js';
import { canonicalTime } from '#kernel/core/clock.js';

export function mesmerActivePrimaryWeapon(context: MesmerRuntime): string {
  return gw2ActivePrimaryWeapon(context.config, context.activeWeaponSet === 1 ? 1 : 2) || '';
}

export function destroyClone(context: MesmerRuntime, clone: MesmerClone): void {
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
export function createMesmerIllusionRewards(context: MesmerRuntime) {
  return createIllusionRewardController({
    state: context,
    resourceDefinition: mesmerResourceDefinition(context.profession.specialization.kind, context),
    activePrimaryWeapon: () => mesmerActivePrimaryWeapon(context),
    cloneAttackScheduler: createMesmerCloneScheduler(context),
    destroyClone: (clone) => destroyClone(context, clone),
    onGain: (gain) => {
      if (context.profession.specialization.kind === 'Mirage')
        reactToMirageResourceGain(context, gain, (at, clones) =>
          createMirageMechanics(context).executeCloneAmbushes(at, clones)
        );
    },
    scheduleResourceTask(candidate, delivery = {}) {
      // An unbounded delivery belongs to an already committed actor; finite cutoffs remain exact.
      if (
        delivery.cast?.effectiveEnd != null &&
        delivery.cast.effectiveEnd !== Infinity &&
        canonicalTime(candidate.at) > canonicalTime(delivery.cast.effectiveEnd)
      )
        return;
      context.schedule('mesmer.resource-gain', Math.max(context.time, candidate.at), candidate);
    }
  });
}
