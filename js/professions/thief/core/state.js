import {
  THIEF_SKILL_IDS as ID,
  THIEF_TRAIT_IDS as TRAIT,
} from "../data/ids.js";

export const THIEF_BASE_HEALTH = 1645;

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

export function thiefBaseMaximumHealth(config = {}) {
  const vitality = Number(
    config.stats?.vitality
    ?? config.attributes?.vitality
    ?? 1000,
  );
  return THIEF_BASE_HEALTH + Math.max(0, vitality) * 10;
}

export function createThiefCoreState(config = {}) {
  const traits = selectedThiefTraits(config);
  const maximumInitiative = hasThiefTrait(traits, TRAIT.PREPAREDNESS) ? 15 : 12;
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
    professionSkillId: ID.STEAL,
    kneeling: false,
    endurance: 100,
    maximumEndurance: 100,
    enduranceUpdatedAt: 0,
    maximumHealth: thiefBaseMaximumHealth(config),
    leadAttacksStacks: 0,
    leadAttacksUntil: 0,
    leadAttackExpirations: [],
    fluidStrikesUntil: 0,
    quickPocketsReadyAt: 0,
    spearChainStage: 0,
    spearPreviousSkillId: null,
    spearLastWasFinisher: false,
    distractingThrowBuffUntil: 0,
    spiderVenomCharges: 0,
    spiderVenomExpiresAt: 0,
    spiderVenomGeneration: 0,
    thousandNeedlesPrepared: false,
    thousandNeedlesArmedAt: 0,
    thousandNeedlesGeneration: 0,
    activeThievesGuild: null,
    thievesGuildVariant: "Core Thief",
    assassinsSignetActiveUntil: 0,
    assassinsSignetPassiveDisabledUntil: 0,
    availableFlips: {},
    autoattackChains: {},
    traitProcReadyAt: {},
  };
}

export function snapshotThiefState(state) {
  const runtime = state || {};
  if (
    runtime.core
    && runtime.specialization?.state
  ) {
    return structuredClone({
      ...runtime.core,
      ...runtime.specialization.state,
    });
  }
  return structuredClone(runtime);
}

export const THIEF_PUBLIC_END_STATE_KEYS = Object.freeze([
  "initiative", "maximumInitiative", "stealthUntil", "revealedUntil",
  "storedStolenSkillId", "markedTargetId", "malice", "maximumMalice",
  "maleficentSevenTriggered", "kneeling", "shadowForce",
  "maximumShadowForce", "maximumHealth", "shadowForcePoolCapacity",
  "shadowShroudActive", "endurance", "maximumEndurance", "selectedDodge",
  "leadAttacksStacks", "leadAttacksUntil", "fluidStrikesUntil",
  "boundingDamageUntil", "quickPocketsReadyAt", "spearChainStage",
  "spearPreviousSkillId", "spearLastWasFinisher",
  "distractingThrowBuffUntil", "spiderVenomCharges",
  "spiderVenomExpiresAt", "spiderVenomGeneration",
  "thousandNeedlesPrepared", "thousandNeedlesArmedAt",
  "thousandNeedlesGeneration", "artifactSlots", "artifactUsesRemaining",
  "scoundrelsLuck", "scoundrelsLuckReadyAt", "improvisationReadyAt",
  "backfireState", "activeAntiquarySummons",
  "nextSkrittScufflePilferAt", "activeThievesGuild",
  "antiquaryDamageUntil", "combatHighExpiresAt", "combatHighStacks",
  "artifactStealthAttacksRemaining", "artifactStealthAttackExpiresAt",
  "mistburnCharges", "mistburnExpiresAt", "mistburnGeneration",
  "kryptisDamageUntil", "chakInitiativeRefundUntil",
  "holoUtilityCooldownReduction", "holoUtilityCooldownReductionExpiresAt",
  "holoUtilityCooldownReductionExpirations", "forgedSurferGeneration",
  "forgedSurferMaximumBombHits", "canachCoinIndex",
  "assassinsSignetActiveUntil", "assassinsSignetPassiveDisabledUntil",
  "availableFlips", "autoattackChains",
]);

const INACTIVE_STATE_DEFAULTS = Object.freeze({
  markedTargetId: null,
  malice: 0,
  maximumMalice: 5,
  maleficentSevenTriggered: false,
  shadowForce: 0,
  maximumShadowForce: 100,
  shadowForcePoolCapacity: 0,
  shadowShroudActive: false,
  selectedDodge: "Dodge",
  boundingDamageUntil: 0,
  artifactSlots: [],
  artifactUsesRemaining: 0,
  scoundrelsLuck: 0,
  scoundrelsLuckReadyAt: 0,
  improvisationReadyAt: 0,
  backfireState: {},
  activeAntiquarySummons: [],
  nextSkrittScufflePilferAt: 0,
  antiquaryDamageUntil: 0,
  combatHighExpiresAt: 0,
  combatHighStacks: 0,
  artifactStealthAttacksRemaining: 0,
  artifactStealthAttackExpiresAt: 0,
  mistburnCharges: 0,
  mistburnExpiresAt: 0,
  mistburnGeneration: 0,
  kryptisDamageUntil: 0,
  chakInitiativeRefundUntil: 0,
  holoUtilityCooldownReduction: 0,
  holoUtilityCooldownReductionExpiresAt: 0,
  holoUtilityCooldownReductionExpirations: [],
  forgedSurferGeneration: 0,
  forgedSurferMaximumBombHits: 5,
  canachCoinIndex: 0,
});

export function projectThiefEndState({ schedulerState }) {
  const state = snapshotThiefState(schedulerState.profession);
  const compatibility = {
    ...state,
    artifactStealthAttacksRemaining:
      state.artifactStealthAttacksRemaining
      ?? state.stealthAttackCharges
      ?? 0,
    artifactStealthAttackExpiresAt:
      state.artifactStealthAttackExpiresAt
      ?? state.stealthAttackExpiresAt
      ?? 0,
  };
  return Object.fromEntries(
    THIEF_PUBLIC_END_STATE_KEYS.map((key) => {
      const value = Object.hasOwn(compatibility, key)
        ? compatibility[key]
        : INACTIVE_STATE_DEFAULTS[key];
      return [key, structuredClone(value)];
    }),
  );
}
