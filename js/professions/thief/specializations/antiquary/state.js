import {
  THIEF_ARTIFACT_IDS,
  THIEF_SKILL_IDS as ID,
} from "../../data/ids.js";

function artifactSequence(config) {
  const offensive = [...THIEF_ARTIFACT_IDS.OFFENSIVE];
  const defensive = [...THIEF_ARTIFACT_IDS.DEFENSIVE];
  if (config.deterministicChoices?.artifactDrawSequence === "reverse") {
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

export function createAntiquaryState(config = {}) {
  return {
    professionSkillId: ID.SKRITT_SWIPE,
    initiativePipRows: 3,
    artifactSlots: [],
    artifactUsesRemaining: 0,
    artifactOutcomeSequence: artifactSequence(config),
    artifactOutcomeIndices: { offensive: 0, defensive: 0 },
    doubleEdgeOutcomeSequence: doubleEdgeSequence(config),
    doubleEdgeOutcomeIndex: 0,
    scoundrelsLuck: 0,
    scoundrelsLuckReadyAt: 0,
    improvisationReadyAt: 0,
    backfireState: {},
    initiativeSpentSincePilfer: 0,
    activeAntiquarySummons: [],
    nextSkrittScufflePilferAt: 0,
    antiquaryDamageUntil: 0,
    combatHighExpiresAt: 0,
    combatHighStacks: 0,
    stealthAttackCharges: 0,
    stealthAttackExpiresAt: 0,
    mistburnCharges: 0,
    mistburnExpiresAt: 0,
    mistburnGeneration: 0,
    kryptisDamageUntil: 0,
    chakInitiativeRefundUntil: 0,
    holoUtilityCooldownReduction: 0,
    holoUtilityCooldownReductionExpiresAt: 0,
    holoUtilityCooldownReductionExpirations: [],
    forgedSurferGeneration: 0,
    forgedSurferMaximumBombHits: Math.max(
      1,
      Math.min(
        5,
        Number(config.deterministicChoices?.forgedSurferBombsHit || 5),
      ),
    ),
    canachCoinIndex: 0,
    thievesGuildVariant: "Skritt",
  };
}
