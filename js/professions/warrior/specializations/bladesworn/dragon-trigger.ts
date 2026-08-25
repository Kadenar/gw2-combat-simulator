import { hasTrait } from '../../../../platform/gw2/combat/state/traits.js';
import { WARRIOR_TRAIT_IDS as TRAIT } from '../../data/ids.js';
import type { WarriorCastContext, WarriorSchedulerContext } from '../../types.js';
import { warriorBalanceProfile } from '../../core/profiles.js';
import { BLADESWORN_BALANCE_PROFILE_IDS as PROFILE } from './profiles.js';

// Dragon Trigger ticks every 250 ms to potentially grant one charge.
export const DRAGON_CHARGE_INTERVAL_SECONDS = 0.25;
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
  readonly flowRateSegments: readonly DragonFlowRateSegment[];
  readonly deadline: number;
}

export interface DragonChargeTick {
  readonly at: number;
  readonly charges: number;
  readonly flowAfter: number;
  readonly granted: boolean;
}

const PROJECTION_EPSILON = 1e-9;

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
  let at = input.firstTickAt ?? input.startTime + interval;
  let previousAt = input.startTime;
  let flow = Math.min(input.maximumFlow, Math.max(0, input.flow));
  let charges = Math.min(input.maximumCharges, Math.max(0, input.initialCharges ?? 0));

  while (at <= input.deadline + PROJECTION_EPSILON && charges < input.maximumCharges) {
    flow = projectDragonFlow(flow, input.maximumFlow, previousAt, at, input.flowRateSegments);
    const granted = flow + PROJECTION_EPSILON >= input.flowPerInterval;
    if (granted) {
      flow = Math.max(0, flow - input.flowPerInterval);
      charges = Math.min(input.maximumCharges, charges + input.chargesPerInterval);
    }

    ticks.push({ at, charges, flowAfter: flow, granted });
    previousAt = at;
    at += interval;
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

// Maps charges to adrenaline bars spent (1 bar = 10): 1–4 charges → 10,
// 5–9 → 20, 10 → 30. Used by burst traits that scale on adrenaline bars.
export function dragonChargesToAdrenalineSpent(charges: number): number {
  if (charges >= 10) return 30;
  if (charges >= 5) return 20;
  return charges > 0 ? 10 : 0;
}

type DragonTriggerContext = WarriorCastContext | WarriorSchedulerContext;

export function maximumDragonCharges(context: DragonTriggerContext): number {
  const profile = warriorBalanceProfile(context, PROFILE.dragonTrigger);
  return hasTrait(context, TRAIT.DARING_DRAGON)
    ? Number(profile?.minimumStacks ?? 5)
    : Number(profile?.maximumStacks ?? 10);
}

export function dragonFlowPerInterval(context: DragonTriggerContext): number {
  const cost = Number(warriorBalanceProfile(context, PROFILE.dragonTrigger)?.resourceCost ?? DRAGON_FLOW_PER_INTERVAL);
  return hasTrait(context, TRAIT.DARING_DRAGON) ? cost * 2 : cost;
}

export function requestedDragonCharges(context: WarriorCastContext, maximumCharges: number): number {
  const configured = context.command.releaseAtCharges;
  if (configured == null) return maximumCharges;
  return Math.min(maximumCharges, Math.max(1, configured));
}
