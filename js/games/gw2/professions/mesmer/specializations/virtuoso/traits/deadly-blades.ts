import {
  requireBalanceProfileFromContext,
  balanceProfileNumber
} from '#gw2/platform/engine/skills/balance-profiles.js';
import { MESMER_TRAIT_IDS as TRAIT } from '#gw2/professions/mesmer/data/ids.js';

import { mesmerMechanicsFor } from '#gw2/professions/mesmer/core/mechanics/runtime.js';
import type { MesmerRuntime } from '#gw2/professions/mesmer/types.js';
import type { MesmerShatterResolution } from '#gw2/professions/mesmer/core/mechanics/shatter-types.js';

/** Activates Deadly Blades only after a successfully resolved Virtuoso Bladesong. */
export function resolveDeadlyBlades(context: MesmerRuntime, resolution: MesmerShatterResolution): void {
  const runtime = mesmerMechanicsFor(context);
  if (!runtime.traits.has(TRAIT.DEADLY_BLADES)) return;

  const at = resolution.at;
  const deadlyBladesProfile = requireBalanceProfileFromContext(context, TRAIT.DEADLY_BLADES);
  runtime.addEvent({
    type: 'buff',
    at,
    // Deadly Blades starts after the Bladesong's same-time resolution work.
    priority: 5,
    kind: 'deadly-blades',
    stacks: 1,
    duration: balanceProfileNumber(deadlyBladesProfile, 'durationMultiplier')
  });
  runtime.addTraitProc('Deadly Blades', at, resolution.skill.name);
}
