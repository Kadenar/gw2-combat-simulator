import type { Gw2ModifierContext } from '#gw2/platform/combat/modifiers.js';
import {
  activeBoonStacks,
  playerHealthFraction,
  targetConditionCount,
  targetHealthFraction
} from '#gw2/platform/combat/query/runtime-query.js';
import { readProfessionCoreState } from '#gw2/platform/profession-definition/state.js';
import type { EngineerSimulationEvent, EngineerState } from '#gw2/professions/engineer/types.js';

/** Narrows the active modifier event to Engineer's extended simulation event shape. */
export function engineerEvent(context: Gw2ModifierContext): EngineerSimulationEvent | undefined {
  return context.event || undefined;
}

/** Reads Core state from the live simulation or the isolated attribute preview. */
export function engineerRuntimeState(context: Gw2ModifierContext): Partial<EngineerState> {
  return readProfessionCoreState<EngineerState>(
    context.runtime?.profession ?? (context.state as { readonly profession?: unknown } | undefined)?.profession
  );
}

/** Re-exports shared boon, health, and target-condition queries for Engineer modifier rules. */
export { activeBoonStacks, playerHealthFraction, targetConditionCount, targetHealthFraction };
