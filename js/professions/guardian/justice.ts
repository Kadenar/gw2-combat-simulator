import { reactToJusticeHitWithOptions } from './core/virtues.js';
import type { GuardianResolverContext, GuardianResolverEvent } from './types.js';

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
