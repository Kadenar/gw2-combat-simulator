import type { ActivationClaims } from '#gw2/platform/combat/procs/activation-claims.js';
import { createResourceClock } from '#gw2/platform/combat/resources/clock.js';
import { type SkillFlipWindows } from '#gw2/platform/execution/skill-flips.js';
import type { ResourceClock } from '#gw2/platform/combat/resources/clock.js';
import { normalizeRevenantLegendIds } from '#gw2/professions/revenant/data/legends.js';
import type { RevenantConfig } from '#gw2/professions/revenant/types.js';
import type { ChargeGrant } from '#gw2/platform/combat/resources/charges.js';
import type { SkillId } from '#gw2/platform/skills/types.js';
import type { ProfessionBalanceContext } from '#gw2/platform/profession-definition/balance-context.js';
import {
  REVENANT_MAXIMUM_ENERGY,
  REVENANT_PRECOMBAT_ENERGY_CEILING,
  revenantBaseEnergyRegeneration,
  revenantStartingEnergy
} from '#gw2/professions/revenant/core/resource-values.js';
import { flattenProfessionState, projectPublicProfessionState } from '#gw2/platform/profession-definition/state.js';
import type { Gw2PlanningStateInput } from '#gw2/platform/results/types.js';

export interface RevenantUpkeepState {
  skillId: SkillId;
  upkeepCost: number;
  /** Every upkeep has an activation instant so teardown can retire its scheduled work. */
  startsAt: number;
  empoweredNextPulse: boolean;
}

interface RevenantSelfCondition {
  readonly condition: string;
  readonly stacks: number;
  readonly at: number;
  readonly expiresAt: number;
  readonly sourceId: SkillId;
  readonly skillName: string;
}

export interface RevenantCoreState {
  activationClaims: ActivationClaims;
  energy: ResourceClock;
  activeLegendId: string;
  selectedLegendIds: string[];
  activeUpkeeps: RevenantUpkeepState[];
  availableFlips: SkillFlipWindows;
  autoattackChains: Record<string, SkillId>;
  endurance: ResourceClock;
  enchantedDaggers: ChargeGrant;
  battleScars: number[];
  crushingAbyss: number[];
  combatBeganAt: number | null;
  nextThrillOfCombatAt: number | null;
  exposeDefensesUsed: boolean;
  selfConditions: RevenantSelfCondition[];
  selfConditionCount: number;

  /** Live wake generations let a rate change or combat anchor replace pending work without replaying state. */
  energyWakeGeneration: number;
  assassinsPresenceGeneration: number;
}

/** Revenant endurance capacity; live recovery and endurance-conditioned traits share this bound. */
export const REVENANT_MAXIMUM_ENDURANCE = 100;

// Initialize bounded energy and endurance plus complete legend, upkeep, flip,
// weapon-chain, and trait bookkeeping.
export function createRevenantCoreState(
  config: RevenantConfig,
  preparation: { balanceContext: ProfessionBalanceContext }
): RevenantCoreState {
  const selectedLegendIds = normalizeRevenantLegendIds(config.selectedLegends, config.specialization);
  const configuredStartingLegend = config.startingLegend || '';
  const activeLegendId = selectedLegendIds.includes(configuredStartingLegend)
    ? configuredStartingLegend
    : selectedLegendIds[0] || '';
  return {
    // Standalone construction (attribute previews) shares the runtime policy's values and selected regeneration;
    // no upkeep is active yet, so the base rate is the whole rate.
    energy: {
      ...createResourceClock(revenantStartingEnergy(config)),
      maximum: REVENANT_MAXIMUM_ENERGY,
      rate: revenantBaseEnergyRegeneration(preparation.balanceContext),
      recoveryMaximum: REVENANT_PRECOMBAT_ENERGY_CEILING
    },
    activationClaims: {},
    activeLegendId,
    selectedLegendIds,
    activeUpkeeps: [],
    availableFlips: {},
    autoattackChains: {},
    endurance: createResourceClock(100),
    enchantedDaggers: {
      charges: 0,
      expiresAt: 0,
      readyAt: 0
    },
    battleScars: [],
    crushingAbyss: [],
    combatBeganAt: null,
    nextThrillOfCombatAt: null,
    exposeDefensesUsed: false,
    selfConditions: [],
    selfConditionCount: Math.max(0, Math.trunc(config.selfConditionCount || 0)),

    energyWakeGeneration: 0,
    assassinsPresenceGeneration: 0
  };
}

// Core publishes only state shared by every Revenant build; elite state is projected by its owning module.
const REVENANT_CORE_PUBLIC_END_STATE_KEYS: readonly (keyof RevenantCoreState)[] = Object.freeze([
  'energy',
  'activeLegendId',
  'selectedLegendIds',
  'activeUpkeeps',
  'availableFlips',
  'autoattackChains',
  'endurance',

  'enchantedDaggers',
  'battleScars',
  'crushingAbyss',
  'combatBeganAt',
  'selfConditions',
  'selfConditionCount'
]);

// Core fields have no inactive fallbacks; their values come from the live state.
const REVENANT_CORE_PUBLIC_STATE_PROJECTION = Object.freeze({
  keys: REVENANT_CORE_PUBLIC_END_STATE_KEYS,
  defaults: {}
});

/** Derive the shared loadout identity from the current legend without storing a second live identity. */
export function projectRevenantPlanningState(input: Gw2PlanningStateInput) {
  const state = projectPublicProfessionState(
    flattenProfessionState(input.profession) as unknown as RevenantCoreState,
    REVENANT_CORE_PUBLIC_STATE_PROJECTION.keys,
    REVENANT_CORE_PUBLIC_STATE_PROJECTION.defaults
  );
  return { ...state, activeLoadoutId: state.activeLegendId };
}
