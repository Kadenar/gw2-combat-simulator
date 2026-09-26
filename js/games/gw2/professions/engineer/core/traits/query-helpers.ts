import { ENGINEER_TRAIT_IDS as TRAIT } from '#gw2/professions/engineer/data/ids.js';
import {
  requireBalanceProfileFromContext,
  balanceProfileNumber
} from '#gw2/platform/engine/skills/balance-profiles.js';
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

/** Reads Core state from the live simulation or the isolated attribute preview. */
export function engineerRuntimeState(context: Gw2ModifierContext): Partial<EngineerState> {
  return readProfessionCoreState<EngineerState>(
    context.runtime?.profession ?? (context.state as { readonly profession?: unknown } | undefined)?.profession
  );
}

/** Reads the active specialization in simulation or attribute preview. */
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
  const heavyMetalProfile = requireBalanceProfileFromContext(context, TRAIT.HEAVY_METAL);
  if (fraction < balanceProfileNumber(heavyMetalProfile, 'lowerThreshold'))
    return balanceProfileNumber(heavyMetalProfile, 'lowerBonus');
  if (fraction < balanceProfileNumber(heavyMetalProfile, 'middleThreshold'))
    return balanceProfileNumber(heavyMetalProfile, 'middleBonus');
  if (fraction < balanceProfileNumber(heavyMetalProfile, 'upperThreshold'))
    return balanceProfileNumber(heavyMetalProfile, 'upperBonus');
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
