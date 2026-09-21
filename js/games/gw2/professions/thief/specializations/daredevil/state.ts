import { THIEF_TRAIT_IDS as TRAIT } from '#gw2/professions/thief/data/ids.js';
import {
  definePublicStateDefaults,
  defineProfessionSpecializationState
} from '#gw2/platform/engine/profession/state.js';
import { hasTrait } from '#gw2/platform/combat/state/traits.js';
import { selectedThiefTraits } from '#gw2/professions/thief/core/state.js';
import type { ThiefConfig, ThiefDodge } from '#gw2/professions/thief/types.js';

export interface DaredevilState {
  enduranceCapacityBonus: number;
  selectedDodge: ThiefDodge;
  boundingDamageUntil: number;
  lotusConditionDamageUntil: number;
  palmStrikeUntil: number;
  weakeningStrikeReady: boolean;
  /** Distinguish fresh dodge grants from snapshots of an already consumed proc. */
  weakeningStrikeGeneration: number;
  weakeningStrikeExpiresAt: number;
}

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

export function createDaredevilState(config: ThiefConfig = {}): DaredevilState {
  const traits = selectedThiefTraits(config);
  return {
    // Daredevil owns the extra dodge capacity even though endurance is spent by the shared Thief resource system.
    enduranceCapacityBonus: 50,
    selectedDodge: selectedDodge(config, traits),
    boundingDamageUntil: 0,
    lotusConditionDamageUntil: 0,
    palmStrikeUntil: 0,
    weakeningStrikeReady: false,
    weakeningStrikeGeneration: 0,
    weakeningStrikeExpiresAt: 0
  };
}

// Public fallbacks omit the private grant generation; live state and snapshots retain it for reconciliation.
export const DAREDEVIL_PUBLIC_STATE_PROJECTION = definePublicStateDefaults({
  selectedDodge: 'Dodge',
  boundingDamageUntil: 0,
  lotusConditionDamageUntil: 0,
  palmStrikeUntil: 0,
  weakeningStrikeReady: false,

  weakeningStrikeExpiresAt: 0
} satisfies Partial<DaredevilState>);

export const daredevilState = defineProfessionSpecializationState('Daredevil', createDaredevilState);
