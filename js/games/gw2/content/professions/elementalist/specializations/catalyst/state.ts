import { defineProfessionSpecializationState } from '#gw2/platform/engine/profession/state.js';
import type { ElementalistConfig } from '#gw2/content/professions/elementalist/types.js';

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
  catalystBaseEmpowermentActive: boolean;
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
    catalystBaseEmpowermentActive: false,
    energy: Math.max(
      0,
      Math.min(CATALYST_MAXIMUM_ENERGY, Number(config.initialCatalystEnergy ?? CATALYST_MAXIMUM_ENERGY))
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
export const CATALYST_PUBLIC_END_STATE_KEYS = Object.freeze([
  'catalystBaseEmpowermentActive',
  'energy',
  'elementalEmpowermentExpiries',
  'maximumEnergy',
  'sphereActiveUntil',
  'sphereExpiry'
] as const satisfies readonly (keyof CatalystState)[]);

/** Values reported for the published Catalyst keys when Catalyst is not the active specialization. */
export const CATALYST_PUBLIC_INACTIVE_STATE_DEFAULTS: Readonly<Partial<CatalystState>> = Object.freeze({
  catalystBaseEmpowermentActive: false,
  energy: 0,
  elementalEmpowermentExpiries: [],
  maximumEnergy: CATALYST_MAXIMUM_ENERGY,
  sphereActiveUntil: 0,
  sphereExpiry: { Fire: 0, Water: 0, Air: 0, Earth: 0 }
});

/**
 * Adds timed Elemental Empowerment stacks: expired stacks are dropped first, and
 * once the cap is reached each new stack evicts the soonest-expiring one.
 */
export function grantCatalystElementalEmpowerment(
  state: CatalystState,
  at: number,
  duration: number,
  stacks = 1,
  epsilon = Number.EPSILON,
  maximumStacks = CATALYST_MAXIMUM_ELEMENTAL_EMPOWERMENT_STACKS
): void {
  const expiresAt = at + Math.max(0, duration);
  const active = state.elementalEmpowermentExpiries
    .filter((expiry) => expiry > at + epsilon)
    .sort((left, right) => left - right);

  for (let stack = 0; stack < Math.max(1, stacks); stack += 1) {
    if (active.length >= maximumStacks) {
      active.shift();
    }

    if (expiresAt > at + epsilon) active.push(expiresAt);
    active.sort((left, right) => left - right);
  }

  state.elementalEmpowermentExpiries = active;
}
