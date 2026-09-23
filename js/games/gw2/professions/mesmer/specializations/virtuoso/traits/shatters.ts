import {
  requireBalanceProfileFromContext,
  balanceProfileNumber
} from '#gw2/platform/engine/skills/balance-profiles.js';
import { MESMER_TRAIT_IDS as TRAIT } from '#gw2/professions/mesmer/data/ids.js';

import { mesmerRuntimeFor } from '#gw2/professions/mesmer/core/mechanics/runtime.js';
import type { MesmerCastContext } from '#gw2/professions/mesmer/types.js';
import type { MesmerShatterResolution } from '#gw2/professions/mesmer/core/mechanics/shatter-types.js';

/** Refunds blades only after a completed Bladesong commits the configured maximum-spend threshold. */
export function resolveInfiniteForgeRefund(context: MesmerCastContext, resolution: MesmerShatterResolution): void {
  const runtime = mesmerRuntimeFor(context);
  if (
    !runtime.traits.has(TRAIT.INFINITE_FORGE) ||
    resolution.spent <
      balanceProfileNumber(requireBalanceProfileFromContext(context, TRAIT.INFINITE_FORGE), 'threshold')
  ) {
    return;
  }

  const infiniteForgeProfile = requireBalanceProfileFromContext(context, TRAIT.INFINITE_FORGE);
  runtime.resources.queueResources(
    resolution.at,
    balanceProfileNumber(infiniteForgeProfile, 'resourceGain'),
    runtime.activePrimaryWeapon(),
    'Infinite Forge refund',
    {
      traitId: TRAIT.INFINITE_FORGE,
      traitName: 'Infinite Forge'
    }
  );
}
