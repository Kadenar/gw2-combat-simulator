import { createResourceClock } from '#gw2/platform/combat/resources/resource-policy.js';
import { type SkillFlipWindows } from '#gw2/platform/engine/skills/skill-flips.js';
import type { ResourceClock } from '#gw2/platform/combat/resources/clock.js';
import { normalizeRevenantLegendIds } from '#gw2/professions/revenant/data/legends.js';
import type { RevenantConfig } from '#gw2/professions/revenant/types.js';
import type { ChargeGrant } from '#gw2/platform/combat/resources/charges.js';
import type { SkillId } from '#gw2/platform/engine/skills/types.js';
import { boundedNumber } from '#kernel/core/numeric.js';

export interface RevenantUpkeepState {
  skillId: SkillId;
  upkeepCost: number;
  startsAt?: number;
  empoweredNextPulse: boolean;
}

export interface RevenantSelfCondition {
  readonly condition: string;
  readonly stacks: number;
  readonly at: number;
  readonly expiresAt: number;
  readonly sourceId: SkillId;
  readonly skillName: string;
}

export interface RevenantCoreState {
  energy: ResourceClock;
  activeLegendId: string;
  activeLoadoutId: string;
  selectedLegendIds: string[];
  activeUpkeeps: RevenantUpkeepState[];
  availableFlips: SkillFlipWindows;
  autoattackChains: Record<string, SkillId>;
  endurance: number;

  enduranceUpdatedAt: number;
  enchantedDaggers: ChargeGrant;
  battleScars: number[];
  crushingAbyss: number[];
  combatBeganAt: number | null;
  nextThrillOfCombatAt: number | null;
  exposeDefensesUsed: boolean;
  selfConditions: RevenantSelfCondition[];
  selfConditionCount: number;
  // Brutality, Vicious Reprisal and Impossible Odds store only numeric deadlines here.
  traitProcReadyAt: Record<string, number>;
  /** Live wake generations let a rate change or combat anchor replace pending work without replaying state. */
  energyWakeGeneration: number;
  assassinsPresenceGeneration: number;
}

/** Revenant endurance capacity; live recovery and endurance-conditioned traits share this bound. */
export const REVENANT_MAXIMUM_ENDURANCE = 100;

// Initialize bounded energy and endurance plus complete legend, upkeep, flip,
// weapon-chain, and trait bookkeeping.
export function createRevenantCoreState(config: RevenantConfig = {}): RevenantCoreState {
  const selectedLegendIds = normalizeRevenantLegendIds(config.selectedLegends, config.specialization);
  const configuredStartingLegend = config.startingLegend || '';
  const activeLegendId = selectedLegendIds.includes(configuredStartingLegend)
    ? configuredStartingLegend
    : selectedLegendIds[0] || '';
  return {
    energy: {
      ...createResourceClock(boundedNumber(config.initialEnergy ?? 50, 50, 0, 100)),
      maximum: 100,
      rate: 5,
      recoveryMaximum: 50
    },
    activeLegendId,
    activeLoadoutId: activeLegendId,
    selectedLegendIds,
    activeUpkeeps: [],
    availableFlips: {},
    autoattackChains: {},
    endurance: 100,

    enduranceUpdatedAt: 0,
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
    selfConditionCount: Math.max(0, Math.trunc(Number(config.selfConditionCount || 0))),
    traitProcReadyAt: {},
    energyWakeGeneration: 0,
    assassinsPresenceGeneration: 0
  };
}

// Core publishes only state shared by every Revenant build; elite state is projected by its owning module.
const REVENANT_CORE_PUBLIC_END_STATE_KEYS: readonly (keyof RevenantCoreState)[] = Object.freeze([
  'energy',
  'activeLegendId',
  'activeLoadoutId',
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
export const REVENANT_CORE_PUBLIC_STATE_PROJECTION = Object.freeze({
  keys: REVENANT_CORE_PUBLIC_END_STATE_KEYS,
  defaults: {}
});
