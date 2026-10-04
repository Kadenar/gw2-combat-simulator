import type { Gw2Config } from '#gw2/platform/simulation/config.js';
import { clamp } from '#kernel/core/numeric.js';

interface Gw2TargetDamageState {
  readonly totals?: {
    readonly strike?: number;
    readonly condition?: number;
  };
  readonly environmentDamage?: number;
}

/** Keeps player attribution separate while exposing the damage that actually reduced target health. */
export function playerDamageTotal(state: Gw2TargetDamageState | null | undefined): number {
  return (state?.totals?.strike || 0) + (state?.totals?.condition || 0);
}

/** Returns non-player damage dealt by the configured encounter environment. */
function environmentDamageTotal(state: Gw2TargetDamageState | null | undefined): number {
  return state?.environmentDamage || 0;
}

/** Central target-health damage total includes both player output and environment-owned damage. */
function combinedTargetDamage(state: Gw2TargetDamageState | null | undefined): number {
  return playerDamageTotal(state) + environmentDamageTotal(state);
}

/** Includes health missing at combat start so every threshold uses the same effective loss. */
export function targetHealthLoss(
  config: Pick<Gw2Config, 'target'> | null | undefined,
  state: Gw2TargetDamageState | null | undefined
): number {
  const maximum = config?.target?.health || 0;
  // Isolated measurements hold a declared target state; ordinary simulations still subtract all resolved damage.
  if (config?.target?.fixedHealthFraction != null)
    return maximum * (1 - clamp(config.target.fixedHealthFraction, 0, 1));
  const configured = Number(config?.target?.startingHealthFraction);
  const startingFraction = Number.isFinite(configured) ? clamp(configured, 0, 1) : 1;
  return maximum * (1 - startingFraction) + combinedTargetDamage(state);
}

/** Resolves remaining target health from every damage owner, or null when health is unbounded. */
export function remainingTargetHealthFraction(
  config: Pick<Gw2Config, 'target'> | null | undefined,
  state: Gw2TargetDamageState | null | undefined
): number | null {
  if (config?.target?.fixedHealthFraction != null) return clamp(config.target.fixedHealthFraction, 0, 1);
  const maximum = config?.target?.health || 0;
  if (!(maximum > 0)) return null;
  return clamp(1 - targetHealthLoss(config, state) / maximum, 0, 1);
}

/**
 * Owns the "target below X% health" contract: strictly below, so a target sitting exactly at the threshold does not
 * qualify, and an unbounded target never does. Every health-gated rule uses this so the boundary cannot drift.
 */
export function remainingTargetHealthBelow(
  config: Pick<Gw2Config, 'target'> | null | undefined,
  state: Gw2TargetDamageState | null | undefined,
  threshold: number
): boolean {
  const fraction = remainingTargetHealthFraction(config, state);
  return fraction != null && fraction < threshold;
}
