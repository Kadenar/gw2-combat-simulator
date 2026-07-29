import {
  THIEF_ARTIFACT_IDS,
  THIEF_TRAIT_IDS as TRAIT,
} from "../../data/ids.js";
import { hasThiefTrait } from "../../state.js";
import {
  emitThiefState,
  gainThiefInitiative,
} from "./shared.js";

function nextArtifact(state, kind) {
  const sequence = state.artifactOutcomeSequence[kind] || [];
  const index = Number(state.artifactOutcomeIndices[kind] || 0);
  const skillId = sequence[index % Math.max(1, sequence.length)] || (
    kind === "offensive"
      ? THIEF_ARTIFACT_IDS.OFFENSIVE[0]
      : THIEF_ARTIFACT_IDS.DEFENSIVE[0]
  );
  state.artifactOutcomeIndices[kind] = index + 1;
  return { kind, skillId };
}

function allArtifactChoices() {
  return [
    ...THIEF_ARTIFACT_IDS.OFFENSIVE.map(skillId => ({
      kind: "offensive",
      skillId,
    })),
    ...THIEF_ARTIFACT_IDS.DEFENSIVE.map(skillId => ({
      kind: "defensive",
      skillId,
    })),
  ];
}

function usesArtifactChoiceMode(context) {
  return context.config.deterministicChoices?.artifactDrawSequence === "choose";
}

export function pilferArtifacts(context, at, reason = "pilfer") {
  const state = context.state.profession;
  const prolific = hasThiefTrait(context.config, TRAIT.PROLIFIC_PLUNDERER);
  state.artifactSlots = usesArtifactChoiceMode(context)
    ? allArtifactChoices()
    : [
        nextArtifact(state, "offensive"),
        nextArtifact(state, "defensive"),
        ...(prolific ? [nextArtifact(state, "offensive")] : []),
      ];
  state.artifactUsesRemaining = prolific ? 2 : 1;
  state.initiativeSpentSincePilfer = 0;
  state.scoundrelsLuck = hasThiefTrait(
    context.config,
    TRAIT.SCOUNDRELS_LUCK,
  ) ? 1 : 0;
  emitThiefState(context, at, reason);
}

export function reshuffleArtifacts(context) {
  const state = context.state.profession;
  const at = context.effectiveEnd;
  state.artifactSlots = usesArtifactChoiceMode(context)
    ? allArtifactChoices()
    : state.artifactSlots.map(slot => nextArtifact(state, slot.kind));
  emitThiefState(context, at, "artifacts-reshuffled");
}

function nextDoubleEdgeOutcome(state) {
  if (state.scoundrelsLuck > 0) {
    state.scoundrelsLuck -= 1;
    return "success";
  }
  const sequence = state.doubleEdgeOutcomeSequence || ["success", "backfire"];
  const index = Number(state.doubleEdgeOutcomeIndex || 0);
  state.doubleEdgeOutcomeIndex = index + 1;
  return sequence[index % sequence.length] || "success";
}

export function consumeArtifact(context, skill) {
  const state = context.state.profession;
  const at = context.effectiveEnd;
  state.artifactUsesRemaining = Math.max(
    0,
    state.artifactUsesRemaining - 1,
  );
  state.artifactSlots = state.artifactSlots.filter(
    slot => slot.skillId !== skill.id,
  );
  if (hasThiefTrait(context.config, TRAIT.ENTERPRISING_ARISTOCRAT)) {
    gainThiefInitiative(context, 2, at, "enterprising-aristocrat");
  }
  if (
    hasThiefTrait(context.config, TRAIT.EXHILARATING_EPHEMERA)
    || hasThiefTrait(context.config, TRAIT.COMBAT_HIGH)
  ) {
    state.antiquaryDamageUntil = Math.max(
      state.antiquaryDamageUntil,
      at + 10,
    );
  }
  emitThiefState(context, at, "artifact-used");
}

export function resolveDoubleEdge(context, skill) {
  const state = context.state.profession;
  const at = context.effectiveEnd;
  const outcome = nextDoubleEdgeOutcome(state);
  if (outcome === "backfire") {
    state.backfireState[skill.id] = {
      activeUntil: at + Math.max(0, Number(skill.cooldown || 0)),
      skillName: skill.name,
    };
  } else {
    delete state.backfireState[skill.id];
  }
  if (skill.name === "Skritt Scuffle" && outcome === "success") {
    const summon = {
      skillId: skill.id,
      name: "Skritt Assistant",
      expiresAt: at + 30,
    };
    state.activeAntiquarySummons.push(summon);
    context.tasks.schedule({
      type: "thief.skritt-scuffle",
      at: at + 5,
      ownerId: `thief.skritt-scuffle:${skill.id}`,
      payload: { expiresAt: summon.expiresAt },
    });
  }
  emitThiefState(context, at, `double-edge-${outcome}`);
}

export function handleSkrittScuffle(context, task) {
  if (task.at > Number(task.payload.expiresAt || 0)) return;
  pilferArtifacts(context, task.at, "skritt-scuffle-artifact");
  context.tasks.schedule({
    ...task,
    at: task.at + 5,
  });
}
