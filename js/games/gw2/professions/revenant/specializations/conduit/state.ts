import { buffDeadlineActive } from '#gw2/platform/combat/buff-expiry.js';
import type { RechargeProgress } from '#gw2/platform/combat/recharge.js';
import type { SkillFlipWindow } from '#gw2/platform/execution/skill-flips.js';
import {
  defineProfessionSpecializationState,
  type SpecializationRuntimeState
} from '#gw2/platform/profession-definition/state.js';
import type { Gw2PlanningStateInput } from '#gw2/platform/results/types.js';
import { PROFESSION_STATE_IDS as STATE } from '#gw2/professions/state-ids.js';
import { createResourceClock, type ResourceClock } from '#kernel/resources/accrual.js';

export interface ConduitState {
  affinity: ResourceClock;
  cosmicWisdomUntil: number;
  /** Bolstered Bonds stays enhanced after the form until this stat refresh. */
  bolsteredBondsEnhancedUntil: number;
  conduitForm: string;
  /** The particular Unyielding Impact granted by an empowered Call to Anguish. */
  mesmerImpactFlipId: SkillFlipWindow['identity'] | null;
  beguilingHazeCharges: number;
  beguilingHazeReadyAt: number;
  /** Main recharge saved while follow-ups occupy the button; null means no recharge remains. */
  beguilingHazeRecharge: RechargeProgress | null;
}

/** Form-gated effects share the Cosmic Wisdom deadline with form updates, so a hit at that deadline still has it. */
export function revenantConduitFormIsActive(
  state: Partial<ConduitState> | null | undefined,
  form: string,
  at = 0
): boolean {
  return state?.conduitForm === form && buffDeadlineActive(state.cosmicWisdomUntil || 0, at || 0);
}

/** The selected resource policy initializes affinity; form and recharge lifetimes stay with Conduit. */
function createConduitState(): ConduitState {
  return {
    affinity: createResourceClock(),
    cosmicWisdomUntil: 0,
    bolsteredBondsEnhancedUntil: 0,
    // Empty string means no active form; presence is tested via revenantConduitFormIsActive, not a separate boolean.
    conduitForm: '',
    mesmerImpactFlipId: null,
    beguilingHazeCharges: 0,
    beguilingHazeReadyAt: 0,
    beguilingHazeRecharge: null
  };
}

export const conduitState = defineProfessionSpecializationState('Conduit', createConduitState);

/** Select public fields without mutating their owner; the planning observer detaches the result. */
export function projectConduitPlanningState(input: Gw2PlanningStateInput<SpecializationRuntimeState>) {
  const state = conduitState.from(input.profession);
  return {
    [STATE.AFFINITY]: state.affinity,
    [STATE.COSMIC_WISDOM_UNTIL]: state.cosmicWisdomUntil,
    [STATE.CONDUIT_FORM]: state.conduitForm,
    [STATE.BEGUILING_HAZE_CHARGES]: state.beguilingHazeCharges,
    [STATE.BEGUILING_HAZE_READY_AT]: state.beguilingHazeReadyAt
  };
}
