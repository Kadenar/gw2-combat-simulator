import { defineProfessionSpecializationState } from "../../../../platform/engine/profession.js";
import type { ElementalistConfig } from "../../types.js";

export const CATALYST_MAXIMUM_ENERGY = 30;

export interface CatalystState {
  energy: number;
  elementalEmpowermentExpiries: number[];
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
