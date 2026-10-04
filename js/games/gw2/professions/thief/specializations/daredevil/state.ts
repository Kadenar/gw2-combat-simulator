import { selectedDodge } from '#gw2/professions/thief/specializations/daredevil/traits/dodges.js';

import {
  definePublicStateDefaults,
  defineProfessionSpecializationState
} from '#gw2/platform/profession-definition/state.js';

import { selectedThiefTraits } from '#gw2/professions/thief/core/state.js';
import type { ThiefConfig, ThiefDodge } from '#gw2/professions/thief/types.js';

export interface DaredevilState {
  selectedDodge: ThiefDodge;
  boundingDamageUntil: number;
  lotusConditionDamageUntil: number;
  weakeningStrikeReady: boolean;
  weakeningStrikeExpiresAt: number;
}

export function createDaredevilState(config: ThiefConfig = {}): DaredevilState {
  const traits = selectedThiefTraits(config);
  return {
    // Daredevil owns the extra dodge capacity even though endurance is spent by the shared Thief resource system.

    selectedDodge: selectedDodge(config, traits),
    boundingDamageUntil: 0,
    lotusConditionDamageUntil: 0,
    weakeningStrikeReady: false,
    weakeningStrikeExpiresAt: 0
  };
}

// Only active Daredevil state contributes dodge windows to public projections.
export const DAREDEVIL_PUBLIC_STATE_PROJECTION = definePublicStateDefaults({
  selectedDodge: 'Dodge',
  boundingDamageUntil: 0,
  lotusConditionDamageUntil: 0,
  weakeningStrikeReady: false,
  weakeningStrikeExpiresAt: 0
} satisfies Partial<DaredevilState>);

export const daredevilState = defineProfessionSpecializationState('Daredevil', createDaredevilState);
