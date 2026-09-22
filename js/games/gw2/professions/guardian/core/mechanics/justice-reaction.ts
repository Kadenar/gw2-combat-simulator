import { reactToJusticeHitWithOptions } from '#gw2/professions/guardian/core/mechanics/virtues.js';
import type { NativeResolvedDamageDetails } from '#gw2/platform/profession-definition/module-types.js';
import type { GuardianResolverContext, GuardianResolverEvent } from '#gw2/professions/guardian/types.js';

/** Selects Core Justice only at the family boundary; elite modules own their replacement reactions. */
export function reactToCoreGuardianJusticeHit(
  context: GuardianResolverContext,
  event: GuardianResolverEvent,
  dependencies: Pick<NativeResolvedDamageDetails, 'hitContext'> = {}
): void {
  if (context.profession.specialization.kind !== 'Core') return;
  reactToJusticeHitWithOptions(context, event, dependencies);
}
