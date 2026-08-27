import { professionCoreState } from '../../../platform/engine/profession/state.js';
import { isGw2PlayerModifierOwnedEvent } from '../../../platform/gw2/combat/state/event-ownership.js';
import {
  activeBoonStacks,
  eventSkill as gw2EventSkill,
  playerHealthFraction,
  selectedSkillNames as gw2SelectedSkillNames,
  targetConditionCount,
  targetHealthFraction,
  vulnerabilityStacks
} from '../../../platform/gw2/combat/query/runtime-query.js';
import type { SchedulerRecord } from '../../../platform/engine/types.js';
import type { Gw2ModifierContext } from '../../../platform/gw2/combat/modifiers/types.js';
import type {
  EngineerMechAttributes,
  EngineerRuntimeState,
  EngineerSimulationEvent,
  EngineerSkill,
  EngineerState
} from '../types.js';

export function engineerEvent(context: Gw2ModifierContext): EngineerSimulationEvent | undefined {
  return (context.event || undefined) as EngineerSimulationEvent | undefined;
}

export function engineerRuntimeState(context: Gw2ModifierContext): Partial<EngineerState> {
  return professionCoreState(context) as Partial<EngineerState>;
}

export function engineerSchedulerState(context: Gw2ModifierContext): Partial<EngineerState> {
  return professionCoreState(context) as Partial<EngineerState>;
}

// called from both scheduler (state path) and resolver (runtime path) contexts — checks both paths
export function engineerSpecializationState(context: Gw2ModifierContext, expectedKind: string): Partial<EngineerState> {
  const state = (context.runtime?.profession ??
    (context.state as { readonly profession?: unknown } | undefined)?.profession) as EngineerRuntimeState | undefined;
  if (state?.specialization.kind !== expectedKind) return {};
  return state.specialization.state as Partial<EngineerState>;
}

// Preserve the profession helper surface while delegating GW2-wide queries to the shared runtime layer.
export { activeBoonStacks, playerHealthFraction, targetConditionCount, targetHealthFraction };

export function vulnerability(context: Gw2ModifierContext): number {
  return vulnerabilityStacks(context);
}

// Player-only modifiers follow outgoing ownership; turrets, mechs, and unowned effects remain excluded.
export function playerStrike(context: Gw2ModifierContext): boolean {
  return isGw2PlayerModifierOwnedEvent(context.event);
}

export function eventSkill(context: Gw2ModifierContext): EngineerSkill | undefined {
  return gw2EventSkill<EngineerSkill>(context);
}

export function selectedSkillNames(context: Gw2ModifierContext): Set<string> {
  return new Set(gw2SelectedSkillNames(context));
}

// Heavy Metal bonus scales with target health — higher bonus at lower health thresholds
export function heavyMetalBonus(context: Gw2ModifierContext, parameters: Readonly<Record<string, number>>): number {
  const fraction = targetHealthFraction(context);
  if (fraction < parameters.lowerThreshold) return parameters.lowerBonus;
  if (fraction < parameters.middleThreshold) return parameters.middleBonus;
  if (fraction < parameters.upperThreshold) return parameters.upperBonus;
  return 0;
}

export function activeEngineerSpecializationState(
  context: Gw2ModifierContext,
  expectedKind: string,
  field: keyof EngineerState
): boolean {
  const state = engineerSpecializationState(context, expectedKind);
  return Number(state?.[field] || 0) > context.time;
}

export function cloneEngineerAttributes(attributes: SchedulerRecord): EngineerMechAttributes & SchedulerRecord {
  return { ...attributes } as EngineerMechAttributes & SchedulerRecord;
}
