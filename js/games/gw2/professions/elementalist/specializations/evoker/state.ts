/**
 * Mutable Evoker specialization state.
 *
 * Holds the selected familiar element, the familiar charge/empowered economy,
 * trait timers (Evocation ICDs, Ignite tiering, Elemental Balance), and the
 * bookkeeping ledgers that let familiar casts interrupt, defer, and re-apply
 * work scheduled by surrounding commands. Shared by the scheduler and resolver
 * passes, which each build their own instance from the same factory.
 */
import { defineProfessionSpecializationState } from '#gw2/platform/engine/profession/state.js';
import type { ElementalistConfig } from '#gw2/professions/elementalist/build/types.js';
import { ELEMENTALIST_ATTUNEMENTS, type ElementalistAttunement } from '#gw2/professions/elementalist/core/state.js';

/** Per-simulation Evoker state carried across every cast, hook, and resolver pass. */
export interface EvokerState {
  element: ElementalistAttunement;
  charges: number;
  maximumCharges: number;
  // empowered familiar stacks (0-3); reaching the maximum is what makes the flip form castable
  empowered: number;
  // armed Galvanic Enchantment charges; each is consumed by the next qualifying player strike
  electricEnchantmentStacks: number;
  // Elemental Balance: entries into the selected element counted toward the threshold, and the armed recharge-window expiry
  elementalBalanceProgress: number;
  elementalBalanceUntil: number;
  // per-trait-profile Evocation internal cooldowns, shared by real swaps and Specialized Elements entries
  attunementTraitProcReadyAt: Record<string, number>;
  // Ignite cycles its burning duration through four tiers; the tier resets when unused long enough, and its passive Might proc keeps its own ICD
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
  // keyed by commandIndex (not reservationId) because availability runs at command scheduling time, before the event fires
  pendingOffAttunementRemainingByCommand: Record<number, Partial<Record<ElementalistAttunement, number>>>;
  // the familiar cast currently in flight; blocks other casts and defers charge grants that its reset would wipe
  activeFamiliarCast: {
    reservationId: string;
    endsAt: number;
    resetsCharges: boolean;
  } | null;
  // charge grants owned by non-concurrent parent commands, so a concurrent familiar can take one over before resetting charges
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

/** Factory used for both the scheduler and resolver state instances. */
export const createEvokerState = evokerState.create;

// Evoker owns familiar resources and its public element/enchantment state.
/** Contributed to the Elementalist family end-state projection. */
export const EVOKER_PUBLIC_END_STATE_KEYS = Object.freeze([
  'element',
  'charges',
  'maximumCharges',
  'empowered',
  'electricEnchantmentStacks',
  'elementalBalanceProgress',
  'elementalBalanceUntil'
] as const satisfies readonly (keyof EvokerState)[]);

/**
 * Substituted for the public keys when the simulated build is not Evoker, so the
 * family end-state result keeps a stable shape across specializations.
 */
export const EVOKER_PUBLIC_INACTIVE_STATE_DEFAULTS: Readonly<Partial<EvokerState>> = Object.freeze({
  element: 'Fire',
  charges: 0,
  maximumCharges: 6,
  empowered: 0,
  electricEnchantmentStacks: 0,
  elementalBalanceProgress: 0,
  elementalBalanceUntil: 0
});
