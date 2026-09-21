import { gw2EffectExpiresAt } from '#gw2/platform/skills/timing.js';
import {
  definePublicStateDefaults,
  defineProfessionSpecializationState
} from '#gw2/platform/engine/profession/state.js';
import type { ElementalistConfig } from '#gw2/professions/elementalist/build/types.js';
import { boundedNumber } from '#kernel/core/numeric.js';

/** Default ceiling for the Jade Sphere energy resource before balance profiles retune it. */
export const CATALYST_MAXIMUM_ENERGY = 30;
/** Default ceiling on concurrent Elemental Empowerment stacks. */
export const CATALYST_MAXIMUM_ELEMENTAL_EMPOWERMENT_STACKS = 10;

/**
 * Catalyst combat bookkeeping: Jade Sphere energy, the per-attunement sphere
 * windows, the timed Elemental Empowerment stack expiries, and the internal
 * cooldown timestamps for the traits that proc off auras, combos and control.
 */
export interface CatalystState {
  energy: number;
  elementalEmpowermentExpiries: number[];
  elementalEmpowermentRefreshStarted: boolean;
  maximumEnergy: number;
  sphereActiveUntil: number;
  sphereExpiry: Record<string, number>;
  shatteringIceUntil: number;
  shatteringIceReadyAt: number;
  viciousEmpowermentReadyAt: number;
  elementalEpitomeReadyAt: Record<string, number>;
  elementalSynergyReadyAt: Record<string, number>;
}

/**
 * Declares the Catalyst specialization state slot, seeding energy from the build's
 * `initialCatalystEnergy` clamped into the resource range.
 */
export const catalystState = defineProfessionSpecializationState(
  'Catalyst',
  (config: ElementalistConfig = {}): CatalystState => ({
    energy: boundedNumber(
      config.initialCatalystEnergy ?? CATALYST_MAXIMUM_ENERGY,
      CATALYST_MAXIMUM_ENERGY,
      0,
      CATALYST_MAXIMUM_ENERGY
    ),
    elementalEmpowermentExpiries: [],
    elementalEmpowermentRefreshStarted: false,
    maximumEnergy: CATALYST_MAXIMUM_ENERGY,
    sphereActiveUntil: 0,
    sphereExpiry: { Fire: 0, Water: 0, Air: 0, Earth: 0 },
    shatteringIceUntil: 0,
    shatteringIceReadyAt: 0,
    viciousEmpowermentReadyAt: 0,
    elementalEpitomeReadyAt: {},
    elementalSynergyReadyAt: {}
  })
);

/** State factory shared by the scheduler and resolver halves of the module. */
export const createCatalystState = catalystState.create;

// Catalyst exposes active stack expiries alongside its resource and sphere timing so
// insertion-aware UI can report the exact Elemental Empowerment stack count.
export const CATALYST_PUBLIC_STATE_PROJECTION = definePublicStateDefaults({
  energy: 0,
  elementalEmpowermentExpiries: [],
  maximumEnergy: CATALYST_MAXIMUM_ENERGY,
  sphereActiveUntil: 0,
  sphereExpiry: { Fire: 0, Water: 0, Air: 0, Earth: 0 }
} satisfies Partial<CatalystState>);

/**
 * Adds timed Elemental Empowerment stacks: expired stacks are dropped first, and
 * once the cap is reached each new stack evicts the soonest-expiring one.
 */
export function grantCatalystElementalEmpowerment(
  state: CatalystState,
  at: number,
  duration: number,
  stacks = 1,
  maximumStacks = CATALYST_MAXIMUM_ELEMENTAL_EMPOWERMENT_STACKS
): void {
  // Timed stacks use the same tick-aligned expiry as their emitted buff applications.
  const expiresAt = gw2EffectExpiresAt(at, Math.max(0, duration));
  const active = state.elementalEmpowermentExpiries.filter((expiry) => expiry > at).sort((left, right) => left - right);

  for (let stack = 0; stack < Math.max(1, stacks); stack += 1) {
    if (active.length >= maximumStacks) {
      active.shift();
    }

    if (expiresAt > at) active.push(expiresAt);
    active.sort((left, right) => left - right);
  }

  state.elementalEmpowermentExpiries = active;
}
