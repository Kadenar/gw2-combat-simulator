import type { MechanicQueriesOf } from '#gw2/platform/profession-definition/mechanic-context.js';
import { gluttonyLifeForceMultiplier } from '#gw2/professions/necromancer/core/traits/soul-reaping/resource-queries.js';
import type { NecromancerRuntime } from '#gw2/professions/necromancer/types.js';

// Separate from the pool policy in resources.ts: passives grant life force while that policy reads passive timing.

/** Converts authored percentages to pool units, sharing capacity and trait scaling across every grant source. */
export function necromancerLifeForceAmount(runtime: MechanicQueriesOf<NecromancerRuntime>, percent: number): number {
  return ((percent * runtime.profession.core.lifeForce.maximum) / 100) * gluttonyLifeForceMultiplier(runtime);
}

/** Grants accepted outcomes directly to the current pool, applying percentage capacity and Gluttony once. */
export function grantNecromancerLifeForce(runtime: NecromancerRuntime, percent: number): void {
  if (!(percent > 0)) return;
  runtime.resourceController.grant('lifeForce', necromancerLifeForceAmount(runtime.queries, percent));
}
