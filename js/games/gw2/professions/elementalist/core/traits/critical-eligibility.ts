import { hasTrait } from '#gw2/platform/builds/selected-traits.js';
import type { MechanicCombatContext } from '#gw2/platform/profession-definition/mechanic-context.js';
import type { NativeResolvedDamageDetails } from '#gw2/platform/profession-definition/module-types.js';
import type { Gw2ResolverEvent } from '#gw2/platform/resolver/types.js';

/** Core critical traits share player-hit eligibility while keeping separate accumulation and ICD state. */
export function criticalTraitEligible(
  context: MechanicCombatContext,
  event: Gw2ResolverEvent,
  details: NativeResolvedDamageDetails,
  traitId: number
): boolean {
  return (
    hasTrait(context, traitId) &&
    event.actorType === 'player' &&
    Number(event.coefficient) > 0 &&
    details.hitContext?.critEligible === true
  );
}
