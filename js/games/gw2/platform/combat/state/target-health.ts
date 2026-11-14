import type { Gw2Config } from '#gw2/platform/simulation/config.js';
import { clamp } from '#kernel/core/numeric.js';

interface Gw2TargetDamageState {
  readonly encounter?: {
    readonly remainingHealthFraction: number;
    readonly maximumHealth: number;
    readonly remainingHealth: number;
  };
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
  // Encounter bars can differ from the initial configuration and from the previous phase's target.
  if (state?.encounter) return state.encounter.maximumHealth - state.encounter.remainingHealth;

  const maximum = config?.target?.health || 0;

  // Fixed target states ignore damage; dynamic targets subtract damage from every owner.
  if (config?.target?.fixedHealthFraction != null)
    return maximum * (1 - clamp(config.target.fixedHealthFraction, 0, 1));

  const configured = Number(config?.target?.startingHealthFraction);
  const startingFraction = Number.isFinite(configured) ? clamp(configured, 0, 1) : 1;
  return maximum * (1 - startingFraction) + combinedTargetDamage(state);
}

/** Milestones use the same health-loss arithmetic as death, including partially depleted starting health. */
export function targetHealthReached(
  config: Pick<Gw2Config, 'target'>,
  state: Gw2TargetDamageState,
  healthPercent: number
): boolean {
  const maximum = config.target?.health || 0;
  return maximum > 0 && targetHealthLoss(config, state) >= maximum * (1 - healthPercent / 100);
}

/** Resolves fixed or damage-driven target health, or null for unbounded targets without a declared percentage. */
export function remainingTargetHealthFraction(
  config: Pick<Gw2Config, 'target'> | null | undefined,
  state: Gw2TargetDamageState | null | undefined
): number | null {
  // Encounter health follows the active target and replacement bar, independently of the initial golem maximum.
  if (state?.encounter) return clamp(state.encounter.remainingHealthFraction, 0, 1);

  if (config?.target?.fixedHealthFraction != null) return clamp(config.target.fixedHealthFraction, 0, 1);

  const maximum = config?.target?.health || 0;

  if (!(maximum > 0)) return null;

  return clamp(1 - targetHealthLoss(config, state) / maximum, 0, 1);
}

/**
 * Owns the "target below X% health" contract: strictly below, so a target sitting exactly at the threshold does not
 * qualify, and an unspecified health fraction never does. Every health-gated rule shares this boundary.
 */
export function remainingTargetHealthBelow(
  config: Pick<Gw2Config, 'target'> | null | undefined,
  state: Gw2TargetDamageState | null | undefined,
  threshold: number
): boolean {
  const fraction = remainingTargetHealthFraction(config, state);
  return fraction != null && fraction < threshold;
}
