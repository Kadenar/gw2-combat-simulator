import { normalizeRevenantLegendIds } from '#gw2/professions/revenant/data/legends.js';
import type { RevenantChargeState, RevenantConfig, RevenantTimedStack } from '#gw2/professions/revenant/types.js';
import type { SkillId } from '#gw2/platform/engine/skills/types.js';

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
  energy: number;
  maximumEnergy: number;
  energyUpdatedAt: number;
  // Preserve the elapsed-time baseline across scheduler reads until Energy, upkeep, or its cap changes.
  energyAccrual?: { at: number; energy: number; rate: number; maximum: number };
  activeLegendId: string;
  activeLoadoutId: string;
  selectedLegendIds: string[];
  legendSwapReadyAt: number;
  activeUpkeeps: RevenantUpkeepState[];
  availableFlips: Record<string, number | boolean>;
  autoattackChains: Record<string, SkillId>;
  endurance: number;
  maximumEndurance: number;
  enduranceUpdatedAt: number;
  enchantedDaggers: RevenantChargeState;
  battleScars: RevenantTimedStack[];
  crushingAbyss: number[];
  combatBeganAt: number | null;
  nextThrillOfCombatAt: number | null;
  exposeDefensesUsed: boolean;
  selfConditions: RevenantSelfCondition[];
  selfConditionCount: number;
  traitProcReadyAt: Record<string, number | boolean>;
}

// Initialize bounded energy and endurance plus complete legend, upkeep, flip,
// weapon-chain, and trait bookkeeping.
export function createRevenantCoreState(config: RevenantConfig = {}): RevenantCoreState {
  const selectedLegendIds = normalizeRevenantLegendIds(config.selectedLegends, config.specialization);
  const configuredStartingLegend = config.startingLegend || '';
  const activeLegendId = selectedLegendIds.includes(configuredStartingLegend)
    ? configuredStartingLegend
    : selectedLegendIds[0] || '';
  return {
    energy: Math.max(0, Math.min(100, Number(config.initialEnergy ?? 50))),
    maximumEnergy: 100,
    energyUpdatedAt: 0,
    activeLegendId,
    activeLoadoutId: activeLegendId,
    selectedLegendIds,
    legendSwapReadyAt: 0,
    activeUpkeeps: [],
    availableFlips: {},
    autoattackChains: {},
    endurance: 100,
    maximumEndurance: 100,
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
    traitProcReadyAt: {}
  };
}

// Core publishes only state shared by every Revenant build; elite state is projected by its owning module.
export const REVENANT_CORE_PUBLIC_END_STATE_KEYS: readonly (keyof RevenantCoreState)[] = Object.freeze([
  'energy',
  'maximumEnergy',
  'activeLegendId',
  'activeLoadoutId',
  'selectedLegendIds',
  'legendSwapReadyAt',
  'activeUpkeeps',
  'availableFlips',
  'autoattackChains',
  'endurance',
  'maximumEndurance',
  'enchantedDaggers',
  'battleScars',
  'crushingAbyss',
  'combatBeganAt',
  'selfConditions',
  'selfConditionCount'
]);
