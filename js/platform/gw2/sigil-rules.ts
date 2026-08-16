import { SIGIL_DATA } from "./sigil-data.js";
import {
  FEROCITY_PER_CRITICAL_DAMAGE_MULTIPLIER,
  PRECISION_PER_CRITICAL_CHANCE_FRACTION,
} from "./stat-scaling.js";

import type { Gw2CriticalChanceContributor, Gw2QueryRuntime } from "./types.js";

export interface Gw2SigilCriticalContribution {
  readonly chance: number;
  readonly damage: number;
  readonly chanceContributors: readonly Gw2CriticalChanceContributor[];
}

const NO_CRITICAL_CONTRIBUTION: Readonly<Gw2SigilCriticalContribution> =
  Object.freeze({
    chance: 0,
    damage: 0,
    chanceContributors: Object.freeze([]),
  });

/** Returns active, additive critical modifiers supplied by sigil effects. */
export function sigilCriticalContribution(
  runtime: Gw2QueryRuntime | null | undefined,
  at: number,
): Readonly<Gw2SigilCriticalContribution> {
  if (!(Number(runtime?.sigil?.severanceUntil || 0) > at)) {
    return NO_CRITICAL_CONTRIBUTION;
  }
  const severance = SIGIL_DATA.Severance;
  const chance =
    Number(severance.procPrecision || 0) /
    PRECISION_PER_CRITICAL_CHANCE_FRACTION;
  return {
    chance,
    damage:
      Number(severance.procFerocity || 0) /
      FEROCITY_PER_CRITICAL_DAMAGE_MULTIPLIER,
    chanceContributors: [
      {
        id: "sigil-severance",
        label: "Sigil of Severance",
        amount: chance,
      },
    ],
  };
}
