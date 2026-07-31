import {
  THIEF_ANTIQUARY_ASSUMPTION_CONTROLS,
} from "./assumptions.js";
import { THIEF_ARTIFACT_IDS, THIEF_SKILL_IDS as ID } from "../../data/ids.js";

function stateFrom(context = {}) {
  return context.state?.profession || context.professionState || {};
}

function choosesAllArtifacts(context) {
  return (
    context.build?.assumptions?.artifactDrawSequence
    ?? context.config?.deterministicChoices?.artifactDrawSequence
  ) === "choose";
}

export const antiquaryUi = Object.freeze({
  assumptionControls: THIEF_ANTIQUARY_ASSUMPTION_CONTROLS,
  paletteGroups: context => {
    const state = stateFrom(context);
    const hasArtifactUse = Number(state.artifactUsesRemaining || 0) > 0;
    const availableArtifactIds = new Set(
      state.artifactSlots?.map(slot => Number(slot.skillId)) || [],
    );
    return [
      ["thief-artifacts-offensive", "Offensive", THIEF_ARTIFACT_IDS.OFFENSIVE, "#c65d68"],
      ["thief-artifacts-defensive", "Defensive", THIEF_ARTIFACT_IDS.DEFENSIVE, "#6f9cb8"],
    ].map(([id, label, artifactIds, color]) => {
      const skillIds = choosesAllArtifacts(context)
        ? [...artifactIds]
        : hasArtifactUse
          ? artifactIds.filter(skillId => availableArtifactIds.has(skillId))
          : [];
      return {
        id,
        label,
        skillIds,
        reservedSkillIds: [...artifactIds],
        color,
        stackId: "thief-artifacts",
        className: [
          "antiquary-artifact-group",
          skillIds.length ? "" : "pal-group-concealed",
        ].filter(Boolean).join(" "),
      };
    });
  },
  skillBarGroups: () => [{
    id: "thief-artifacts-offensive",
    label: "Offensive Artifacts",
    skillIds: [...THIEF_ARTIFACT_IDS.OFFENSIVE],
    color: "#c65d68",
  }, {
    id: "thief-artifacts-defensive",
    label: "Defensive Artifacts",
    skillIds: [...THIEF_ARTIFACT_IDS.DEFENSIVE],
    color: "#6f9cb8",
  }],
  resourceViews: context => [{
    id: "artifact-uses",
    singular: "artifact use",
    plural: "artifact uses",
    maximum: 2,
    value: Number(stateFrom(context).artifactUsesRemaining || 0),
    canStart: false,
    step: 1,
    displayMode: "pips",
    shortLabel: "Art",
    statusLabel: "Available",
  }],
  paletteSkillAvailability: (context, skill) => {
    const state = stateFrom(context);
    if (skill.artifactKind) {
      const available =
        state.artifactUsesRemaining > 0
        && state.artifactSlots?.some(slot => slot.skillId === skill.id);
      return {
        available,
        message: available ? "" : "Pilfer this artifact before using it",
      };
    }
    if (skill.id === ID.RESHUFFLE) {
      const available =
        !choosesAllArtifacts(context)
        && Boolean(state.artifactSlots?.length);
      return {
        available,
        message: available ? "" : "Pilfer artifacts before reshuffling",
      };
    }
    return { available: true, message: "" };
  },
});
