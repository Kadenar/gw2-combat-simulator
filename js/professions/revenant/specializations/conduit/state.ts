import type { ConduitState } from '../../types.js';
import { defineProfessionSpecializationState } from '../../../../platform/engine/profession/state.js';

export const CONDUIT_PUBLIC_END_STATE_KEYS: readonly (keyof ConduitState)[] = Object.freeze([
  'affinity',
  'cosmicWisdomUntil',
  'conduitForm',
  'beguilingHazeCharges',
  'beguilingHazeReadyAt'
]);

export const CONDUIT_PUBLIC_INACTIVE_STATE_DEFAULTS: Readonly<Partial<ConduitState>> = Object.freeze({
  affinity: 0,
  cosmicWisdomUntil: 0,
  conduitForm: '',
  beguilingHazeCharges: 0,
  beguilingHazeReadyAt: 0
});

export function revenantConduitFormIsActive(
  state: Partial<ConduitState> | null | undefined,
  form: string,
  at = 0
): boolean {
  return state?.conduitForm === form && Number(state.cosmicWisdomUntil || 0) > Number(at || 0);
}

export function createConduitState(): ConduitState {
  return {
    affinity: 0,
    affinityMaximum: 5,
    cosmicWisdomUntil: 0,
    // Empty string means no active form; presence is tested via revenantConduitFormIsActive, not a separate boolean.
    conduitForm: '',
    beguilingHazeCharges: 0,
    beguilingHazeReadyAt: 0,
    // Tracks in-flight main-cast reservations so follow-up charges arm exactly once per main cast, not per follow-up.
    beguilingHazeMainReservations: [],
    // Only populated during Mesmer form; cleared on form exit so native legend skill costs are restored.
    energyCostOverrides: {},
    // Conduit-local timers keep affinity and dagger cadence out of shared upkeep records.
    upkeepAffinityNextAt: {},
    impossibleOddsLesserDaggersNextAt: null,
    mistfireReadyAt: 0
  };
}

export const conduitState = defineProfessionSpecializationState('Conduit', createConduitState);
