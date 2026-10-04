import {
  defineProfessionSpecializationState,
  definePublicStateDefaults
} from '#gw2/platform/profession-definition/state.js';
import type { ResourceClock } from '#gw2/platform/combat/resources/clock.js';
import { createResourceClock } from '#gw2/platform/combat/resources/resource-policy.js';

/**
 * Catalyst combat bookkeeping: Jade Sphere energy, the per-attunement sphere
 * windows, the timed Elemental Empowerment stack expiries, and the internal
 * cooldown timestamps for the traits that proc off auras, combos and control.
 */
export interface CatalystState {
  catalystEnergy: ResourceClock;
  elementalEmpowermentExpiries: number[];
  elementalEmpowermentRefreshStarted: boolean;
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
  elementalEmpowermentRefreshStarted: false,
  sphereActiveUntil: 0,
  sphereExpiry: { Fire: 0, Water: 0, Air: 0, Earth: 0 },
  shatteringIceUntil: 0
}));

// Catalyst exposes active stack expiries alongside its resource and sphere timing so
// insertion-aware UI can report the exact Elemental Empowerment stack count.
export const CATALYST_PUBLIC_STATE_PROJECTION = definePublicStateDefaults({
  catalystEnergy: createResourceClock(),
  elementalEmpowermentExpiries: [],
  sphereActiveUntil: 0,
  sphereExpiry: { Fire: 0, Water: 0, Air: 0, Earth: 0 }
} satisfies Partial<CatalystState>);
