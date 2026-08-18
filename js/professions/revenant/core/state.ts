import { flattenProfessionState } from '../../../platform/engine/profession.js';
import { REVENANT_TRAIT_IDS as TRAIT } from '../data/ids.js';
import { normalizeRevenantLegendIds } from '../legend-rules.js';
import type { ConduitState, RevenantConfig, RevenantCoreState, RevenantRuntimeState, RevenantState } from '../types.js';
import type { SchedulerState } from '../../../platform/engine/types.js';

export function selectedRevenantTraits(config: RevenantConfig = {}): Set<string | number> {
  return new Set(
    [...(config.traitIds || []), ...(config.selectedTraitIds || []), ...(config.selectedTraits || [])].map((value) =>
      Number.isFinite(Number(value)) ? Number(value) : value
    )
  );
}

export function hasRevenantTrait(
  configOrTraits: RevenantConfig | ReadonlySet<string | number> = {},
  traitId: string | number
): boolean {
  const traits =
    configOrTraits instanceof Set ? configOrTraits : selectedRevenantTraits(configOrTraits as RevenantConfig);
  return traits.has(traitId) || traits.has(String(traitId));
}

export function revenantConduitFormIsActive(
  state: Partial<ConduitState> | null | undefined,
  form: string,
  at = 0
): boolean {
  return state?.conduitForm === form && Number(state.cosmicWisdomUntil || 0) > Number(at || 0);
}

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

export function snapshotRevenantState(state: unknown): RevenantState {
  return structuredClone(flattenProfessionState(state)) as unknown as RevenantState;
}

export const REVENANT_PUBLIC_END_STATE_KEYS: readonly (keyof RevenantState)[] = Object.freeze([
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
  'allianceSide',
  'endurance',
  'maximumEndurance',
  'selectedDodge',
  'reaversCurseUntil',
  'forerunnerOfDeathUntil',
  'affinity',
  'cosmicWisdomUntil',
  'conduitForm',
  'beguilingHazeCharges',
  'beguilingHazeReadyAt',
  'bandTogetherReady',
  'bandTogetherExpiresAt',
  'kallasFervor',
  'enchantedDaggers',
  'razorclawsRage',
  'battleScars',
  'crushingAbyss',
  'combatBeganAt',
  'selfConditionDurationMultiplier',
  'selfConditions',
  'selfConditionCount',
  'activeLegendSummons'
]);

const REVENANT_PUBLIC_INACTIVE_STATE_DEFAULTS: Readonly<Partial<RevenantState>> = Object.freeze({
  allianceSide: 'luxon',
  selectedDodge: 'Death Drop',
  reaversCurseUntil: 0,
  forerunnerOfDeathUntil: 0,
  affinity: 0,
  cosmicWisdomUntil: 0,
  conduitForm: '',
  beguilingHazeCharges: 0,
  beguilingHazeReadyAt: 0,
  bandTogetherReady: false,
  bandTogetherExpiresAt: 0,
  kallasFervor: [],
  razorclawsRage: {
    charges: 0,
    expiresAt: 0,
    readyAt: 0
  }
});

export function projectRevenantEndState({
  schedulerState
}: {
  schedulerState: SchedulerState<RevenantRuntimeState>;
}): Partial<RevenantState> {
  const state = snapshotRevenantState(schedulerState.profession);
  return Object.fromEntries(
    REVENANT_PUBLIC_END_STATE_KEYS.map((key) => [
      key,
      structuredClone(Object.hasOwn(state, key) ? state[key] : REVENANT_PUBLIC_INACTIVE_STATE_DEFAULTS[key])
    ])
  );
}
