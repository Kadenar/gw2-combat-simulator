import { balanceProfileNumber, requireBalanceProfileFromContext } from '#gw2/platform/skills/balance-profiles.js';
import { SHARED_SKILL_IDS } from '#gw2/platform/skills/shared-actions.js';
import { masterOfFragmentationDuration } from '#gw2/professions/mesmer/core/traits/illusions/index.js';
import { createMesmerActions } from '#gw2/professions/mesmer/family-mechanics.js';
import { createContinuumController } from '#gw2/professions/mesmer/specializations/chronomancer/mechanics/continuum-split.js';
import { CHRONOMANCER_BALANCE_PROFILE_IDS as PROFILE } from '#gw2/professions/mesmer/specializations/chronomancer/profiles.js';
import type { MesmerRuntime } from '#gw2/professions/mesmer/types.js';

const CONTINUUM_UNAFFECTED_COOLDOWN_IDS = new Set<number>([SHARED_SKILL_IDS.SWAP_WEAPONS]);

/** Bind Continuum to its explicit checkpoint state and the recharge owner for this operation. */
export function createChronomancerMechanics(context: MesmerRuntime) {
  const actions = createMesmerActions(context);
  const continuumSplitProfile = requireBalanceProfileFromContext(context, PROFILE.continuumSplit);
  return createContinuumController({
    state: context,
    cooldownController: context.cooldownController,
    unaffectedCooldownIds: CONTINUUM_UNAFFECTED_COOLDOWN_IDS,
    refreshAmmo: context.cooldownController.refreshAmmo,
    consumeResources: actions.consumeResources,
    triggerShatterTraits: actions.triggerShatterTraits,
    durationPerSource: balanceProfileNumber(continuumSplitProfile, 'durationPerTier'),
    bonusDuration: masterOfFragmentationDuration(context),
    scheduleExpiry: (at) => context.schedule('mesmer.continuum-expire', at, at, undefined, -30)
  });
}
