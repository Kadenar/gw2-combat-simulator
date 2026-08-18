import type { RevenantConfig, VindicatorState } from '../../types.js';
import { defineProfessionSpecializationState } from '../../../../platform/engine/profession.js';

export function createVindicatorState(config: RevenantConfig = {}): VindicatorState {
  return {
    // Any value other than "kurzick" is normalized to "luxon" so the state is always one of two known strings.
    allianceSide: config.allianceSide === 'kurzick' ? 'kurzick' : 'luxon',
    selectedDodge: config.selectedDodge || 'Death Drop',
    // Timestamp-based flags: 0 means inactive; compared against event.at so 0 is safely "never".
    reaversCurseUntil: 0,
    forerunnerOfDeathUntil: 0
  };
}

// Both scheduler and resolver call create independently; state is NOT shared across phases.
export const vindicatorState = defineProfessionSpecializationState('Vindicator', createVindicatorState);
