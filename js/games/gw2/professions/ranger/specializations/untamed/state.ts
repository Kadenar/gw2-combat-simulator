import { defineProfessionSpecializationState } from '#gw2/platform/engine/profession/state.js';
import type { RangerConfig, RangerState, UntamedState } from '#gw2/professions/ranger/types.js';

// Untamed owns its public unleash, ambush, and resolver-driven Ferocious Symbiosis projection.
export const UNTAMED_PUBLIC_END_STATE_KEYS: readonly (keyof RangerState)[] = Object.freeze([
  'rangerUnleashed',
  'ambushReadyUntil',
  'ferociousSymbiosisPlayerStacks',
  'ferociousSymbiosisPlayerUntil',
  'ferociousSymbiosisPetStacks',
  'ferociousSymbiosisPetUntil'
]);

export const UNTAMED_RESOLVER_END_STATE_KEYS: readonly (keyof RangerState)[] = Object.freeze([
  'ferociousSymbiosisPlayerStacks',
  'ferociousSymbiosisPlayerUntil',
  'ferociousSymbiosisPetStacks',
  'ferociousSymbiosisPetUntil'
]);

export const UNTAMED_PUBLIC_INACTIVE_STATE_DEFAULTS: Readonly<Partial<RangerState>> = Object.freeze({
  rangerUnleashed: false,
  ambushReadyUntil: 0,
  ferociousSymbiosisPlayerStacks: 0,
  ferociousSymbiosisPlayerUntil: 0,
  ferociousSymbiosisPetStacks: 0,
  ferociousSymbiosisPetUntil: 0
});

export function createUntamedState(config: RangerConfig = {}): UntamedState {
  return {
    // Default is Pet unleashed; "Ranger" must be explicitly requested.
    rangerUnleashed: config.initialUntamedState === 'Ranger',
    // Zero means no ambush window is open (ambush is only available while < current time).
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
