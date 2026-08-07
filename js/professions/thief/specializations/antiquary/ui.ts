import { flattenProfessionState } from "../../../../platform/engine/profession.js";
import {
  THIEF_ANTIQUARY_ASSUMPTION_CONTROLS,
} from "./assumptions.js";
import { THIEF_ARTIFACT_IDS, THIEF_SKILL_IDS as ID } from "../../data/ids.js";
import type { ThiefSkill, ThiefState, ThiefUiContext } from "../../types.js";

function stateFrom(context: ThiefUiContext = {}): Partial<ThiefState> {
  return flattenProfessionState(
    context.state?.profession || context.professionState,
  ) as unknown as Partial<ThiefState>;
}

function choosesAllArtifacts(context: ThiefUiContext): boolean {
  return (
    context.build?.assumptions?.artifactDrawSequence
    ?? context.config?.deterministicChoices?.artifactDrawSequence
  ) === "choose";
}

export const antiquaryUi = Object.freeze({
  assumptionControls: THIEF_ANTIQUARY_ASSUMPTION_CONTROLS,
  paletteGroups: (context: ThiefUiContext) => {
    const state = stateFrom(context);
    const hasArtifactUse = Number(state.artifactUsesRemaining || 0) > 0;
    const availableArtifactIds = new Set(
      state.artifactSlots?.map(slot => Number(slot.skillId)) || [],
    );
    const artifactGroups: readonly [
      string,
      string,
      readonly number[],
      string,
    ][] = [
      ["thief-artifacts-offensive", "Offensive", THIEF_ARTIFACT_IDS.OFFENSIVE, "#c65d68"],
      ["thief-artifacts-defensive", "Defensive", THIEF_ARTIFACT_IDS.DEFENSIVE, "#6f9cb8"],
    ];
    return [{
      id: "thief-profession",
      label: "F",
      skillIds: [
        ID.SKRITT_SWIPE,
        ...(!choosesAllArtifacts(context) && state.artifactSlots?.length
          ? [ID.RESHUFFLE]
          : []),
      ],
      color: "#9a535c",
      resourceAnchor: true,
    }, ...artifactGroups.map(([id, label, artifactIds, color]) => {
      const skillIds = hasArtifactUse
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
    })];
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
  resourceViews: (context: ThiefUiContext) => [{
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
  paletteSkillAvailability: (context: ThiefUiContext, skill: ThiefSkill) => {
    const state = stateFrom(context);
    if (skill.artifactKind) {
      const available =
        Number(state.artifactUsesRemaining || 0) > 0
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
