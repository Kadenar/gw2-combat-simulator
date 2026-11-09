/**
 * Stores mutable Evoker state for one run. Includes the selected familiar element, charges, empowered stacks,
 * and timers for Evocation, Ignite tiers, and Elemental Balance.
 * Familiar execution bookkeeping belongs to the familiar lifecycle.
 */
import type { ChargeGrant } from '#gw2/platform/combat/resources/charges.js';
import { createResourceClock } from '#gw2/platform/combat/resources/clock.js';
import type { ResourceClock } from '#gw2/platform/combat/resources/clock.js';
import {
  defineProfessionSpecializationState,
  type SpecializationRuntimeState
} from '#gw2/platform/profession-definition/state.js';
import type { Gw2PlanningStateInput } from '#gw2/platform/results/types.js';
import type { SkillId } from '#gw2/platform/skills/types.js';
import type { ElementalistConfig } from '#gw2/professions/elementalist/build/types.js';
import { ELEMENTALIST_ATTUNEMENTS, type ElementalistAttunement } from '#gw2/professions/elementalist/core/state.js';
import { PROFESSION_STATE_IDS as STATE } from '#gw2/professions/state-ids.js';

/** Per-simulation Evoker state carried across every cast, deadline, and accepted impact. */
export interface EvokerState {
  element: ElementalistAttunement;
  familiarCharges: ResourceClock;
  // empowered familiar stacks (0-3); reaching the maximum is what makes the flip form castable
  empoweredCharges: ResourceClock;
  // Independent grant windows prevent a later familiar or meditation from refreshing older charges; a trait grant keeps
  // its owner so consuming its charge is trait-owned.
  electricEnchantmentGrants: Array<ChargeGrant & { at: number; traitId?: SkillId }>;
  // Elemental Balance: entries into the selected element counted toward the threshold, and the armed recharge-window expiry
  elementalBalanceProgress: number;
  elementalBalanceUntil: number;
  // per-trait-profile Evocation internal cooldowns, shared by real swaps and Specialized Elements entries

  // Ignite reaches and retains its final burning tier until inactivity resets it; passive Might has its own ICD.
  igniteTier: number;
  igniteLastUsedAt: number;
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
      igniteLastUsedAt: Number.NEGATIVE_INFINITY // guarantees first use always starts at tier 0 without a special-case check
    };
  }
);

/** Select public fields without mutating their owner; the planning observer detaches the result. */
export function projectEvokerPlanningState(input: Gw2PlanningStateInput<SpecializationRuntimeState>) {
  const state = evokerState.from(input.profession);
  return {
    [STATE.ELEMENT]: state.element,
    [STATE.FAMILIAR_CHARGES]: state.familiarCharges,
    [STATE.EMPOWERED_CHARGES]: state.empoweredCharges,
    [STATE.ELEMENTAL_BALANCE_UNTIL]: state.elementalBalanceUntil
  };
}
