import { requireBalanceNumber } from '#gw2/platform/engine/skills/canonical-skill-catalog.js';
import {
  EVOKER_BALANCE_PROFILES,
  EVOKER_BALANCE_PROFILE_IDS as PROFILE
} from '#gw2/professions/elementalist/specializations/evoker/profiles.js';
import { activeChargeGrants, grantCharges, type ChargeGrant } from '#gw2/platform/combat/resources/charges.js';
import { canonicalTime } from '#kernel/core/clock.js';
import { gw2EffectExpiresAt } from '#gw2/platform/skills/timing.js';
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
} from '#gw2/platform/engine/profession/state.js';
import type { ElementalistConfig } from '#gw2/professions/elementalist/build/types.js';
import { ELEMENTALIST_ATTUNEMENTS, type ElementalistAttunement } from '#gw2/professions/elementalist/core/state.js';
import { boundedNumber } from '#kernel/core/numeric.js';

// Standalone state uses authored capacities until initialization selects the active balance profile.
const resources = EVOKER_BALANCE_PROFILES.find((profile) => profile.id === PROFILE.resources)!;
const maximumCharges = requireBalanceNumber(resources.maximumStacks, 'Evoker resources maximumStacks');
const maximumEmpowered = requireBalanceNumber(resources.minimumStacks, 'Evoker resources minimumStacks');

/** Per-simulation Evoker state carried across every cast, deadline, and accepted impact. */
export interface EvokerState {
  element: ElementalistAttunement;
  charges: number;
  maximumCharges: number;
  // empowered familiar stacks (0-3); reaching the maximum is what makes the flip form castable
  empowered: number;
  // Independent grant windows prevent a later familiar or meditation from refreshing older charges.
  electricEnchantmentGrants: Array<ChargeGrant & { at: number }>;
  // Elemental Balance: entries into the selected element counted toward the threshold, and the armed recharge-window expiry
  elementalBalanceProgress: number;
  elementalBalanceUntil: number;
  // per-trait-profile Evocation internal cooldowns, shared by real swaps and Specialized Elements entries
  attunementTraitProcReadyAt: Record<string, number>;
  // Ignite reaches and retains its final burning tier until inactivity resets it; passive Might has its own ICD.
  igniteTier: number;
  igniteLastUsedAt: number;
  ignitePassiveReadyAt: number;
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
    at: number;
    source: string;
    sourceId: string | number;
    gain: number;
  }>;
}

/**
 * Declares the 'Evoker' specialization state slice: `create` seeds it from the
 * build config, `from(context)` resolves it out of any simulation context.
 */
export const evokerState = defineProfessionSpecializationState(
  'Evoker',
  (config: ElementalistConfig = {}): EvokerState => {
    // pre-simulation default; initialize() in resources.ts overwrites this from the balance profile once traits are resolved
    const element = ELEMENTALIST_ATTUNEMENTS.includes(config.evokerElement as ElementalistAttunement)
      ? (config.evokerElement as ElementalistAttunement)
      : 'Fire';
    return {
      element,
      maximumCharges,
      charges: boundedNumber(config.initialEvokerCharges ?? maximumCharges, maximumCharges, 0, maximumCharges),
      empowered: boundedNumber(config.initialEvokerEmpowered ?? 0, 0, 0, maximumEmpowered),
      electricEnchantmentGrants: [],
      elementalBalanceProgress: 0,
      elementalBalanceUntil: 0,
      attunementTraitProcReadyAt: {},
      igniteTier: 0,
      igniteLastUsedAt: Number.NEGATIVE_INFINITY, // guarantees first use always starts at tier 0 without a special-case check
      ignitePassiveReadyAt: 0,
      lastEmpoweredFamiliarByBasic: {},
      cancelledFamiliarActivations: {},
      activeFamiliarCast: null,
      pendingWeaponCompletions: [],
      pendingWeaponChargeGains: []
    };
  }
);

/** Discards spent or expired grants at the scheduler clock, preserving future queued-hit eligibility. */
export function expireElectricEnchantments(state: EvokerState, at: number): void {
  state.electricEnchantmentGrants = activeChargeGrants(state.electricEnchantmentGrants, at);
}

/** Arms a separate lifetime for each grant; earliest-expiring eligible charges are spent first. */
export function grantElectricEnchantments(state: EvokerState, at: number, stacks: number, duration: number): void {
  state.electricEnchantmentGrants.push({
    ...grantCharges(stacks, gw2EffectExpiresAt(at, duration)),
    at: canonicalTime(at)
  });
  expireElectricEnchantments(state, at);
}

// Evoker publishes familiar resources and Elemental Balance windows.
/** Contributed to the Elementalist family end-state projection. */
export const EVOKER_PUBLIC_STATE_PROJECTION = definePublicStateDefaults({
  element: 'Fire',
  charges: 0,
  maximumCharges,
  empowered: 0,
  elementalBalanceProgress: 0,
  elementalBalanceUntil: 0
} satisfies Partial<EvokerState>);
