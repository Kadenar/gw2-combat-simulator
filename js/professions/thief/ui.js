import { THIEF_ASSUMPTION_CONTROLS } from "./assumptions.js";
import {
  thiefCatalog,
  thiefWeaponSkillMatchesSet,
} from "./catalog.js";
import { THIEF_SKILL_IDS as ID } from "./data/ids.js";

function stateFrom(context = {}) {
  return context.state?.profession || context.professionState || {};
}
function specializationFrom(context = {}) {
  return context.specialization || context.config?.specialization || "Core";
}
function ids(names) {
  return names.flatMap(name =>
    thiefCatalog.skills
      .filter(skill => skill.name === name)
      .map(skill => skill.id));
}
function activeWeapons(context) {
  const build = context.build || {};
  const set = Number(context.activeWeaponSet || 1);
  return set === 2
    ? build.alternateWeapons || ["", ""]
    : build.weapons || ["", ""];
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
    result.push(
      state.shadowShroudActive
        ? ID.EXIT_SHADOW_SHROUD
        : ID.ENTER_SHADOW_SHROUD,
    );
  }
  if (specialization === "Antiquary") {
    result.push(
      ...state.artifactSlots?.map(slot => slot.skillId) || [],
      ID.RESHUFFLE,
    );
  }
  return [...new Set(result.filter(Number.isFinite))];
}
function contextualGroups(context) {
  const state = stateFrom(context);
  const specialization = specializationFrom(context);
  const groups = [];
  if (specialization === "Specter" && state.shadowShroudActive) {
    groups.push({
      id: "thief-shadow-shroud",
      label: "Shroud",
      skillIds: thiefCatalog.skills
        .filter(skill => skill.shadowShroudSkill)
        .map(skill => skill.id),
      color: "#6b9988",
    });
  }
  const [mainHand] = activeWeapons(context);
  const stealthed =
    Number(state.stealthUntil || 0) > Number(context.time || 0)
    && Number(state.revealedUntil || 0) <= Number(context.time || 0);
  if (stealthed) {
    groups.push({
      id: "thief-stealth-attacks",
      label: "Stealth",
      skillIds: thiefCatalog.skills
        .filter(skill =>
          skill.stealthAttack
          && skill.requiredMainHand === mainHand
          && (
            specialization === "Deadeye"
              ? skill.malicious
              : !skill.malicious
          ))
        .map(skill => skill.id),
      color: "#7f434d",
    });
  }
  if (specialization === "Deadeye" && mainHand === "Rifle") {
    groups.push({
      id: "thief-rifle-stance",
      label: state.kneeling ? "Kneel" : "Stand",
      skillIds: [
        state.kneeling ? ID.FREE_ACTION : ID.KNEEL,
        ...thiefCatalog.skills
          .filter(skill =>
            skill.weapon === "Rifle"
            && !skill.stealthAttack
            && Boolean(skill.kneelSkill) === Boolean(state.kneeling))
          .map(skill => skill.id),
      ].filter(Number.isFinite),
      color: "#9a535c",
    });
  }
  return groups;
}
function availability(skill, context = {}) {
  const state = stateFrom(context);
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
  if (skill.shadowShroudSkill && !state.shadowShroudActive) {
    return {
      available: false,
      message: "Enter Shadow Shroud first",
    };
  }
  if (skill.stealthAttack) {
    const stealthed =
      Number(state.stealthUntil || 0) > Number(context.time || 0)
      && Number(state.revealedUntil || 0) <= Number(context.time || 0);
    return {
      available: stealthed,
      message: stealthed ? "" : "Gain stealth first",
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
  }, ...contextualGroups(context)],
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
      displayMode: "bar",
      shortLabel: "Init",
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
