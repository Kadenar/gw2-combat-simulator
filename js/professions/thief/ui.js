import { THIEF_ASSUMPTION_CONTROLS } from "./assumptions.js";
import {
  thiefCatalog,
  thiefWeaponSkillMatchesSet,
} from "./catalog.js";
import {
  THIEF_ARTIFACT_IDS,
  THIEF_SKILL_IDS as ID,
} from "./data/ids.js";

/**
 * Thief adapter for the shared simulator UI.
 *
 * This module presents initiative, malice, shadow force, artifacts, stolen
 * skills, and Shadow Shroud; supplies Thief-specific assumptions and weapon
 * matching; explains contextual skill availability; and formats Thief state
 * events. It describes mechanic state for the UI rather than resolving it.
 */

function stateFrom(context = {}) {
  return context.state?.profession || context.professionState || {};
}
function specializationFrom(context = {}) {
  return context.specialization || context.config?.specialization || "Core";
}
function choosesAllArtifacts(context) {
  return (
    context.build?.assumptions?.artifactDrawSequence
    ?? context.config?.deterministicChoices?.artifactDrawSequence
  ) === "choose";
}
function shadowShroudSkillIds() {
  return thiefCatalog.skills
    .filter(skill =>
      skill.shadowShroudSkill
      && skill.implemented
      && !skill.simulatorExcluded)
    .sort((left, right) =>
      Number(String(left.slot).split("_").at(-1) || 0)
      - Number(String(right.slot).split("_").at(-1) || 0)
      || left.id - right.id)
    .map(skill => skill.id);
}
function assumptionSkillIds(controlKey) {
  return THIEF_ASSUMPTION_CONTROLS
    .find(control => control.key === controlKey)
    ?.options.map(option => Number(option.skillId))
    .filter(Number.isFinite) || [];
}
function skillBarGroups(context) {
  const specialization = specializationFrom(context);
  if (["Core", "Daredevil"].includes(specialization)) {
    return [{
      id: "thief-stolen-skills",
      label: "Stolen Skills",
      skillIds: assumptionSkillIds("stolenSkillChoice"),
      color: "#9a535c",
    }];
  }
  if (specialization === "Deadeye") {
    return [{
      id: "deadeye-stolen-skills",
      label: "Deadeye Stolen Skills",
      skillIds: assumptionSkillIds("deadeyeStolenSkillChoice"),
      color: "#9a535c",
    }];
  }
  if (specialization === "Antiquary") {
    return [
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
    ];
  }
  return [];
}
function professionIds(context) {
  const state = stateFrom(context);
  const specialization = specializationFrom(context);
  const mechanic = {
    Core: ID.STEAL,
    Daredevil: ID.STEAL,
    Deadeye: ID.DEADEYES_MARK,
    Specter: ID.SIPHON,
    Antiquary: ID.SKRITT_SWIPE,
  }[specialization] || ID.STEAL;
  const result = [mechanic];
  if (state.storedStolenSkillId) result.push(state.storedStolenSkillId);
  if (specialization === "Specter") {
    result.push(ID.ENTER_SHADOW_SHROUD);
    if (state.shadowShroudActive) result.push(ID.EXIT_SHADOW_SHROUD);
  }
  if (
    specialization === "Antiquary"
    && !choosesAllArtifacts(context)
  ) result.push(ID.RESHUFFLE);
  return [...new Set(result.filter(Number.isFinite))];
}
function contextualGroups(context) {
  const state = stateFrom(context);
  const specialization = specializationFrom(context);
  const groups = [];
  if (specialization === "Specter") {
    groups.push({
      id: "thief-shadow-shroud",
      label: "Shroud",
      skillIds: shadowShroudSkillIds(),
      color: "#6b9988",
    });
  }
  if (specialization === "Antiquary") {
    const hasArtifactUse = Number(state.artifactUsesRemaining || 0) > 0;
    const availableArtifactIds = new Set(
      state.artifactSlots?.map(slot => Number(slot.skillId)) || [],
    );
    for (const [id, label, artifactIds, color] of [
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
    ]) {
      const skillIds = hasArtifactUse
        ? artifactIds.filter(skillId => availableArtifactIds.has(skillId))
        : [];
      groups.push({
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
      });
    }
  }
  return groups;
}
function availability(skill, context = {}) {
  const state = stateFrom(context);
  const stealthed =
    Number(state.stealthUntil || 0) > Number(context.time || 0)
    && Number(state.revealedUntil || 0) <= Number(context.time || 0);
  if (
    skill.dualWieldFollowup
    && !state.availableFlips?.[skill.id]
  ) {
    return {
      available: false,
      message: "Use its opening dual-wield skill first",
    };
  }
  if (skill.artifactKind) {
    const available = state.artifactUsesRemaining > 0
      && state.artifactSlots?.some(slot => slot.skillId === skill.id);
    return {
      available,
      message: available ? "" : "Pilfer this artifact before using it",
    };
  }
  if (skill.id === ID.RESHUFFLE) {
    const available = !choosesAllArtifacts(context)
      && Boolean(state.artifactSlots?.length);
    return {
      available,
      message: available ? "" : "Pilfer artifacts before reshuffling",
    };
  }
  if (skill.id === ID.ENTER_SHADOW_SHROUD) {
    const available =
      !state.shadowShroudActive
      && Number(state.shadowForce || 0) > 0;
    return {
      available,
      message: available
        ? ""
        : state.shadowShroudActive
          ? "Shadow Shroud is already active"
          : "Use Siphon or spend initiative to gain shadow force",
    };
  }
  if (skill.id === ID.EXIT_SHADOW_SHROUD) {
    return {
      available: Boolean(state.shadowShroudActive),
      message: state.shadowShroudActive
        ? ""
        : "Enter Shadow Shroud first",
    };
  }
  if (skill.shadowShroudSkill && !state.shadowShroudActive) {
    return {
      available: false,
      message: "Enter Shadow Shroud first",
    };
  }
  if (
    state.shadowShroudActive
    && !skill.shadowShroudSkill
    && (
      skill.type === "Weapon"
      || ["Heal", "Utility", "Elite"].includes(skill.type)
    )
  ) {
    return {
      available: false,
      message: "Shadow Shroud replaces weapon and slot skills",
    };
  }
  if (skill.stealthAttack) {
    return {
      available: stealthed,
      message: stealthed ? "" : "Gain stealth first",
    };
  }
  if (
    stealthed
    && skill.type === "Weapon"
    && skill.slot === "Weapon_1"
  ) {
    return {
      available: false,
      message: "The active weapon's stealth attack replaces skill 1",
    };
  }
  return { available: true, message: "" };
}

export function thiefEventLogRow(event) {
  if (event.type !== "thief.state") return undefined;
  const state = event.state || {};
  const extras = [];
  if (state.malice) extras.push(`Malice ${state.malice}`);
  if (state.shadowShroudActive || state.shadowForce) {
    extras.push(`Shadow force ${Number(state.shadowForce || 0).toFixed(1)}`);
  }
  if (state.artifactSlots?.length) {
    extras.push(`Artifacts ${state.artifactUsesRemaining}`);
  }
  return {
    at: event.at,
    type: "Thief",
    name: event.reason || "State",
    detail: [
      `Initiative ${Number(state.initiative || 0).toFixed(1)}`,
      ...extras,
    ].join(" · "),
  };
}

export const thiefUi = Object.freeze({
  assumptionControls: THIEF_ASSUMPTION_CONTROLS,
  weaponSkillMatchesSet: thiefWeaponSkillMatchesSet,
  paletteGroups: context => [{
    id: "thief-profession",
    label: "F",
    skillIds: professionIds(context),
    color: "#9a535c",
    resourceAnchor: true,
  }, ...contextualGroups(context)],
  skillBarGroups,
  resourceViews: context => {
    const state = stateFrom(context);
    const specialization = specializationFrom(context);
    const views = [{
      id: "initiative",
      singular: "initiative",
      plural: "initiative",
      maximum: Number(state.maximumInitiative || 12),
      value: Number(state.initiative ?? context.initialInitiative ?? 12),
      startMaximum: 15,
      startValue: Number(context.initialInitiative ?? 12),
      canStart: true,
      buildKey: "initialInitiative",
      step: 1,
      displayMode: "pips",
      pipStyle: "thief-initiative",
      pipRows: specialization === "Antiquary" ? 3 : 2,
      shortLabel: "Init",
      statusLabel: "Current",
    }, {
      id: "endurance",
      singular: "endurance",
      plural: "endurance",
      maximum: Number(
        state.maximumEndurance || (specialization === "Daredevil" ? 150 : 100),
      ),
      value: Number(state.endurance ?? 100),
      canStart: false,
      step: 1,
      displayMode: "bar",
      pipStyle: "endurance",
      shortLabel: "End",
      statusLabel: "Current",
    }];
    if (specialization === "Deadeye") {
      views.push({
        id: "malice",
        singular: "malice",
        plural: "malice",
        maximum: Number(state.maximumMalice || 5),
        value: Number(state.malice || 0),
        canStart: false,
        step: 1,
        displayMode: "pips",
        pipStyle: "thief-malice",
        shortLabel: "Mal",
        statusLabel: "Current",
      });
    }
    if (specialization === "Specter") {
      views.push({
        id: "shadow-force",
        singular: "shadow force",
        plural: "shadow force",
        maximum: 100,
        value: Number(
          state.shadowForce ?? context.initialShadowForce ?? 0,
        ),
        startMaximum: 100,
        startValue: Number(context.initialShadowForce ?? 0),
        canStart: true,
        buildKey: "initialShadowForce",
        step: 1,
        displayMode: "bar",
        shortLabel: "SF",
        statusLabel: state.shadowShroudActive ? "Shroud" : "Current",
      });
    }
    if (specialization === "Antiquary") {
      views.push({
        id: "artifact-uses",
        singular: "artifact use",
        plural: "artifact uses",
        maximum: 2,
        value: Number(state.artifactUsesRemaining || 0),
        canStart: false,
        step: 1,
        displayMode: "pips",
        shortLabel: "Art",
        statusLabel: "Available",
      });
    }
    return views;
  },
  isPaletteSkillAvailable(context, skill) {
    return availability(skill, context).available;
  },
  paletteSkillUnavailableMessage(context, skill) {
    return availability(skill, context).message;
  },
  eventLogRow: thiefEventLogRow,
});
