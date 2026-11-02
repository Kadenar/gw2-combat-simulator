import { hasTrait, normalizeSelectedTraitIds } from '#gw2/platform/builds/selected-traits.js';
import {
  defineProfessionSpecializationState,
  type SpecializationRuntimeState
} from '#gw2/platform/profession-definition/state.js';
import type { Gw2PlanningStateInput } from '#gw2/platform/results/types.js';
import { PROFESSION_STATE_IDS as STATE } from '#gw2/professions/state-ids.js';
import { THIEF_TRAIT_IDS as TRAIT } from '#gw2/professions/thief/data/ids.js';
import type { ThiefConfig, ThiefDodge } from '#gw2/professions/thief/types.js';

export interface DaredevilState {
  selectedDodge: ThiefDodge;
  weakeningStrikeReady: boolean;
  weakeningStrikeExpiresAt: number;
}

export function createDaredevilState(config: ThiefConfig = {}): DaredevilState {
  // Normalize trait selection once while creating the specialization owner.
  const traits = normalizeSelectedTraitIds(config.selectedTraitIds);
  return {
    // Daredevil owns the extra dodge capacity even though endurance is spent by the shared Thief resource system.

    selectedDodge: selectedDodge(config, traits),
    weakeningStrikeReady: false,
    weakeningStrikeExpiresAt: 0
  };
}

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

/** Select public fields without mutating their owner; the planning observer detaches the result. */
export function projectDaredevilPlanningState(input: Gw2PlanningStateInput<SpecializationRuntimeState>) {
  const state = daredevilState.from(input.profession);
  return {
    [STATE.WEAKENING_STRIKE_READY]: state.weakeningStrikeReady,
    [STATE.WEAKENING_STRIKE_EXPIRES_AT]: state.weakeningStrikeExpiresAt
  };
}
