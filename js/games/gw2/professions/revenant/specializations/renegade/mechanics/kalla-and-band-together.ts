import type { RenegadeState } from '#gw2/professions/revenant/specializations/renegade/state.js';

/** Returns whether the one-use Band Together enhancement is active at `at`. */
export function isBandTogetherReady(state: Partial<RenegadeState>, at: number): boolean {
  return Boolean(state.bandTogetherReady) && Number(state.bandTogetherExpiresAt || 0) > at;
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
    (state.kallasFervor || []).filter(
      (application) => Number(application.at || 0) <= at && Number(application.expiresAt || 0) > at
    ).length
  );
}
