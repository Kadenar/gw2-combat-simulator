import type { Gw2ModifierContext } from '#gw2/platform/combat/modifiers.js';
import { readProfessionSpecializationState } from '#gw2/platform/profession-definition/state.js';
import type { AmalgamState } from '#gw2/professions/engineer/specializations/amalgam/state.js';

/** Read Amalgam's timed states in simulation or attribute preview; other specializations contribute no active window. */
export function activeAmalgamState(context: Gw2ModifierContext, field: keyof AmalgamState): boolean {
  const profession =
    context.runtime?.profession ?? (context.state as { readonly profession?: unknown } | undefined)?.profession;
  const state = readProfessionSpecializationState<AmalgamState>(profession, 'Amalgam');
  return Number(state?.[field] || 0) > context.time;
}
