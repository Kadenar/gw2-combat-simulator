import { defineProfessionSpecializationState } from "../../../../platform/engine/profession.js";
import type { ElementalistConfig } from "../../types.js";

export const CATALYST_MAXIMUM_ENERGY = 30;
export const CATALYST_MAXIMUM_ELEMENTAL_EMPOWERMENT_STACKS = 10;

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

export const catalystState = defineProfessionSpecializationState(
  "Catalyst",
  (config: ElementalistConfig = {}): CatalystState => ({
    energy: Math.max(
      0,
      Math.min(
        CATALYST_MAXIMUM_ENERGY,
        Number(config.initialCatalystEnergy ?? CATALYST_MAXIMUM_ENERGY),
      ),
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
    elementalSynergyReadyAt: {},
  }),
);

export const createCatalystState = catalystState.create;

export function grantCatalystElementalEmpowerment(
  state: CatalystState,
  at: number,
  duration: number,
  stacks = 1,
  epsilon = Number.EPSILON,
  maximumStacks = CATALYST_MAXIMUM_ELEMENTAL_EMPOWERMENT_STACKS,
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
