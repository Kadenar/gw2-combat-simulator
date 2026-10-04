import type { MechanicQueriesOf } from '#gw2/platform/profession-definition/mechanic-context.js';
import type { RenegadeState } from '#gw2/professions/revenant/specializations/renegade/state.js';
import { RENEGADE_ENHANCED_SKILL_BY_ID } from '#gw2/professions/revenant/data/renegade-enhanced-skills.js';
import { renegadeState } from '#gw2/professions/revenant/specializations/renegade/state.js';
import type { SkillId } from '#gw2/platform/engine/skills/types.js';
import type { RevenantRuntime } from '#gw2/professions/revenant/core/events.js';

/** Returns whether the one-use Band Together enhancement is active at `at`. */
export function isBandTogetherReady(state: Partial<RenegadeState>, at: number): boolean {
  return Boolean(state.bandTogetherReady) && (state.bandTogetherExpiresAt || 0) > at;
}

/** Counts started, unexpired Fervor applications consistently for grants, modifiers, and siphons. */
export function activeKallasFervorStacks(
  state: {
    readonly kallasFervor?: readonly Readonly<RenegadeState['kallasFervor'][number]>[];
    readonly kallasFervorMaximumStacks?: number;
  },
  at: number,
  maximumStacks = state.kallasFervorMaximumStacks
): number {
  return Math.min(
    Math.max(1, Number(maximumStacks)),
    (state.kallasFervor || []).filter((application) => (application.at || 0) <= at && (application.expiresAt || 0) > at)
      .length
  );
}

export function bandTogetherReady(runtime: MechanicQueriesOf<RevenantRuntime>, skillId: SkillId): boolean {
  return (
    RENEGADE_ENHANCED_SKILL_BY_ID[Number(skillId)] != null &&
    isBandTogetherReady(renegadeState.from(runtime), runtime.time)
  );
}
