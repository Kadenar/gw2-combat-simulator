import {
  definePublicStateDefaults,
  defineProfessionSpecializationState
} from '#gw2/platform/engine/profession/state.js';
import type { RangerConfig, RangerState } from '#gw2/professions/ranger/types.js';

export type RangerInitialUntamedState = 'Pet' | 'Ranger';

export interface UntamedState {
  rangerUnleashed: boolean;
  ambushReadyUntil: number;
  unleashedPowerReadyAt: number;
  letLooseReadyAt: number;
  debilitatingBlowsReadyAt: number;
  enhancingImpactReadyAt: number;
  ferociousSymbiosisPlayerStacks: number;
  ferociousSymbiosisPlayerUntil: number;
  ferociousSymbiosisPlayerReadyAt: number;
  ferociousSymbiosisPetStacks: number;
  ferociousSymbiosisPetUntil: number;
  ferociousSymbiosisPetReadyAt: number;
  letLooseActivations: Record<string, boolean>;
}

// Untamed owns its public unleash, ambush, and resolver-driven Ferocious Symbiosis projection.
export const UNTAMED_PUBLIC_STATE_PROJECTION = definePublicStateDefaults({
  rangerUnleashed: false,
  ambushReadyUntil: 0,
  ferociousSymbiosisPlayerStacks: 0,
  ferociousSymbiosisPlayerUntil: 0,
  ferociousSymbiosisPetStacks: 0,
  ferociousSymbiosisPetUntil: 0
} satisfies Partial<RangerState>);

export function createUntamedState(config: RangerConfig = {}): UntamedState {
  return {
    // Default is Pet unleashed; "Ranger" must be explicitly requested.
    rangerUnleashed: config.initialUntamedState === 'Ranger',
    // Zero means no grant; an armed ambush is available only before its deadline while Ranger is unleashed.
    ambushReadyUntil: 0,
    // Tracks the 9-second cooldown before Unleashed Power can grant another ambush window.
    unleashedPowerReadyAt: 0,
    // Separate cooldown for Let Loose (weapon-swap trigger), not related to Unleash cooldown.
    letLooseReadyAt: 0,
    debilitatingBlowsReadyAt: 0,
    enhancingImpactReadyAt: 0,
    // Player and pet track separate stacks because each cross-triggers the other's buff.
    ferociousSymbiosisPlayerStacks: 0,
    ferociousSymbiosisPlayerUntil: 0,
    // 0.5s ICD per source prevents multi-hit skills from inflating stacks.
    ferociousSymbiosisPlayerReadyAt: 0,
    ferociousSymbiosisPetStacks: 0,
    ferociousSymbiosisPetUntil: 0,
    ferociousSymbiosisPetReadyAt: 0,
    // Keyed by activationId so multi-hit ambush skills only grant Let Loose buffs once per cast.
    letLooseActivations: {}
  };
}

export const untamedState = defineProfessionSpecializationState('Untamed', createUntamedState);
