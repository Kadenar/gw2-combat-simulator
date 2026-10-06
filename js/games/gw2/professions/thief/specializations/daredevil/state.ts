import { hasTrait } from '#gw2/platform/builds/selected-traits.js';
import { THIEF_TRAIT_IDS as TRAIT } from '#gw2/professions/thief/data/ids.js';

import {
  definePublicStateDefaults,
  defineProfessionSpecializationState
} from '#gw2/platform/profession-definition/state.js';

import { selectedThiefTraits } from '#gw2/professions/thief/core/state.js';
import type { ThiefConfig, ThiefDodge } from '#gw2/professions/thief/types.js';

export interface DaredevilState {
  selectedDodge: ThiefDodge;
  weakeningStrikeReady: boolean;
  weakeningStrikeExpiresAt: number;
}

export function createDaredevilState(config: ThiefConfig = {}): DaredevilState {
  const traits = selectedThiefTraits(config);
  return {
    // Daredevil owns the extra dodge capacity even though endurance is spent by the shared Thief resource system.

    selectedDodge: selectedDodge(config, traits),
    weakeningStrikeReady: false,
    weakeningStrikeExpiresAt: 0
  };
}

// Only active Daredevil state contributes dodge windows to public projections.
export const DAREDEVIL_PUBLIC_STATE_PROJECTION = definePublicStateDefaults({
  selectedDodge: 'Dodge',
  weakeningStrikeReady: false,
  weakeningStrikeExpiresAt: 0
} satisfies Partial<DaredevilState>);

export const daredevilState = defineProfessionSpecializationState('Daredevil', createDaredevilState);

/** Initialize the trait-selected dodge before using the configured choice or ordinary Dodge. */
function selectedDodge(config: ThiefConfig, traits: ReadonlySet<string | number>): ThiefDodge {
  // Trait-based dodge replaces any explicit config choice; only one Daredevil minor trait can be active
  if (hasTrait(traits, TRAIT.LOTUS_TRAINING)) return 'Lotus Training';
  if (hasTrait(traits, TRAIT.BOUNDING_DODGER)) return 'Bounding Dodger';
  if (hasTrait(traits, TRAIT.UNHINDERED_COMBATANT)) {
    return 'Unhindered Combatant';
  }

  // Fall back to explicit config selection or plain dodge for Core Thief / non-minor builds
  return config.selectedDodge || 'Dodge';
}
