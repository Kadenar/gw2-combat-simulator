import { clamp } from '../numeric.js';

import type { Gw2Config } from '../../simulation/config.js';

export interface Gw2TargetDamageState {
  readonly totals?: {
    readonly strike?: number;
    readonly condition?: number;
  };
  readonly environmentDamage?: number;
}

/** Keeps player attribution separate while exposing the damage that actually reduced target health. */
export function playerDamageTotal(state: Gw2TargetDamageState | null | undefined): number {
  return Number(state?.totals?.strike || 0) + Number(state?.totals?.condition || 0);
}

/** Returns non-player damage dealt by the configured encounter environment. */
export function environmentDamageTotal(state: Gw2TargetDamageState | null | undefined): number {
  return Number(state?.environmentDamage || 0);
}

/** Central target-health damage total includes both player output and environment-owned damage. */
export function combinedTargetDamage(state: Gw2TargetDamageState | null | undefined): number {
  return playerDamageTotal(state) + environmentDamageTotal(state);
}

/** Resolves remaining target health from every damage owner, or null when health is unbounded. */
export function remainingTargetHealthFraction(
  config: Pick<Gw2Config, 'target'> | null | undefined,
  state: Gw2TargetDamageState | null | undefined
): number | null {
  const maximum = Number(config?.target?.health || 0);
  if (!(maximum > 0)) return null;
  return clamp(1 - combinedTargetDamage(state) / maximum, 0, 1);
}
