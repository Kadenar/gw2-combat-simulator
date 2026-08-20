import { MESMER_TRAIT_IDS as TRAIT } from '../../data/ids.js';
import { mesmerBalanceValue } from '../../core/profiles.js';
import { mesmerRuntimeFor } from '../../core/runtime.js';
import type { MesmerCastContext, MesmerShatterResolution } from '../../types.js';

/** Refunds one clone only when a Chronomancer shatter commits the configured full-clone threshold. */
export function resolveIllusionaryReversion(context: MesmerCastContext, resolution: MesmerShatterResolution): void {
  const runtime = mesmerRuntimeFor(context);
  if (
    resolution.bladeSong ||
    !runtime.traits.has(TRAIT.ILLUSIONARY_REVERSION) ||
    resolution.spent !== mesmerBalanceValue(context, TRAIT.ILLUSIONARY_REVERSION, 'threshold', 3)
  ) {
    return;
  }

  runtime.resources.queueResources(
    resolution.at + context.epsilon,
    mesmerBalanceValue(context, TRAIT.ILLUSIONARY_REVERSION, 'resourceGain', 1),
    runtime.activePrimaryWeapon(),
    'Illusionary Reversion',
    {
      traitId: TRAIT.ILLUSIONARY_REVERSION,
      traitName: 'Illusionary Reversion'
    }
  );
}
