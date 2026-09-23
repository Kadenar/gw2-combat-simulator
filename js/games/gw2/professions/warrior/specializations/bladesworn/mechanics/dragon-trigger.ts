import {
  requireBalanceProfileFromContext,
  balanceProfileNumber
} from '#gw2/platform/engine/skills/balance-profiles.js';

import { canonicalTime, EPSILON } from '#kernel/core/clock.js';

import { hasTrait } from '#gw2/platform/combat/state/traits.js';
import { WARRIOR_TRAIT_IDS as TRAIT } from '#gw2/professions/warrior/data/ids.js';
import type { WarriorCastContext, WarriorSchedulerContext } from '#gw2/professions/warrior/types.js';

import { BLADESWORN_BALANCE_PROFILE_IDS as PROFILE } from '#gw2/professions/warrior/specializations/bladesworn/profiles.js';
import { clamp } from '#kernel/core/numeric.js';

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
  readonly initialTickIndex?: number;
  readonly tickAt: (tickIndex: number) => number;
  readonly flowRateSegments: readonly DragonFlowRateSegment[];
  readonly deadline: number;
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
  if (!(to > from)) return clamp(flow, 0, maximumFlow);
  const gained = flowRateSegments.reduce((total, segment) => {
    const overlap = Math.min(to, segment.end) - Math.max(from, segment.start);
    return overlap > 0 ? total + overlap * segment.flowPerSecond : total;
  }, 0);
  return clamp(flow + gained, 0, maximumFlow);
}

export function projectDragonCharges(input: DragonChargeProjectionInput): readonly DragonChargeTick[] {
  const ticks: DragonChargeTick[] = [];
  let tickIndex = input.initialTickIndex ?? 1;
  let at = canonicalTime(input.firstTickAt ?? input.tickAt(tickIndex));
  let previousAt = input.startTime;
  let flow = clamp(input.flow, 0, input.maximumFlow);
  let charges = clamp(input.initialCharges ?? 0, 0, input.maximumCharges);

  // A charge at the deadline is valid; canonical ticks cannot leak past it through tolerance.
  const deadline = Number.isFinite(input.deadline) ? canonicalTime(input.deadline) : input.deadline;
  while (at <= deadline && charges < input.maximumCharges) {
    flow = projectDragonFlow(flow, input.maximumFlow, previousAt, at, input.flowRateSegments);
    const granted = flow + EPSILON >= input.flowPerInterval;
    if (granted) {
      flow = Math.max(0, flow - input.flowPerInterval);
      charges = Math.min(input.maximumCharges, charges + input.chargesPerInterval);
    }

    ticks.push({ at, charges, flowAfter: flow, granted });
    previousAt = at;
    tickIndex += 1;
    at = canonicalTime(input.tickAt(tickIndex));
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
  const resolvedCharges = clamp(charges, 1, maximumCharges);
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
  const dragonTriggerProfile = requireBalanceProfileFromContext(context, PROFILE.dragonTrigger);
  return hasTrait(context, TRAIT.DARING_DRAGON)
    ? balanceProfileNumber(dragonTriggerProfile, 'minimumStacks')
    : balanceProfileNumber(dragonTriggerProfile, 'maximumStacks');
}

export function dragonFlowPerInterval(context: DragonTriggerContext): number {
  const dragonTriggerProfile = requireBalanceProfileFromContext(context, PROFILE.dragonTrigger);
  const cost = balanceProfileNumber(dragonTriggerProfile, 'resourceCost');
  return hasTrait(context, TRAIT.DARING_DRAGON)
    ? cost *
        balanceProfileNumber(requireBalanceProfileFromContext(context, TRAIT.DARING_DRAGON), 'resourceCostMultiplier')
    : cost;
}

export function requestedDragonCharges(context: WarriorCastContext, maximumCharges: number): number {
  const configured = context.command.releaseAtCharges;
  if (configured == null) return maximumCharges;
  return clamp(configured, 1, maximumCharges);
}
