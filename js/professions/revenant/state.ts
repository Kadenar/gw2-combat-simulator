import { REVENANT_TRAIT_IDS as TRAIT } from "./data/ids.js";
import { normalizeRevenantLegendIds } from "./legend-rules.js";
import type {
  RevenantConfig,
  RevenantState,
} from "./types.js";
import type {
  SchedulerState,
} from "../../platform/engine/types.js";

export function selectedRevenantTraits(
  config: RevenantConfig = {},
): Set<string | number> {
  return new Set(
    [
      ...(config.traitIds || []),
      ...(config.selectedTraitIds || []),
      ...(config.selectedTraits || []),
    ].map((value) => (Number.isFinite(Number(value)) ? Number(value) : value)),
  );
}
export function hasRevenantTrait(
  configOrTraits: RevenantConfig | Set<string | number> | undefined = {},
  traitId: string | number,
): boolean {
  const traits =
    configOrTraits instanceof Set
      ? configOrTraits
      : selectedRevenantTraits(configOrTraits);
  return traits.has(traitId) || traits.has(String(traitId));
}
export function revenantConduitFormIsActive(
  state: Partial<RevenantState> | null | undefined,
  form: string,
  at = 0,
): boolean {
  return (
    state?.conduitForm === form &&
    Number(state.cosmicWisdomUntil || 0) > Number(at || 0)
  );
}
export function createRevenantState(
  config: RevenantConfig = {},
): RevenantState {
  const selectedLegendIds = normalizeRevenantLegendIds(
    config.selectedLegends,
    config.specialization,
  );
  const configuredStartingLegend = config.startingLegend || "";
  const activeLegendId = selectedLegendIds.includes(configuredStartingLegend)
    ? configuredStartingLegend
    : selectedLegendIds[0] || "";
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
    allianceSide: config.allianceSide === "kurzick" ? "kurzick" : "luxon",
    endurance: config.specialization === "Vindicator" ? 100 : 100,
    maximumEndurance: 100,
    enduranceUpdatedAt: 0,
    selectedDodge: config.selectedDodge || "Death Drop",
    reaversCurseUntil: 0,
    forerunnerOfDeathUntil: 0,
    affinity: 0,
    cosmicWisdomUntil: 0,
    conduitForm: "",
    beguilingHazeCharges: 0,
    beguilingHazeReadyAt: 0,
    beguilingHazeMainReservations: [],
    bandTogetherReady: false,
    bandTogetherExpiresAt: 0,
    kallasFervor: [],
    renegadeCriticalProgress: 0,
    enchantedDaggers: {
      charges: 0,
      expiresAt: 0,
      readyAt: 0,
    },
    razorclawsRage: {
      charges: 0,
      expiresAt: 0,
      readyAt: 0,
    },
    battleScars: [],
    crushingAbyss: [],
    combatBeganAt: null,
    nextThrillOfCombatAt: null,
    exposeDefensesUsed: false,
    selfConditionDurationMultiplier: hasRevenantTrait(
      config,
      TRAIT.PACT_OF_PAIN,
    )
      ? 1.1
      : 1,
    selfConditions: [],
    selfConditionCount: Math.max(
      0,
      Math.trunc(Number(config.selfConditionCount || 0)),
    ),
    activeLegendSummons: {},
    traitProcReadyAt: {},
  };
}
export function snapshotRevenantState(
  state: RevenantState,
): RevenantState {
  return structuredClone(state);
}
export const REVENANT_PUBLIC_END_STATE_KEYS: readonly (
  keyof RevenantState
)[] = Object.freeze([
  "energy",
  "maximumEnergy",
  "activeLegendId",
  "activeLoadoutId",
  "selectedLegendIds",
  "legendSwapReadyAt",
  "activeUpkeeps",
  "availableFlips",
  "autoattackChains",
  "abyssalStrikeSecondCast",
  "allianceSide",
  "endurance",
  "maximumEndurance",
  "selectedDodge",
  "reaversCurseUntil",
  "forerunnerOfDeathUntil",
  "affinity",
  "cosmicWisdomUntil",
  "conduitForm",
  "beguilingHazeCharges",
  "beguilingHazeReadyAt",
  "bandTogetherReady",
  "bandTogetherExpiresAt",
  "kallasFervor",
  "enchantedDaggers",
  "razorclawsRage",
  "battleScars",
  "crushingAbyss",
  "combatBeganAt",
  "selfConditionDurationMultiplier",
  "selfConditions",
  "selfConditionCount",
  "activeLegendSummons",
]);
export function projectRevenantEndState(
  { schedulerState }: { schedulerState: SchedulerState<RevenantState> },
): Partial<RevenantState> {
  const state = schedulerState.profession;
  return Object.fromEntries(
    REVENANT_PUBLIC_END_STATE_KEYS.map((key) => [
      key,
      structuredClone(state[key]),
    ]),
  );
}
