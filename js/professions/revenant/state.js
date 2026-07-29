import { REVENANT_TRAIT_IDS as TRAIT } from "./data/ids.js";
import { normalizeRevenantLegendIds } from "./legend-rules.js";

export function selectedRevenantTraits(config = {}) {
  return new Set(
    [
      ...(config.traitIds || []),
      ...(config.selectedTraitIds || []),
      ...(config.selectedTraits || []),
    ].map((value) => (Number.isFinite(Number(value)) ? Number(value) : value)),
  );
}
export function hasRevenantTrait(configOrTraits, traitId) {
  const traits =
    configOrTraits instanceof Set
      ? configOrTraits
      : selectedRevenantTraits(configOrTraits);
  return traits.has(traitId) || traits.has(String(traitId));
}
export function revenantConduitFormIsActive(state, form, at = 0) {
  return (
    state?.conduitForm === form &&
    Number(state.cosmicWisdomUntil || 0) > Number(at || 0)
  );
}
export function createRevenantState(config = {}) {
  const selectedLegendIds = normalizeRevenantLegendIds(
    config.selectedLegends,
    config.specialization,
  );
  const activeLegendId = selectedLegendIds.includes(config.startingLegend)
    ? config.startingLegend
    : selectedLegendIds[0];
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
export function snapshotRevenantState(state) {
  return structuredClone(state);
}
export function projectRevenantEndState({ schedulerState }) {
  const projected = snapshotRevenantState(schedulerState.profession);
  delete projected.traitProcReadyAt;
  return projected;
}
