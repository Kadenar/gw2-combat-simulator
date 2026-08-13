import { defineProfessionSpecializationState } from "../../../../platform/engine/profession.js";
import type {
  SchedulerConfig,
  SchedulerRecord,
} from "../../../../platform/engine/types.js";

export const CATALYST_MAXIMUM_ENERGY = 30;

export interface CatalystState extends SchedulerRecord {
  energy: number;
  maximumEnergy: number;
  sphereActiveUntil: number;
  sphereExpiry: Record<string, number>;
  shatteringIceUntil: number;
  shatteringIceReadyAt: number;
}

export const catalystState = defineProfessionSpecializationState(
  "Catalyst",
  (config: Readonly<SchedulerConfig> = {}): CatalystState => ({
    energy: Math.max(
      0,
      Math.min(
        CATALYST_MAXIMUM_ENERGY,
        Number(config.initialCatalystEnergy ?? CATALYST_MAXIMUM_ENERGY),
      ),
    ),
    maximumEnergy: CATALYST_MAXIMUM_ENERGY,
    sphereActiveUntil: 0,
    sphereExpiry: { Fire: 0, Water: 0, Air: 0, Earth: 0 },
    shatteringIceUntil: 0,
    shatteringIceReadyAt: 0,
  }),
);

export const createCatalystState = catalystState.create;
