import { thiefCatalog } from "./catalog.js";
import {
  THIEF_ARTIFACT_IDS,
  THIEF_TRAIT_IDS as TRAIT,
} from "./data/ids.js";

export function selectedThiefTraits(config = {}) {
  return new Set([
    ...(config.traitIds || []),
    ...(config.selectedTraitIds || []),
    ...(config.selectedTraits || []),
  ].map(value => Number.isFinite(Number(value)) ? Number(value) : value));
}
export function hasThiefTrait(configOrTraits, traitId) {
  const traits = configOrTraits instanceof Set
    ? configOrTraits
    : selectedThiefTraits(configOrTraits);
  return traits.has(traitId) || traits.has(String(traitId));
}
function selectedDodge(config, traits) {
  if (hasThiefTrait(traits, TRAIT.LOTUS_TRAINING)) return "Lotus Training";
  if (hasThiefTrait(traits, TRAIT.BOUNDING_DODGER)) return "Bounding Dodger";
  if (hasThiefTrait(traits, TRAIT.UNHINDERED_COMBATANT)) {
    return "Unhindered Combatant";
  }
  return config.selectedDodge || "Dodge";
}
function artifactSequence(config) {
  const offensive = [...THIEF_ARTIFACT_IDS.OFFENSIVE];
  const defensive = [...THIEF_ARTIFACT_IDS.DEFENSIVE];
  if (
    config.deterministicChoices?.artifactDrawSequence
    === "reverse"
  ) {
    offensive.reverse();
    defensive.reverse();
  }
  return { offensive, defensive };
}
function doubleEdgeSequence(config) {
  const choice =
    config.deterministicChoices?.doubleEdgeOutcomeSequence
    || "alternate";
  if (choice === "success") return ["success"];
  if (choice === "backfire") return ["backfire"];
  return ["success", "backfire"];
}
export function createThiefState(config = {}) {
  const traits = selectedThiefTraits(config);
  const maximumInitiative = hasThiefTrait(traits, TRAIT.PREPAREDNESS) ? 15 : 12;
  const specialization = String(config.specialization || "Core");
  return {
    initiative: Math.min(
      maximumInitiative,
      Math.max(0, Number(config.initialInitiative ?? 12)),
    ),
    maximumInitiative,
    initiativeUpdatedAt: 0,
    stealthUntil: 0,
    revealedUntil: 0,
    storedStolenSkillId: null,
    markedTargetId:
      specialization === "Deadeye"
      && config.deterministicChoices?.markedTargetChoice !== "unmarked"
        ? null
        : null,
    malice: 0,
    maximumMalice: hasThiefTrait(traits, TRAIT.MALEFICENT_SEVEN) ? 7 : 5,
    maleficentSevenTriggered: false,
    kneeling: false,
    shadowForce: Math.max(0, Math.min(100, Number(config.initialShadowForce || 0))),
    maximumShadowForce: 100,
    shadowShroudActive: false,
    shadowForceUpdatedAt: 0,
    endurance: 100,
    maximumEndurance: specialization === "Daredevil" ? 150 : 100,
    enduranceUpdatedAt: 0,
    selectedDodge: selectedDodge(config, traits),
    leadAttacksStacks: 0,
    leadAttacksUntil: 0,
    boundingDamageUntil: 0,
    artifactSlots: [],
    artifactUsesRemaining: 0,
    artifactOutcomeSequence: artifactSequence(config),
    artifactOutcomeIndices: { offensive: 0, defensive: 0 },
    doubleEdgeOutcomeSequence: doubleEdgeSequence(config),
    doubleEdgeOutcomeIndex: 0,
    scoundrelsLuck: 0,
    backfireState: {},
    initiativeSpentSincePilfer: 0,
    activeAntiquarySummons: [],
    activeThievesGuild: null,
    antiquaryDamageUntil: 0,
    availableFlips: {},
    autoattackChains: {},
    traitProcReadyAt: {},
  };
}
export function snapshotThiefState(state) {
  return structuredClone(state);
}
export function projectThiefEndState({ schedulerState }) {
  const projected = snapshotThiefState(schedulerState.profession);
  delete projected.traitProcReadyAt;
  return projected;
}
export function thiefSkillId(name) {
  return thiefCatalog.skillsByName.get(name)?.id ?? null;
}
