import { reactToJusticeHitWithOptions } from '#gw2/professions/guardian/core/mechanics/virtues.js';
import type { GuardianResolverContext, GuardianResolverEvent } from '#gw2/professions/guardian/types.js';

interface JusticeHitDependencies {
  readonly hitContext?: object;
}

/** Selects Core Justice only at the family boundary; elite modules own their replacement reactions. */
export function reactToCoreGuardianJusticeHit(
  context: GuardianResolverContext,
  event: GuardianResolverEvent,
  dependencies: JusticeHitDependencies = {}
): void {
  if (context.profession.specialization.kind !== 'Core') return;
  reactToJusticeHitWithOptions(context, event, dependencies);
}
