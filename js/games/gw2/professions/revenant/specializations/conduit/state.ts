import {
  balanceProfileNumber,
  requireBalanceProfileFromContext
} from '#gw2/platform/engine/skills/balance-profiles.js';
import { hasTrait } from '#gw2/platform/combat/state/traits.js';
import { CONDUIT_BALANCE_PROFILE_IDS as PROFILE } from '#gw2/professions/revenant/specializations/conduit/profiles.js';
import { REVENANT_TRAIT_IDS as TRAIT } from '#gw2/professions/revenant/data/ids.js';
import type { RevenantRuntime } from '#gw2/professions/revenant/core/events.js';
import {
  definePublicStateDefaults,
  defineProfessionSpecializationState
} from '#gw2/platform/engine/profession/state.js';
import type { RechargeProgress } from '#gw2/platform/engine/skills/recharge.js';

export interface ConduitState {
  affinity: number;
  affinityMaximum: number;
  cosmicWisdomUntil: number;
  conduitForm: string;
  beguilingHazeCharges: number;
  beguilingHazeReadyAt: number;
  beguilingHazeRecharge: RechargeProgress | null;
  energyCostOverrides: Record<string, number>;
  mistfireReadyAt: number;
}

export const CONDUIT_PUBLIC_STATE_PROJECTION = definePublicStateDefaults({
  affinity: 0,
  cosmicWisdomUntil: 0,
  conduitForm: '',
  beguilingHazeCharges: 0,
  beguilingHazeReadyAt: 0
} satisfies Partial<ConduitState>);

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
    beguilingHazeRecharge: null,
    // Tracks in-flight main-cast reservations so follow-up charges arm exactly once per main cast, not per follow-up.
    // Only populated during Mesmer form; cleared on form exit so native legend skill costs are restored.
    energyCostOverrides: {},
    mistfireReadyAt: 0
  };
}

export const conduitState = defineProfessionSpecializationState('Conduit', createConduitState);

/** Kinetic Insight adds a virtual +2 affinity for scaling without changing the stored value. */
export function effectiveConduitAffinity(runtime: RevenantRuntime): number {
  const maximum = Math.max(
    1,
    balanceProfileNumber(requireBalanceProfileFromContext(runtime, PROFILE.affinity), 'maximumStacks')
  );
  return Math.min(
    maximum,
    Number(conduitState.from(runtime).affinity || 0) + (hasTrait(runtime, TRAIT.KINETIC_INSIGHT) ? 2 : 0)
  );
}
