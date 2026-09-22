import { ENGINEER_TRAIT_IDS as TRAIT } from '#gw2/professions/engineer/data/ids.js';
import { balanceProfileNumberFromContext } from '#gw2/platform/engine/skills/balance-profiles.js';
import { readProfessionCoreState, readProfessionSpecializationState } from '#gw2/platform/engine/profession/state.js';
import {
  activeBoonStacks,
  eventSkill as gw2EventSkill,
  playerHealthFraction,
  targetConditionCount,
  targetHealthFraction
} from '#gw2/platform/combat/query/runtime-query.js';
import type { Gw2ModifierContext } from '#gw2/platform/combat/modifiers.js';
import type { EngineerSimulationEvent, EngineerSkill, EngineerState } from '#gw2/professions/engineer/types.js';

/** Narrows the active modifier event to Engineer's extended simulation event shape. */
export function engineerEvent(context: Gw2ModifierContext): EngineerSimulationEvent | undefined {
  return (context.event || undefined) as EngineerSimulationEvent | undefined;
}

/** Reads Core Engineer state from a resolver-side modifier context. */
export function engineerRuntimeState(context: Gw2ModifierContext): Partial<EngineerState> {
  return readProfessionCoreState<EngineerState>(context.runtime?.profession);
}

/** Reads Core Engineer state from a scheduler-side modifier context. */
export function engineerSchedulerState(context: Gw2ModifierContext): Partial<EngineerState> {
  return readProfessionCoreState<EngineerState>(
    (context.state as { readonly profession?: unknown } | undefined)?.profession
  );
}

/** Reads the expected specialization state from either scheduler or resolver modifier contexts. */
export function engineerSpecializationState(context: Gw2ModifierContext, expectedKind: string): Partial<EngineerState> {
  const state =
    context.runtime?.profession ?? (context.state as { readonly profession?: unknown } | undefined)?.profession;
  return readProfessionSpecializationState<EngineerState>(state, expectedKind) || {};
}

/** Re-exports shared boon, health, and target-condition queries for Engineer modifier rules. */
export { activeBoonStacks, playerHealthFraction, targetConditionCount, targetHealthFraction };

/** Resolves the active event's skill using Engineer-specific metadata. */
export function eventSkill(context: Gw2ModifierContext): EngineerSkill | undefined {
  return gw2EventSkill<EngineerSkill>(context);
}

/** Selects Heavy Metal's critical bonus from the target's current health tier. */
export function heavyMetalBonus(context: Gw2ModifierContext): number {
  const fraction = targetHealthFraction(context);
  if (fraction < balanceProfileNumberFromContext(context, TRAIT.HEAVY_METAL, 'lowerThreshold'))
    return balanceProfileNumberFromContext(context, TRAIT.HEAVY_METAL, 'lowerBonus');
  if (fraction < balanceProfileNumberFromContext(context, TRAIT.HEAVY_METAL, 'middleThreshold'))
    return balanceProfileNumberFromContext(context, TRAIT.HEAVY_METAL, 'middleBonus');
  if (fraction < balanceProfileNumberFromContext(context, TRAIT.HEAVY_METAL, 'upperThreshold'))
    return balanceProfileNumberFromContext(context, TRAIT.HEAVY_METAL, 'upperBonus');
  return 0;
}

/** Reports whether a timed field on the active Engineer specialization remains active. */
export function activeEngineerSpecializationState(
  context: Gw2ModifierContext,
  expectedKind: string,
  field: keyof EngineerState
): boolean {
  const state = engineerSpecializationState(context, expectedKind);
  return Number(state?.[field] || 0) > context.time;
}
