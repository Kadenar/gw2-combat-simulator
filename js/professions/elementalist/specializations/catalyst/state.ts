import { defineProfessionSpecializationState } from '../../../../platform/engine/profession/state.js';
import type { ElementalistConfig } from '../../types.js';

export const CATALYST_MAXIMUM_ENERGY = 30;
export const CATALYST_MAXIMUM_ELEMENTAL_EMPOWERMENT_STACKS = 10;

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

export const CATALYST_PUBLIC_INACTIVE_STATE_DEFAULTS: Readonly<Partial<CatalystState>> = Object.freeze({
  catalystBaseEmpowermentActive: false,
  energy: 0,
  elementalEmpowermentExpiries: [],
  maximumEnergy: CATALYST_MAXIMUM_ENERGY,
  sphereActiveUntil: 0,
  sphereExpiry: { Fire: 0, Water: 0, Air: 0, Earth: 0 }
});

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
