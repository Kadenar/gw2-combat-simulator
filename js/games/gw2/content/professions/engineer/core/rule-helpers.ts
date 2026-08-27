import {
  readProfessionCoreState,
  readProfessionSpecializationState
} from '../../../../platform/engine/profession/state.js';
import {
  activeBoonStacks,
  eventSkill as gw2EventSkill,
  playerHealthFraction,
  targetConditionCount,
  targetHealthFraction
} from '../../../../platform/combat/query/runtime-query.js';
import type { SchedulerRecord } from '../../../../platform/engine/types.js';
import type { Gw2ModifierContext } from '../../../../platform/combat/modifiers/types.js';
import type { EngineerMechAttributes, EngineerSimulationEvent, EngineerSkill, EngineerState } from '../types.js';

export function engineerEvent(context: Gw2ModifierContext): EngineerSimulationEvent | undefined {
  return (context.event || undefined) as EngineerSimulationEvent | undefined;
}

export function engineerRuntimeState(context: Gw2ModifierContext): Partial<EngineerState> {
  return readProfessionCoreState<EngineerState>(context.runtime?.profession);
}

export function engineerSchedulerState(context: Gw2ModifierContext): Partial<EngineerState> {
  return readProfessionCoreState<EngineerState>(
    (context.state as { readonly profession?: unknown } | undefined)?.profession
  );
}

// called from both scheduler (state path) and resolver (runtime path) contexts — checks both paths
export function engineerSpecializationState(context: Gw2ModifierContext, expectedKind: string): Partial<EngineerState> {
  const state =
    context.runtime?.profession ?? (context.state as { readonly profession?: unknown } | undefined)?.profession;
  return readProfessionSpecializationState<EngineerState>(state, expectedKind) || {};
}

// Preserve the profession helper surface while delegating GW2-wide queries to the shared runtime layer.
export { activeBoonStacks, playerHealthFraction, targetConditionCount, targetHealthFraction };

// Narrow the shared generic lookup once so Engineer rules can read Engineer-only skill metadata without casts.
export function eventSkill(context: Gw2ModifierContext): EngineerSkill | undefined {
  return gw2EventSkill<EngineerSkill>(context);
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
