import { REVENANT_TRAIT_IDS as TRAIT } from "./data/ids.js";

export function selectedRevenantTraits(config = {}) {
  return new Set([
    ...(config.traitIds || []),
    ...(config.selectedTraitIds || []),
    ...(config.selectedTraits || []),
  ].map(value => Number.isFinite(Number(value)) ? Number(value) : value));
}
export function hasRevenantTrait(configOrTraits, traitId) {
  const traits = configOrTraits instanceof Set
    ? configOrTraits
    : selectedRevenantTraits(configOrTraits);
  return traits.has(traitId) || traits.has(String(traitId));
}
export function createRevenantState(config = {}) {
  const selectedLegendIds = [...(config.selectedLegends || [])];
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
    allianceSide: config.allianceSide === "kurzick" ? "kurzick" : "luxon",
    endurance: config.specialization === "Vindicator" ? 100 : 100,
    maximumEndurance: 100,
    enduranceUpdatedAt: 0,
    selectedDodge: config.selectedDodge || "Death Drop",
    affinity: 0,
    cosmicWisdomUntil: 0,
    conduitForm: "",
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
