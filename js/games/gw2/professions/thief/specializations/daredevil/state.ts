import { THIEF_TRAIT_IDS as TRAIT } from '#gw2/professions/thief/data/ids.js';
import { defineProfessionSpecializationState } from '#gw2/platform/engine/profession/state.js';
import { hasTrait } from '#gw2/platform/combat/state/traits.js';
import { selectedThiefTraits } from '#gw2/professions/thief/core/state.js';
import type { DaredevilState, ThiefConfig, ThiefDodge } from '#gw2/professions/thief/types.js';

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
    weakeningStrikeReady: false
  };
}

export const DAREDEVIL_PUBLIC_END_STATE_KEYS: readonly (keyof DaredevilState)[] = Object.freeze([
  'selectedDodge',
  'boundingDamageUntil',
  'lotusConditionDamageUntil',
  'palmStrikeUntil',
  'weakeningStrikeReady'
]);

export const DAREDEVIL_INACTIVE_STATE_DEFAULTS: Readonly<Partial<DaredevilState>> = Object.freeze({
  selectedDodge: 'Dodge',
  boundingDamageUntil: 0,
  lotusConditionDamageUntil: 0,
  palmStrikeUntil: 0,
  weakeningStrikeReady: false
});

export const daredevilState = defineProfessionSpecializationState('Daredevil', createDaredevilState);
