import { flattenProfessionState } from "../../../../platform/engine/profession.js";
import { THIEF_ANTIQUARY_ASSUMPTION_CONTROLS } from "./assumptions.js";
import { THIEF_ARTIFACT_IDS, THIEF_SKILL_IDS as ID } from "../../data/ids.js";
import type { ThiefSkill, ThiefState, ThiefUiContext } from "../../types.js";

function stateFrom(context: ThiefUiContext = {}): Partial<ThiefState> {
  return flattenProfessionState(
    context.state?.profession || context.professionState,
  ) as unknown as Partial<ThiefState>;
}

export const antiquaryUi = Object.freeze({
  assumptionControls: THIEF_ANTIQUARY_ASSUMPTION_CONTROLS,
  paletteGroups: (context: ThiefUiContext) => {
    const state = stateFrom(context);
    const hasArtifactUse = Number(state.artifactUsesRemaining || 0) > 0;
    const availableArtifactIds = new Set(
      state.artifactSlots?.map((slot) => Number(slot.skillId)) || [],
    );
    const artifactGroups: readonly [
      string,
      string,
      readonly number[],
      string,
    ][] = [
      [
        "thief-artifacts-offensive",
        "Offensive",
        THIEF_ARTIFACT_IDS.OFFENSIVE,
        "#c65d68",
      ],
      [
        "thief-artifacts-defensive",
        "Defensive",
        THIEF_ARTIFACT_IDS.DEFENSIVE,
        "#6f9cb8",
      ],
    ];
    return [
      {
        id: "thief-profession",
        label: "F",
        skillIds: [ID.SKRITT_SWIPE],
        color: "#9a535c",
        resourceAnchor: true,
      },
      ...artifactGroups.map(([id, label, artifactIds, color]) => {
        // show only the currently available artifact ids; when no uses remain, collapse the group (concealed) while reserving its slots
        const skillIds = hasArtifactUse
          ? artifactIds.filter((skillId) => availableArtifactIds.has(skillId))
          : [];
        return {
          id,
          label,
          skillIds,
          reservedSkillIds: [...artifactIds], // keeps the palette column width stable even when skillIds is empty
          color,
          stackId: "thief-artifacts", // offensive + defensive groups share a visual stack so they collapse as one unit
          className: [
            "antiquary-artifact-group",
            skillIds.length ? "" : "pal-group-concealed",
          ]
            .filter(Boolean)
            .join(" "),
        };
      }),
    ];
  },
  skillBarGroups: () => [
    {
      id: "thief-artifacts-offensive",
      label: "Offensive Artifacts",
      skillIds: [...THIEF_ARTIFACT_IDS.OFFENSIVE],
      color: "#c65d68",
    },
    {
      id: "thief-artifacts-defensive",
      label: "Defensive Artifacts",
      skillIds: [...THIEF_ARTIFACT_IDS.DEFENSIVE],
      color: "#6f9cb8",
    },
  ],
  resourceViews: (context: ThiefUiContext) => [
    {
      id: "artifact-uses",
      singular: "artifact use",
      plural: "artifact uses",
      maximum: 2, // Prolific Plunderer + Improvisation can give 3 uses, but the display caps at 2 pips (the normal maximum)
      value: Number(stateFrom(context).artifactUsesRemaining || 0),
      canStart: false,
      step: 1,
      displayMode: "pips",
      shortLabel: "Art",
      statusLabel: "Available",
    },
  ],
  paletteSkillAvailability: (context: ThiefUiContext, skill: ThiefSkill) => {
    const state = stateFrom(context);
    if (skill.artifactKind) {
      const available =
        Number(state.artifactUsesRemaining || 0) > 0 &&
        state.artifactSlots?.some((slot) => slot.skillId === skill.id);
      return {
        available,
        message: available ? "" : "Pilfer this artifact before using it",
      };
    }
    if (skill.id === ID.RESHUFFLE) {
      // Reshuffle is always greyed-out in the palette; it is queue-only and blocked by availability when there is nothing to reroll
      return {
        available: false,
        message: "All artifacts are already available to choose",
      };
    }
    return { available: true, message: "" };
  },
});
