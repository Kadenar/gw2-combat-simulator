import { defineProfessionSpecializationState } from '../../../../platform/engine/profession.js';
import type { ElementalistConfig } from '../../types.js';
import { ELEMENTALIST_ATTUNEMENTS, type ElementalistAttunement } from '../../core/state.js';

export interface EvokerState {
  element: ElementalistAttunement;
  charges: number;
  maximumCharges: number;
  empowered: number;
  electricEnchantmentStacks: number;
  elementalBalanceProgress: number;
  elementalBalanceUntil: number;
  attunementTraitProcReadyAt: Record<string, number>;
  igniteTier: number;
  igniteLastUsedAt: number;
  ignitePassiveReadyAt: number;
  lastEmpoweredFamiliarByBasic: Record<string, { skill: string; activationId: string; start: number } | null>;
  cancelledFamiliarActivations: Record<string, boolean>;
  // keyed by commandIndex (not reservationId) because availability runs at command scheduling time, before the event fires
  pendingOffAttunementRemainingByCommand: Record<number, Partial<Record<ElementalistAttunement, number>>>;
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
  'Evoker',
  (config: ElementalistConfig = {}): EvokerState => {
    // pre-simulation default; initialize() in resources.ts overwrites this from the balance profile once traits are resolved
    const maximumCharges = 6;
    const element = ELEMENTALIST_ATTUNEMENTS.includes(config.evokerElement as ElementalistAttunement)
      ? (config.evokerElement as ElementalistAttunement)
      : 'Fire';
    return {
      element,
      maximumCharges,
      charges: Math.max(0, Math.min(maximumCharges, Number(config.initialEvokerCharges ?? maximumCharges))),
      empowered: Math.max(0, Math.min(3, Number(config.initialEvokerEmpowered ?? 0))),
      electricEnchantmentStacks: 0,
      elementalBalanceProgress: 0,
      elementalBalanceUntil: 0,
      attunementTraitProcReadyAt: {},
      igniteTier: 0,
      igniteLastUsedAt: Number.NEGATIVE_INFINITY, // guarantees first use always starts at tier 0 without a special-case check
      ignitePassiveReadyAt: 0,
      lastEmpoweredFamiliarByBasic: {},
      cancelledFamiliarActivations: {},
      pendingOffAttunementRemainingByCommand: {},
      activeFamiliarCast: null,
      concurrentParentAnchors: [],
      pendingWeaponChargeGains: []
    };
  }
);

export const createEvokerState = evokerState.create;

// Evoker owns familiar resources and its public element/enchantment state.
export const EVOKER_PUBLIC_END_STATE_KEYS = Object.freeze([
  'element',
  'charges',
  'maximumCharges',
  'empowered',
  'electricEnchantmentStacks',
  'elementalBalanceProgress',
  'elementalBalanceUntil'
] as const satisfies readonly (keyof EvokerState)[]);

export const EVOKER_PUBLIC_INACTIVE_STATE_DEFAULTS: Readonly<Partial<EvokerState>> = Object.freeze({
  element: 'Fire',
  charges: 0,
  maximumCharges: 6,
  empowered: 0,
  electricEnchantmentStacks: 0,
  elementalBalanceProgress: 0,
  elementalBalanceUntil: 0
});
