import type { ActivationClaims } from '#gw2/platform/combat/procs/activation-claims.js';
import type { RefreshedStacks } from '#gw2/platform/combat/resources/refreshed-stacks.js';
import { cloneStateFields, defineProfessionSpecializationState } from '#gw2/platform/profession-definition/state.js';
import type { Gw2PlanningStateInput } from '#gw2/platform/results/types.js';
import type { RangerConfig } from '#gw2/professions/ranger/types.js';
import { PROFESSION_STATE_IDS as STATE } from '#gw2/professions/state-ids.js';

export type RangerInitialUntamedState = 'Pet' | 'Ranger';

export interface UntamedState {
  rangerUnleashed: boolean;
  ambushReadyUntil: number;

  ferociousSymbiosisPlayer: RefreshedStacks;

  biorhythmArmed: boolean;

  untamedActivationClaims: ActivationClaims;
}

export function createUntamedState(config: RangerConfig = {}): UntamedState {
  return {
    // Default is Pet unleashed; "Ranger" must be explicitly requested.
    rangerUnleashed: config.initialUntamedState === 'Ranger',
    // Zero means no grant; an armed ambush is available only before its deadline while Ranger is unleashed.
    ambushReadyUntil: 0,
    // Player and pet track separate stacks because each cross-triggers the other's buff.
    ferociousSymbiosisPlayer: { stacks: 0, expiresAt: 0 },
    // Stack expiry never revokes an earned Vow; a new unleash consumes it and replaces the stack cycle.
    biorhythmArmed: false,
    // Keyed by activationId so multi-hit ambush skills only grant Let Loose buffs once per cast.
    untamedActivationClaims: {}
  };
}

export const untamedState = defineProfessionSpecializationState('Untamed', createUntamedState);

/** Detach public fields before hiding expired ambushes, leaving private activation claims untouched. */
export function projectUntamedPlanningState(input: Gw2PlanningStateInput) {
  const state = cloneStateFields(untamedState.from(input), [
    'rangerUnleashed',
    'ambushReadyUntil',
    'ferociousSymbiosisPlayer'
  ]);

  if (state.ambushReadyUntil <= input.time) state.ambushReadyUntil = 0;

  return {
    [STATE.RANGER_UNLEASHED]: state.rangerUnleashed,
    [STATE.AMBUSH_READY_UNTIL]: state.ambushReadyUntil,
    [STATE.FEROCIOUS_SYMBIOSIS_PLAYER]: state.ferociousSymbiosisPlayer
  };
}
