import { heraldState } from '#gw2/professions/revenant/specializations/herald/state.js';
import type { SkillId } from '#gw2/platform/skills/types.js';
import type { RevenantRuntime } from '#gw2/professions/revenant/core/events.js';

export const FACET_PULSE = 'revenant.herald-facet-pulse';

/** Each facet pulse is identified by its scheduled instant; reactivation or expiry leaves stale pulses inert. */
export function scheduleFacetPulse(runtime: RevenantRuntime, skillId: SkillId, at: number): void {
  heraldState.from(runtime).facetPulseReadyAt[skillId] = at;
  runtime.schedule(FACET_PULSE, at, { skillId });
}
