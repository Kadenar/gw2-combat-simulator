import { hasTrait } from '#gw2/platform/builds/selected-traits.js';
import {
  defineProfessionSpecializationState,
  type SpecializationRuntimeState
} from '#gw2/platform/profession-definition/state.js';
import type { Gw2PlanningStateInput } from '#gw2/platform/results/types.js';
import { SHARED_SKILL_IDS } from '#gw2/platform/skills/shared-actions.js';
import type { SkillId } from '#gw2/platform/skills/types.js';
import { PROFESSION_STATE_IDS as STATE } from '#gw2/professions/state-ids.js';
import { THIEF_SKILL_IDS as ID, THIEF_TRAIT_IDS as TRAIT } from '#gw2/professions/thief/data/ids.js';
import type { ThiefConfig, ThiefDodge } from '#gw2/professions/thief/types.js';

interface DodgeReplacement {
  readonly choice: Exclude<ThiefDodge, 'Dodge'>;
  readonly traitId: SkillId;
  readonly name: string;
  readonly iconSkillId: SkillId;
  readonly directStrike: boolean;
}

/** Trait selection takes precedence over the saved choice. Packet tuning comes from the selected trait profile. */
const replacements: readonly DodgeReplacement[] = [
  {
    choice: 'Lotus Training',
    traitId: TRAIT.LOTUS_TRAINING,
    name: 'Impaling Lotus',
    iconSkillId: ID.IMPALING_LOTUS,
    directStrike: true
  },
  {
    choice: 'Bounding Dodger',
    traitId: TRAIT.BOUNDING_DODGER,
    name: 'Bound',
    iconSkillId: ID.BOUND,
    directStrike: true
  },
  {
    choice: 'Unhindered Combatant',
    traitId: TRAIT.UNHINDERED_COMBATANT,
    name: 'Unhindered Combatant',
    iconSkillId: SHARED_SKILL_IDS.DODGE,
    directStrike: false
  }
];

export interface DaredevilState {
  selectedDodge: DodgeReplacement | null;
  weakeningStrikeReady: boolean;
  weakeningStrikeExpiresAt: number;
}

export function createDaredevilState(config: ThiefConfig = {}): DaredevilState {
  const selected =
    replacements.find((dodge) => hasTrait(config, dodge.traitId)) ??
    replacements.find((dodge) => dodge.choice === config.selectedDodge);
  return {
    selectedDodge: selected ? { ...selected } : null,
    weakeningStrikeReady: false,
    weakeningStrikeExpiresAt: 0
  };
}

export const daredevilState = defineProfessionSpecializationState('Daredevil', createDaredevilState);

/** Select public fields without mutating their owner; the planning observer detaches the result. */
export function projectDaredevilPlanningState(input: Gw2PlanningStateInput<SpecializationRuntimeState>) {
  const state = daredevilState.from(input.profession);
  return {
    [STATE.WEAKENING_STRIKE_READY]: state.weakeningStrikeReady,
    [STATE.WEAKENING_STRIKE_EXPIRES_AT]: state.weakeningStrikeExpiresAt
  };
}
