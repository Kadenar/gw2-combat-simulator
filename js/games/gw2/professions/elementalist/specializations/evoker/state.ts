import type { ChargeGrant } from '#gw2/platform/combat/resources/charges.js';
/**
 * Mutable Evoker specialization state.
 *
 * Holds the selected familiar element, the familiar charge/empowered economy,
 * trait timers (Evocation ICDs, Ignite tiering, Elemental Balance), and the
 * bookkeeping ledgers that let familiar casts interrupt, defer, and re-apply
 * work scheduled by surrounding commands. One instance owns accepted casts,
 * completion grants, and impact reactions throughout the simulation.
 */
import {
  definePublicStateDefaults,
  defineProfessionSpecializationState
} from '#gw2/platform/profession-definition/state.js';
import type { ElementalistConfig } from '#gw2/professions/elementalist/build/types.js';
import { ELEMENTALIST_ATTUNEMENTS, type ElementalistAttunement } from '#gw2/professions/elementalist/core/state.js';
import { createResourceClock } from '#gw2/platform/combat/resources/clock.js';
import type { ResourceClock } from '#gw2/platform/combat/resources/clock.js';

/** Per-simulation Evoker state carried across every cast, deadline, and accepted impact. */
export interface EvokerState {
  element: ElementalistAttunement;
  familiarCharges: ResourceClock;
  // empowered familiar stacks (0-3); reaching the maximum is what makes the flip form castable
  empoweredCharges: ResourceClock;
  // Independent grant windows prevent a later familiar or meditation from refreshing older charges.
  electricEnchantmentGrants: Array<ChargeGrant & { at: number }>;
  // Elemental Balance: entries into the selected element counted toward the threshold, and the armed recharge-window expiry
  elementalBalanceProgress: number;
  elementalBalanceUntil: number;
  // per-trait-profile Evocation internal cooldowns, shared by real swaps and Specialized Elements entries

  // Ignite reaches and retains its final burning tier until inactivity resets it; passive Might has its own ICD.
  igniteTier: number;
  igniteLastUsedAt: number;
  // most recent empowered familiar cast per basic familiar, used to detect flip-interrupt windows
  lastEmpoweredFamiliarByBasic: Record<
    string,
    { skillId: string | number; activationId: string; start: number } | null
  >;
  // reservations whose own effects must be cancelled once their scheduling finishes
  cancelledFamiliarActivations: Record<string, boolean>;
  // the familiar cast currently in flight; blocks other casts and defers charge grants that its reset would wipe
  activeFamiliarCast: {
    reservationId: string;
    endsAt: number;
    resetsCharges: boolean;
  } | null;
  // Pending parent grants let an early familiar input wait until its charges become available.
  pendingWeaponCompletions: Array<{ activationId: string; at: number; gain: number }>;
  // charge grants deferred past a charge-resetting familiar cast, replayed once it completes
  pendingWeaponChargeGains: Array<{
    activationId: string;
    source: string;
    sourceId: string | number;
    gain: number;
  }>;
}

/**
 * Allocates Evoker state and empty pool clocks; selected resource policies seed their values and capacities.
 */
export const evokerState = defineProfessionSpecializationState(
  'Evoker',
  (config: ElementalistConfig = {}): EvokerState => {
    // Familiar selection is configuration; resource initialization is owned by the selected policies.
    const element = ELEMENTALIST_ATTUNEMENTS.includes(config.evokerElement as ElementalistAttunement)
      ? (config.evokerElement as ElementalistAttunement)
      : 'Fire';
    return {
      element,
      familiarCharges: createResourceClock(),
      empoweredCharges: createResourceClock(),
      electricEnchantmentGrants: [],
      elementalBalanceProgress: 0,
      elementalBalanceUntil: 0,

      igniteTier: 0,
      igniteLastUsedAt: Number.NEGATIVE_INFINITY, // guarantees first use always starts at tier 0 without a special-case check
      lastEmpoweredFamiliarByBasic: {},
      cancelledFamiliarActivations: {},
      activeFamiliarCast: null,
      pendingWeaponCompletions: [],
      pendingWeaponChargeGains: []
    };
  }
);

// Evoker publishes familiar resources and Elemental Balance windows.
/** Contributed to the Elementalist family end-state projection. */
export const EVOKER_PUBLIC_STATE_PROJECTION = definePublicStateDefaults({
  element: 'Fire',
  familiarCharges: createResourceClock(),
  empoweredCharges: createResourceClock(),
  elementalBalanceProgress: 0,
  elementalBalanceUntil: 0
} satisfies Partial<EvokerState>);
