import type { ResourceClock } from '#gw2/platform/combat/resources/clock.js';
import { createResourceClock } from '#gw2/platform/combat/resources/clock.js';
import type { RefreshedStacks } from '#gw2/platform/combat/resources/refreshed-stacks.js';
import { defineProfessionSpecializationState } from '#gw2/platform/profession-definition/state.js';
import type { Gw2PlanningStateInput } from '#gw2/platform/results/types.js';
import { createPeriodicTaskState, type PeriodicTaskState } from '#gw2/platform/simulation/periodic-task.js';
import { PROFESSION_STATE_IDS as STATE } from '#gw2/professions/state-ids.js';

/**
 * Catalyst combat bookkeeping: Jade Sphere energy, the per-attunement sphere
 * windows, the timed Elemental Empowerment stack expiries, and the internal
 * cooldown timestamps for the traits that proc off auras, combos and control.
 */
export interface CatalystState {
  catalystEnergy: ResourceClock;
  elementalEmpowermentExpiries: number[];
  empoweringAuras: RefreshedStacks;
  baseEmpowerment: PeriodicTaskState;
  sphereActiveUntil: number;
  sphereExpiry: Record<string, number>;
  shatteringIceUntil: number;
}

/**
 * Creates a detached energy clock; the selected policy owns profile-aware capacity and initial energy.
 */
export const catalystState = defineProfessionSpecializationState('Catalyst', (): CatalystState => ({
  catalystEnergy: createResourceClock(),
  elementalEmpowermentExpiries: [],
  empoweringAuras: { stacks: 0, expiresAt: 0 },
  baseEmpowerment: createPeriodicTaskState(),
  sphereActiveUntil: 0,
  sphereExpiry: { Fire: 0, Water: 0, Air: 0, Earth: 0 },
  shatteringIceUntil: 0
}));

/** Publish detached, typed observations from this module's owner under stable public IDs. */
export function projectCatalystPlanningState(input: Gw2PlanningStateInput) {
  const state = catalystState.from(input);
  return structuredClone({
    [STATE.CATALYST_ENERGY]: state.catalystEnergy,
    [STATE.ELEMENTAL_EMPOWERMENT_EXPIRIES]: state.elementalEmpowermentExpiries,
    [STATE.EMPOWERING_AURAS]: state.empoweringAuras,
    [STATE.SPHERE_EXPIRY]: state.sphereExpiry
  });
}
