import type { NativeResolvedDamageDetails } from '#gw2/platform/profession-definition/module-types.js';
import type { Gw2ResolverEvent } from '#gw2/platform/resolver/types.js';

/** Core critical traits share player-hit eligibility while keeping separate accumulation and ICD state. */
export function criticalTraitEligible(event: Gw2ResolverEvent, details: NativeResolvedDamageDetails): boolean {
  return event.actorType === 'player' && Number(event.coefficient) > 0 && details.hitContext?.critEligible === true;
}
