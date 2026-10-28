import { defineProfessionSpecializationState } from '#gw2/platform/profession-definition/state.js';
import type { Gw2PlanningStateInput } from '#gw2/platform/results/types.js';
import type { ElementalistConfig } from '#gw2/professions/elementalist/build/types.js';
import { isElementalistAttunement, type ElementalistAttunement } from '#gw2/professions/elementalist/core/state.js';
import { PROFESSION_STATE_IDS as STATE } from '#gw2/professions/state-ids.js';

/**
 * Runtime state Weaver owns on top of the Elementalist core, which keeps the
 * main-hand (primary) attunement: the off-hand element plus the expiry stamps
 * for Unravel, Weave Self / Perfect Weave, and Fervent Stance.
 */
export interface WeaverState {
  secondaryAttunement: ElementalistAttunement | null;
  unravelUntil: number;
  weaveSelfUntil: number;
  weaveSelfVisited: string[];
  perfectWeaveUntil: number;
  ferventStanceUntil: number;
}

/**
 * Specialization state handle: `create` seeds a fresh state from the build (the
 * off-hand element falls back to the starting attunement, then Fire) and `from`
 * resolves the Weaver slice out of any scheduler or resolver context.
 */
export const weaverState = defineProfessionSpecializationState(
  'Weaver',
  (config: ElementalistConfig = {}): WeaverState => ({
    secondaryAttunement: isElementalistAttunement(config.secondaryAttunement)
      ? config.secondaryAttunement
      : isElementalistAttunement(config.startAttunement)
        ? config.startAttunement
        : 'Fire',
    unravelUntil: 0,
    weaveSelfUntil: 0,
    weaveSelfVisited: [],
    perfectWeaveUntil: 0,
    ferventStanceUntil: 0
  })
);

/** Publish detached, typed facts from Weaver's owner; unrelated runtime fields cannot overwrite them. */
export function projectWeaverPlanningState(input: Gw2PlanningStateInput) {
  const state = weaverState.from(input);
  return {
    [STATE.SECONDARY_ATTUNEMENT]: state.secondaryAttunement,
    [STATE.UNRAVEL_UNTIL]: state.unravelUntil,
    [STATE.WEAVE_SELF_UNTIL]: state.weaveSelfUntil,
    [STATE.WEAVE_SELF_VISITED]: [...state.weaveSelfVisited],
    [STATE.PERFECT_WEAVE_UNTIL]: state.perfectWeaveUntil,
    [STATE.FERVENT_STANCE_UNTIL]: state.ferventStanceUntil
  };
}
