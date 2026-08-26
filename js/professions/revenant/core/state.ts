import { REVENANT_TRAIT_IDS as TRAIT } from '../data/ids.js';
import { normalizeRevenantLegendIds } from '../legend-rules.js';
import type { RevenantConfig, RevenantCoreState } from '../types.js';

export function hasRevenantTrait(config: RevenantConfig = {}, traitId: string | number): boolean {
  // Normalize canonical config IDs at the shared lookup boundary.
  const traits = new Set(
    (config.selectedTraitIds || []).map((value) => (Number.isFinite(Number(value)) ? Number(value) : value))
  );
  return traits.has(traitId) || traits.has(String(traitId));
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
    abyssalStrikeSecondCast: false,
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
    selfConditionDurationMultiplier: hasRevenantTrait(config, TRAIT.PACT_OF_PAIN) ? 1.1 : 1,
    selfConditions: [],
    selfConditionCount: Math.max(0, Math.trunc(Number(config.selfConditionCount || 0))),
    activeLegendSummons: {},
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
  'abyssalStrikeSecondCast',
  'endurance',
  'maximumEndurance',
  'enchantedDaggers',
  'battleScars',
  'crushingAbyss',
  'combatBeganAt',
  'selfConditionDurationMultiplier',
  'selfConditions',
  'selfConditionCount',
  'activeLegendSummons'
]);
