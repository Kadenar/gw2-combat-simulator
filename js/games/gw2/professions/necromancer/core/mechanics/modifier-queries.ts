import type { Gw2ModifierContext } from '#gw2/platform/combat/modifiers.js';

import {
  readProfessionCoreState,
  readProfessionSpecializationState
} from '#gw2/platform/profession-definition/state.js';
import type { NecromancerCoreState } from '#gw2/professions/necromancer/core/state.js';
import type { NecromancerState } from '#gw2/professions/necromancer/types.js';

/** Shared queries read live form, target, and creature state without capturing trait selection. */
export function necromancerRuntimeCoreState(context: Gw2ModifierContext): Partial<NecromancerCoreState> {
  return readProfessionCoreState<NecromancerCoreState>(context.runtime?.profession);
}

export function necromancerRuntimeSpecializationState(
  context: Gw2ModifierContext,
  expectedKind: string
): Partial<NecromancerState> {
  return readProfessionSpecializationState<NecromancerState>(context.runtime?.profession, expectedKind) || {};
}

export function necromancerActiveShroud(context: Gw2ModifierContext): string {
  return necromancerRuntimeCoreState(context).activeShroud || '';
}
