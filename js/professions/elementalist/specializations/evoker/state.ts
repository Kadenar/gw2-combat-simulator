import { defineProfessionSpecializationState } from "../../../../platform/engine/profession.js";
import type { ElementalistConfig } from "../../types.js";
import {
  ELEMENTALIST_ATTUNEMENTS,
  type ElementalistAttunement,
} from "../../core/state.js";

export interface EvokerState {
  element: ElementalistAttunement;
  charges: number;
  maximumCharges: number;
  empowered: number;
  electricEnchantmentStacks: number;
  elementalBalanceProgress: number;
  elementalBalanceUntil: number;
  igniteTier: number;
  igniteLastUsedAt: number;
  ignitePassiveReadyAt: number;
  lastEmpoweredFamiliarByBasic: Record<
    string,
    { skill: string; activationId: string; start: number } | null
  >;
  cancelledFamiliarActivations: Record<string, boolean>;
  pendingOffAttunementRemainingByCommand: Record<
    number,
    Partial<Record<ElementalistAttunement, number>>
  >;
  activeFamiliarCast: {
    reservationId: string;
    endsAt: number;
    resetsCharges: boolean;
  } | null;
  concurrentParentAnchors: Array<{
    commandIndex: number;
    weaponChargeGain: {
      activationId: string;
      at: number;
      source: string;
      sourceId: string | number;
      gain: number;
    } | null;
  }>;
  pendingWeaponChargeGains: Array<{
    activationId: string;
    at: number;
    source: string;
    sourceId: string | number;
    gain: number;
  }>;
}

export const evokerState = defineProfessionSpecializationState(
  "Evoker",
  (config: ElementalistConfig = {}): EvokerState => {
    const maximumCharges =
      Array.isArray(config.selectedTraits) &&
      config.selectedTraits.includes("Specialized Elements")
        ? 4
        : 6;
    const element = ELEMENTALIST_ATTUNEMENTS.includes(
      config.evokerElement as ElementalistAttunement,
    )
      ? (config.evokerElement as ElementalistAttunement)
      : "Fire";
    return {
      element,
      maximumCharges,
      charges: Math.max(
        0,
        Math.min(
          maximumCharges,
          Number(config.initialEvokerCharges ?? maximumCharges),
        ),
      ),
      empowered: Math.max(
        0,
        Math.min(3, Number(config.initialEvokerEmpowered ?? 0)),
      ),
      electricEnchantmentStacks: 0,
      elementalBalanceProgress: 0,
      elementalBalanceUntil: 0,
      igniteTier: 0,
      igniteLastUsedAt: Number.NEGATIVE_INFINITY,
      ignitePassiveReadyAt: 0,
      lastEmpoweredFamiliarByBasic: {},
      cancelledFamiliarActivations: {},
      pendingOffAttunementRemainingByCommand: {},
      activeFamiliarCast: null,
      concurrentParentAnchors: [],
      pendingWeaponChargeGains: [],
    };
  },
);

export const createEvokerState = evokerState.create;
