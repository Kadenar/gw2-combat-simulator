import type { AvailabilityResult } from "../../../../platform/engine/types.js";
import type { RangerPrecastContext, RangerSkill } from "../../types.js";
import { druidState } from "./state.js";
import { advanceDruidState, generateAstralForce } from "./mechanics.js";

export const druidSchedulerHooks = Object.freeze({
  advance: {
    id: "ranger.druid-advance",
    order: 20,
    handler: advanceDruidState,
  },
  afterCast: {
    id: "ranger.astral-force",
    order: 20,
    handler: generateAstralForce,
  },
});

function deny(
  skill: RangerSkill,
  code: string,
  cause: string,
): AvailabilityResult {
  return {
    ready: false,
    code,
    reason: `${skill.name} is unavailable - ${cause}`,
  };
}

export function druidCastAvailability(
  context: RangerPrecastContext,
  skill: RangerSkill,
): AvailabilityResult {
  const state = druidState.from(context);
  if (skill.celestialAvatarSkill && !state.celestialAvatarActive) {
    return deny(
      skill,
      "ranger.avatar-inactive",
      "enter Celestial Avatar first.",
    );
  }
  if (skill.name === "Celestial Avatar") {
    if (state.celestialAvatarActive) {
      return deny(
        skill,
        "ranger.avatar-active",
        "Celestial Avatar is already active.",
      );
    }
    if (state.astralForce < state.maximumAstralForce) {
      return deny(skill, "ranger.astral-force", "requires full astral force.");
    }
  }
  if (
    skill.name === "Release Celestial Avatar" &&
    !state.celestialAvatarActive
  ) {
    return deny(
      skill,
      "ranger.avatar-inactive",
      "Celestial Avatar is not active.",
    );
  }
  if (
    state.celestialAvatarActive &&
    skill.type === "Weapon" &&
    !skill.celestialAvatarSkill
  ) {
    return deny(
      skill,
      "ranger.avatar-weapon-bar",
      "Celestial Avatar replaces weapon skills.",
    );
  }
  return { ready: true };
}

export const druidCastRules = Object.freeze({
  availability: {
    id: "ranger.druid-availability",
    order: 20,
    handler: druidCastAvailability,
  },
});
