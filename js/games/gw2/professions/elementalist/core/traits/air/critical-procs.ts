import { hasTrait } from '#gw2/platform/builds/selected-traits.js';
import type { MechanicQueriesOf } from '#gw2/platform/profession-definition/mechanic-context.js';
import { ELEMENTALIST_TRAIT_IDS as TRAIT } from '#gw2/professions/elementalist/data/ids.js';
import type { ElementalistRuntime } from '#gw2/professions/elementalist/types.js';

/** Pending damage supplies a wake, never a predicted resource or critical result. */
export function projectedFreshAirReadyAt(context: MechanicQueriesOf<ElementalistRuntime>, upTo: number): number | null {
  if (!hasTrait(context, TRAIT.FRESH_AIR)) return null;
  const core = context.profession.core;
  if (core.primaryAttunement === 'Air') return null;
  // Readiness queries ignore elapsed wakes without pruning the live scheduler's candidates.
  const times = core.freshAirCandidates.filter((at) => at > context.time && at <= upTo);
  return times.length ? Math.min(...times) : null;
}
