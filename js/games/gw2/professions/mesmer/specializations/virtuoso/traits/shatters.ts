import { balanceProfileValueFromContext } from '#gw2/platform/combat/state/balance-profiles.js';
import { MESMER_TRAIT_IDS as TRAIT } from '#gw2/professions/mesmer/data/ids.js';

import { mesmerRuntimeFor } from '#gw2/professions/mesmer/core/mechanics/runtime.js';
import type { MesmerCastContext, MesmerShatterResolution } from '#gw2/professions/mesmer/types.js';

/** Refunds blades only after a completed Bladesong commits the configured maximum-spend threshold. */
export function resolveInfiniteForgeRefund(context: MesmerCastContext, resolution: MesmerShatterResolution): void {
  const runtime = mesmerRuntimeFor(context);
  if (
    !runtime.traits.has(TRAIT.INFINITE_FORGE) ||
    resolution.spent < balanceProfileValueFromContext(context, TRAIT.INFINITE_FORGE, 'threshold', 5)
  ) {
    return;
  }

  runtime.resources.queueResources(
    resolution.at + context.epsilon * 2,
    balanceProfileValueFromContext(context, TRAIT.INFINITE_FORGE, 'resourceGain', 2),
    runtime.activePrimaryWeapon(),
    'Infinite Forge refund',
    {
      traitId: TRAIT.INFINITE_FORGE,
      traitName: 'Infinite Forge'
    }
  );
}
