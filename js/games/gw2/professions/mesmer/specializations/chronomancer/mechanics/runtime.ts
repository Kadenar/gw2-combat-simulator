import { hasTrait } from '#gw2/platform/combat/state/traits.js';
import { SHARED_SKILL_IDS } from '#gw2/platform/skills/shared-actions.js';
import {
  requireBalanceProfileFromContext,
  balanceProfileNumber
} from '#gw2/platform/engine/skills/balance-profiles.js';
import { MESMER_TRAIT_IDS as TRAIT } from '#gw2/professions/mesmer/data/ids.js';
import { applyMesmerRuntimeManifest, mesmerMechanicsFor } from '#gw2/professions/mesmer/core/mechanics/runtime.js';
import { createContinuumController } from '#gw2/professions/mesmer/specializations/chronomancer/mechanics/continuum-split.js';
import {
  resolveChronomancerShatterBoons,
  resolveIllusionaryReversion
} from '#gw2/professions/mesmer/specializations/chronomancer/traits/shatters.js';
import { MESMER_CHRONOMANCER_PHANTASM_ATTACK_TIMINGS } from '#gw2/professions/mesmer/specializations/chronomancer/mechanics/definitions.js';
import { MESMER_CHRONOMANCER_SHATTERS } from '#gw2/professions/mesmer/specializations/chronomancer/skills/index.js';
import type { MesmerMechanics, MesmerRuntime } from '#gw2/professions/mesmer/types.js';
import {
  CHRONOMANCER_BALANCE_PROFILE_IDS as PROFILE,
  CHRONOMANCER_SHATTER_PROFILE_IDS
} from '#gw2/professions/mesmer/specializations/chronomancer/profiles.js';
import { mesmerProfiledShatters } from '#gw2/professions/mesmer/core/profiles.js';
import type { MesmerContinuumController } from '#gw2/professions/mesmer/specializations/chronomancer/types.js';

const CONTINUUM_UNAFFECTED_COOLDOWN_IDS = new Set<number>([SHARED_SKILL_IDS.SWAP_WEAPONS]);

/** Returns the controller installed only by the Chronomancer runtime. */
export function chronomancerControllerFor(runtime: MesmerMechanics): MesmerContinuumController {
  if (!runtime.continuum) throw new Error('Chronomancer runtime is not initialized.');
  return runtime.continuum;
}

export function initializeChronomancerRuntime(context: MesmerRuntime): void {
  const runtime = mesmerMechanicsFor(context);
  applyMesmerRuntimeManifest(runtime, {
    shatters: mesmerProfiledShatters(context, MESMER_CHRONOMANCER_SHATTERS, CHRONOMANCER_SHATTER_PROFILE_IDS),
    shatterResolvedHandlers: [resolveChronomancerShatterBoons, resolveIllusionaryReversion],
    phantasmAttackTimings: MESMER_CHRONOMANCER_PHANTASM_ATTACK_TIMINGS,
    phantasmPolicy: hasTrait(context, TRAIT.CHRONOPHANTASMA)
      ? {
          repeat: {
            label: 'Chronophantasma',
            traitName: 'Chronophantasma',
            damageMultiplier: balanceProfileNumber(
              requireBalanceProfileFromContext(context, PROFILE.chronophantasma),
              'damageMultiplier'
            )
          }
        }
      : undefined
  });
  for (const skill of context.helpers.skills) {
    context.cooldownController.ensureAmmo(skill, 0);
  }

  const continuumSplitProfile = requireBalanceProfileFromContext(context, PROFILE.continuumSplit);
  const continuum = createContinuumController({
    state: context,
    cooldownController: context.cooldownController,
    unaffectedCooldownIds: CONTINUUM_UNAFFECTED_COOLDOWN_IDS,
    refreshAmmo: context.cooldownController.refreshAmmo,
    consumeResources: runtime.actions.consumeResources,
    triggerShatterTraits: runtime.actions.triggerShatterTraits,
    addEvent: runtime.addEvent,
    durationPerSource: balanceProfileNumber(continuumSplitProfile, 'durationPerTier'),
    bonusDuration: hasTrait(context, TRAIT.MASTER_OF_FRAGMENTATION)
      ? balanceProfileNumber(
          requireBalanceProfileFromContext(context, TRAIT.MASTER_OF_FRAGMENTATION),
          'durationMultiplier'
        )
      : 0,
    scheduleExpiry: (at) => context.schedule('mesmer.continuum-expire', at, at, undefined, -30)
  });
  runtime.continuum = continuum;
}
