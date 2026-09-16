import { EPSILON } from '#kernel/core/clock.js';
import { balanceProfileFromContext } from '#gw2/platform/combat/state/balance-profiles.js';
import { hasTrait } from '#gw2/platform/combat/state/traits.js';
import { quantizeGw2ActionTimingMs } from '#gw2/platform/skills/timing.js';
import { WARRIOR_TRAIT_IDS as TRAIT } from '#gw2/professions/warrior/data/ids.js';
import type { WarriorCastContext, WarriorSchedulerContext } from '#gw2/professions/warrior/types.js';

import { BLADESWORN_BALANCE_PROFILE_IDS as PROFILE } from '#gw2/professions/warrior/specializations/bladesworn/profiles.js';

// Dragon Trigger ticks every 250 ms to potentially grant one charge.
export const DRAGON_CHARGE_INTERVAL_SECONDS = 0.25;
export const DRAGON_TRIGGER_MAXIMUM_CHARGE_MS = 2480;
export const DRAGON_TRIGGER_TACTICAL_RELOAD_MAXIMUM_CHARGE_MS = 1200;
export const DRAGON_FLOW_PER_INTERVAL = 5;
export const DRAGON_TRIGGER_FLOW_COST = 15;
export const DRAGON_TRIGGER_DURATION_SECONDS = 30;

export const DRAGON_TRIGGER_ENTRY_RESOURCE_REASON = 'dragon trigger entry';
export const DRAGON_TRIGGER_TICK_RESOURCE_REASON = 'dragon trigger charge';

export interface DragonFlowRateSegment {
  readonly start: number;
  readonly end: number;
  readonly flowPerSecond: number;
}

export interface DragonChargeProjectionInput {
  readonly startTime: number;
  readonly firstTickAt?: number;
  readonly flow: number;
  readonly maximumFlow: number;
  readonly initialCharges?: number;
  readonly maximumCharges: number;
  readonly chargesPerInterval: number;
  readonly flowPerInterval: number;
  readonly intervalSeconds?: number;
  readonly initialTickIndex?: number;
  readonly tickAt?: (tickIndex: number) => number;
  readonly flowRateSegments: readonly DragonFlowRateSegment[];
  readonly deadline: number;
}

/** Places every Dragon Trigger threshold on the 40 ms action grid while preserving the measured maximum duration. */
export function dragonChargeTickOffsetSeconds(
  tickIndex: number,
  maximumCharges: number,
  chargesPerInterval: number
): number {
  const intervals = Math.max(1, Math.ceil(maximumCharges / Math.max(1, chargesPerInterval)));
  const maximumDurationMs =
    chargesPerInterval > 1 ? DRAGON_TRIGGER_TACTICAL_RELOAD_MAXIMUM_CHARGE_MS : DRAGON_TRIGGER_MAXIMUM_CHARGE_MS;
  return quantizeGw2ActionTimingMs((maximumDurationMs * Math.max(1, tickIndex)) / intervals) / 1000;
}

/** Resolves an observed charge duration to the nearest reachable Dragon Charge threshold. */
export function dragonChargesForDurationMs(
  durationMs: number,
  maximumCharges: number,
  chargesPerInterval: number
): number {
  const intervalCharges = Math.max(1, chargesPerInterval);
  const levels: number[] = [];
  for (let charges = intervalCharges; charges < maximumCharges; charges += intervalCharges) levels.push(charges);
  levels.push(maximumCharges);
  const observedMs = quantizeGw2ActionTimingMs(durationMs);
  return levels.reduce((closest, charges, index) => {
    const thresholdMs = dragonChargeTickOffsetSeconds(index + 1, maximumCharges, intervalCharges) * 1000;
    const closestIndex = levels.indexOf(closest);
    const closestMs = dragonChargeTickOffsetSeconds(closestIndex + 1, maximumCharges, intervalCharges) * 1000;
    return Math.abs(thresholdMs - observedMs) < Math.abs(closestMs - observedMs) ? charges : closest;
  }, levels[0]);
}

export interface DragonChargeTick {
  readonly at: number;
  readonly charges: number;
  readonly flowAfter: number;
  readonly granted: boolean;
}

export function projectDragonFlow(
  flow: number,
  maximumFlow: number,
  from: number,
  to: number,
  flowRateSegments: readonly DragonFlowRateSegment[]
): number {
  if (!(to > from)) return Math.min(maximumFlow, Math.max(0, flow));
  const gained = flowRateSegments.reduce((total, segment) => {
    const overlap = Math.min(to, segment.end) - Math.max(from, segment.start);
    return overlap > 0 ? total + overlap * segment.flowPerSecond : total;
  }, 0);
  return Math.min(maximumFlow, Math.max(0, flow + gained));
}

export function projectDragonCharges(input: DragonChargeProjectionInput): readonly DragonChargeTick[] {
  const ticks: DragonChargeTick[] = [];
  const interval = input.intervalSeconds ?? DRAGON_CHARGE_INTERVAL_SECONDS;
  let tickIndex = input.initialTickIndex ?? 1;
  let at = input.firstTickAt ?? input.tickAt?.(tickIndex) ?? input.startTime + interval;
  let previousAt = input.startTime;
  let flow = Math.min(input.maximumFlow, Math.max(0, input.flow));
  let charges = Math.min(input.maximumCharges, Math.max(0, input.initialCharges ?? 0));

  while (at <= input.deadline + EPSILON && charges < input.maximumCharges) {
    flow = projectDragonFlow(flow, input.maximumFlow, previousAt, at, input.flowRateSegments);
    const granted = flow + EPSILON >= input.flowPerInterval;
    if (granted) {
      flow = Math.max(0, flow - input.flowPerInterval);
      charges = Math.min(input.maximumCharges, charges + input.chargesPerInterval);
    }

    ticks.push({ at, charges, flowAfter: flow, granted });
    previousAt = at;
    tickIndex += 1;
    at = input.tickAt?.(tickIndex) ?? at + interval;
  }

  return ticks;
}

export function dragonSlashCoefficient(
  minimum: number,
  maximum: number,
  charges: number,
  maximumCharges: number
): number {
  if (maximumCharges <= 1) return maximum;
  const resolvedCharges = Math.max(1, Math.min(maximumCharges, charges));
  return minimum + (maximum - minimum) * ((resolvedCharges - 1) / (maximumCharges - 1));
}

// Maps charges to adrenaline bars spent (1 bar = 10): 1-4 charges → 10,
// 5-9 → 20, 10 → 30. Used by burst traits that scale on adrenaline bars.
export function dragonChargesToAdrenalineSpent(charges: number): number {
  if (charges >= 10) return 30;
  if (charges >= 5) return 20;
  return charges > 0 ? 10 : 0;
}

type DragonTriggerContext = WarriorCastContext | WarriorSchedulerContext;

export function maximumDragonCharges(context: DragonTriggerContext): number {
  const profile = balanceProfileFromContext(context, PROFILE.dragonTrigger);
  return hasTrait(context, TRAIT.DARING_DRAGON)
    ? Number(profile?.minimumStacks ?? 5)
    : Number(profile?.maximumStacks ?? 10);
}

export function dragonFlowPerInterval(context: DragonTriggerContext): number {
  const cost = Number(
    balanceProfileFromContext(context, PROFILE.dragonTrigger)?.resourceCost ?? DRAGON_FLOW_PER_INTERVAL
  );
  return hasTrait(context, TRAIT.DARING_DRAGON) ? cost * 2 : cost;
}

export function requestedDragonCharges(context: WarriorCastContext, maximumCharges: number): number {
  const configured = context.command.releaseAtCharges;
  if (configured == null) return maximumCharges;
  return Math.min(maximumCharges, Math.max(1, configured));
}
