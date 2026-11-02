import {
  readProfessionCoreState,
  readProfessionSpecializationState
} from '#gw2/platform/profession-definition/state.js';
import type { ThiefCoreState } from '#gw2/professions/thief/core/state.js';
import type { ThiefRuntimeState } from '#gw2/professions/thief/types.js';

/** Read live Core state without importing modifier assembly or active trait reactions. */
export function thiefRuntimeState(professionState: unknown): Partial<ThiefCoreState> {
  return readProfessionCoreState<ThiefCoreState>(professionState);
}

type ThiefSpecialization = ThiefRuntimeState['specialization'];
type ThiefSpecializationState<TKind extends ThiefSpecialization['kind']> = Extract<
  ThiefSpecialization,
  { kind: TKind }
>['state'];

/** The requested kind determines the result type; optional preview state cannot expose a sibling's fields. */
export function thiefRuntimeSpecializationState<TKind extends ThiefSpecialization['kind']>(
  professionState: unknown,
  expectedKind: TKind
): Partial<ThiefSpecializationState<TKind>> {
  return readProfessionSpecializationState<ThiefSpecializationState<TKind>>(professionState, expectedKind) || {};
}
