import type { RevenantConfig, VindicatorState } from '#gw2/professions/revenant/types.js';
import { defineProfessionSpecializationState } from '#gw2/platform/engine/profession/state.js';

export const VINDICATOR_PUBLIC_END_STATE_KEYS: readonly (keyof VindicatorState)[] = Object.freeze([
  'allianceSide',
  'selectedDodge',
  'reaversCurseUntil',
  'forerunnerOfDeathUntil'
]);

export const VINDICATOR_PUBLIC_INACTIVE_STATE_DEFAULTS: Readonly<Partial<VindicatorState>> = Object.freeze({
  allianceSide: 'luxon',
  selectedDodge: 'Death Drop',
  reaversCurseUntil: 0,
  forerunnerOfDeathUntil: 0
});

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
