import type { SkillId } from '#gw2/platform/skills/types.js';
import type { RevenantRuntime } from '#gw2/professions/revenant/core/events.js';
import type { RevenantCoreState } from '#gw2/professions/revenant/core/state.js';
import type { HeraldState } from '#gw2/professions/revenant/specializations/herald/state.js';
import { heraldState } from '#gw2/professions/revenant/specializations/herald/state.js';

export const FACET_PULSE = 'revenant.herald-facet-pulse';

/** Each facet pulse is identified by its scheduled instant; reactivation or expiry leaves stale pulses inert. */
export function scheduleFacetPulse(runtime: RevenantRuntime, skillId: SkillId, at: number): void {
  heraldState.from(runtime).facetPulseReadyAt[skillId] = at;
  runtime.schedule(FACET_PULSE, at, { skillId });
}

/** Active upkeep and retained passives share eligibility, but only upkeep drains Energy. */
export function heraldFacetPassiveActive(
  core: Partial<RevenantCoreState>,
  state: Partial<HeraldState>,
  skillId: SkillId,
  at: number
): boolean {
  const lingering = state.lingeringFacets?.[skillId];
  return Boolean(
    core.activeUpkeeps?.some((upkeep) => upkeep.skillId === skillId && (upkeep.startsAt || 0) <= at) ||
    (lingering && lingering.startsAt <= at && at < lingering.expiresAt)
  );
}
