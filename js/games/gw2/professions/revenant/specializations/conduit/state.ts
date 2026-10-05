import {
  definePublicStateDefaults,
  defineProfessionSpecializationState
} from '#gw2/platform/profession-definition/state.js';
import type { RechargeProgress } from '#gw2/platform/execution/recharge.js';
import type { ResourceClock } from '#gw2/platform/combat/resources/clock.js';
import { createResourceClock } from '#gw2/platform/combat/resources/resource-policy.js';

export interface ConduitState {
  affinity: ResourceClock;
  cosmicWisdomUntil: number;
  conduitForm: string;
  beguilingHazeCharges: number;
  beguilingHazeReadyAt: number;
  beguilingHazeRecharge: RechargeProgress | null;
  energyCostOverrides: Record<string, number>;
}

export const CONDUIT_PUBLIC_STATE_PROJECTION = definePublicStateDefaults({
  affinity: createResourceClock(),
  cosmicWisdomUntil: 0,
  conduitForm: '',
  beguilingHazeCharges: 0,
  beguilingHazeReadyAt: 0,
  // Palette affordability consumes the same patched costs as the live form.
  energyCostOverrides: {} as Record<string, number>
} satisfies Partial<ConduitState>);

export function revenantConduitFormIsActive(
  state: Partial<ConduitState> | null | undefined,
  form: string,
  at = 0
): boolean {
  return state?.conduitForm === form && (state.cosmicWisdomUntil || 0) > (at || 0);
}

/** The selected resource policy initializes affinity; form and recharge lifetimes stay with Conduit. */
function createConduitState(): ConduitState {
  return {
    affinity: createResourceClock(),
    cosmicWisdomUntil: 0,
    // Empty string means no active form; presence is tested via revenantConduitFormIsActive, not a separate boolean.
    conduitForm: '',
    beguilingHazeCharges: 0,
    beguilingHazeReadyAt: 0,
    beguilingHazeRecharge: null,
    // Tracks in-flight main-cast reservations so follow-up charges arm exactly once per main cast, not per follow-up.
    // Only populated during Mesmer form; cleared on form exit so native legend skill costs are restored.
    energyCostOverrides: {}
  };
}

export const conduitState = defineProfessionSpecializationState('Conduit', createConduitState);
