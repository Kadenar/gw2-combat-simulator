import type { Gw2ModifierContext } from '#gw2/platform/combat/modifiers.js';
import { readProfessionSpecializationState } from '#gw2/platform/profession-definition/state.js';
import type { HolosmithState } from '#gw2/professions/engineer/specializations/holosmith/state.js';

/** Read Holosmith heat and Forge state in simulation or attribute preview without exposing another specialization. */
export function holosmithModifierState(context: Gw2ModifierContext): Partial<HolosmithState> {
  const profession =
    context.runtime?.profession ?? (context.state as { readonly profession?: unknown } | undefined)?.profession;
  return readProfessionSpecializationState<HolosmithState>(profession, 'Holosmith') || {};
}
