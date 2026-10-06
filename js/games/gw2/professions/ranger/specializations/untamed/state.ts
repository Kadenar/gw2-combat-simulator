import type { ActivationClaims } from '#gw2/platform/combat/procs/activation-claims.js';
import type { RefreshedStacks } from '#gw2/platform/combat/resources/refreshed-stacks.js';
import type { Gw2PlanningStateInput } from '#gw2/platform/results/types.js';
import {
  snapshotProfessionState,
  projectPublicProfessionState,
  definePublicStateDefaults,
  defineProfessionSpecializationState
} from '#gw2/platform/profession-definition/state.js';
import type { RangerConfig, RangerState } from '#gw2/professions/ranger/types.js';

export type RangerInitialUntamedState = 'Pet' | 'Ranger';

export interface UntamedState {
  rangerUnleashed: boolean;
  ambushReadyUntil: number;

  ferociousSymbiosisPlayer: RefreshedStacks;

  ferociousSymbiosisPet: RefreshedStacks;

  untamedActivationClaims: ActivationClaims;
}

// Untamed owns its public unleash, ambush, and resolver-driven Ferocious Symbiosis projection.
export const UNTAMED_PUBLIC_STATE_PROJECTION = definePublicStateDefaults({
  rangerUnleashed: false,
  ambushReadyUntil: 0,
  ferociousSymbiosisPlayer: { stacks: 0, expiresAt: 0 },
  ferociousSymbiosisPet: { stacks: 0, expiresAt: 0 }
} satisfies Partial<RangerState>);

export function createUntamedState(config: RangerConfig = {}): UntamedState {
  return {
    // Default is Pet unleashed; "Ranger" must be explicitly requested.
    rangerUnleashed: config.initialUntamedState === 'Ranger',
    // Zero means no grant; an armed ambush is available only before its deadline while Ranger is unleashed.
    ambushReadyUntil: 0,
    // Tracks the 9-second cooldown before Unleashed Power can grant another ambush window.

    // Separate cooldown for Let Loose (weapon-swap trigger), not related to Unleash cooldown.

    // Player and pet track separate stacks because each cross-triggers the other's buff.
    ferociousSymbiosisPlayer: { stacks: 0, expiresAt: 0 },
    // 0.5s ICD per source prevents multi-hit skills from inflating stacks.

    ferociousSymbiosisPet: { stacks: 0, expiresAt: 0 },

    // Keyed by activationId so multi-hit ambush skills only grant Let Loose buffs once per cast.
    untamedActivationClaims: {}
  };
}

export const untamedState = defineProfessionSpecializationState('Untamed', createUntamedState);

/** Filters expired public values at observation time without queue work or live-state mutation. */
export function projectUntamedPlanningState(input: Gw2PlanningStateInput) {
  const state = snapshotProfessionState(input.profession) as UntamedState;
  if (state.ambushReadyUntil <= input.time) state.ambushReadyUntil = 0;
  return projectPublicProfessionState(
    state,
    UNTAMED_PUBLIC_STATE_PROJECTION.keys,
    UNTAMED_PUBLIC_STATE_PROJECTION.defaults
  );
}
