import { thiefCatalog } from "./catalog.js";
import {
  professionStaticRulesApplied,
} from "../../platform/gw2/attribute-provenance.js";
import {
  THIEF_ARTIFACT_IDS,
  THIEF_TRAIT_IDS as TRAIT,
} from "./data/ids.js";

const THIEF_BASE_HEALTH = 1645;
const SHADOW_FORCE_HEALTH_MULTIPLIER = 0.69;

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
function thiefMaximumHealth(config, traits) {
  let vitality = Number(
    config.stats?.vitality
    ?? config.attributes?.vitality
    ?? 1000,
  );
  if (
    !professionStaticRulesApplied(config)
    && hasThiefTrait(traits, TRAIT.MARAUDERS_RESILIENCE)
  ) {
    vitality += Number(
      config.stats?.power
      ?? config.attributes?.power
      ?? 1000,
    ) * 0.07;
  }
  return THIEF_BASE_HEALTH + Math.max(0, vitality) * 10;
}
export function createThiefState(config = {}) {
  const traits = selectedThiefTraits(config);
  const maximumInitiative = hasThiefTrait(traits, TRAIT.PREPAREDNESS) ? 15 : 12;
  const specialization = String(config.specialization || "Core");
  const maximumHealth = thiefMaximumHealth(config, traits);
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
    markedTargetId: null,
    malice: 0,
    maximumMalice: hasThiefTrait(traits, TRAIT.MALEFICENT_SEVEN) ? 7 : 5,
    maleficentSevenTriggered: false,
    kneeling: false,
    shadowForce: Math.max(0, Math.min(100, Number(config.initialShadowForce || 0))),
    maximumShadowForce: 100,
    maximumHealth,
    shadowForcePoolCapacity:
      maximumHealth * SHADOW_FORCE_HEALTH_MULTIPLIER,
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
export const THIEF_PUBLIC_END_STATE_KEYS = Object.freeze([
  "initiative",
  "maximumInitiative",
  "stealthUntil",
  "revealedUntil",
  "storedStolenSkillId",
  "markedTargetId",
  "malice",
  "maximumMalice",
  "maleficentSevenTriggered",
  "kneeling",
  "shadowForce",
  "maximumShadowForce",
  "maximumHealth",
  "shadowForcePoolCapacity",
  "shadowShroudActive",
  "endurance",
  "maximumEndurance",
  "selectedDodge",
  "leadAttacksStacks",
  "leadAttacksUntil",
  "boundingDamageUntil",
  "artifactSlots",
  "artifactUsesRemaining",
  "scoundrelsLuck",
  "backfireState",
  "activeAntiquarySummons",
  "activeThievesGuild",
  "antiquaryDamageUntil",
  "availableFlips",
  "autoattackChains",
]);
export function projectThiefEndState({ schedulerState }) {
  const state = schedulerState.profession;
  return Object.fromEntries(
    THIEF_PUBLIC_END_STATE_KEYS.map((key) => [
      key,
      structuredClone(state[key]),
    ]),
  );
}
export function thiefSkillId(name) {
  return thiefCatalog.skillsByName.get(name)?.id ?? null;
}
