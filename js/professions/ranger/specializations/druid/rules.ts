import type { AvailabilityResult } from "../../../../platform/engine/types.js";
import { MODIFIER_TARGET } from "../../../../platform/gw2/modifier-rules.js";
import { hasTrait } from "../../../../platform/gw2/trait-state.js";
import type {
  Gw2ModifierContext,
  Gw2ModifierRule,
} from "../../../../platform/gw2/types.js";
import { RANGER_TRAIT_IDS as TRAIT } from "../../data/ids.js";
import type { RangerPrecastContext, RangerSkill } from "../../types.js";
import { druidState } from "./state.js";
import {
  advanceDruidState,
  astralForceReadyAt,
  generateAstralForce,
} from "./mechanics.js";

function naturalBalanceActive(context: Gw2ModifierContext): boolean {
  if (!hasTrait(context, TRAIT.NATURAL_BALANCE)) return false;
  if (context.timeline?.timedActive("natural-balance", context.time))
    return true;
  return (context.runtime?.boons?.get("natural-balance") || []).some(
    (application: { at: number; expiresAt: number; stacks: number }) =>
      application.at <= context.time &&
      application.expiresAt > context.time &&
      application.stacks > 0,
  );
}

export const druidModifierRules: readonly Gw2ModifierRule[] = Object.freeze([
  {
    id: "ranger.natural-balance-condition-damage",
    target: MODIFIER_TARGET.CONDITION_DAMAGE,
    operation: "damage-additive",
    amount: 0.05,
    when: naturalBalanceActive,
  },
]);

export const druidAttributeRules = Object.freeze({
  modifierRules: druidModifierRules,
  modifyConditionBaseDuration(
    context: Gw2ModifierContext,
    duration: number,
  ): number {
    return naturalBalanceActive(context) ? duration * 1.1 : duration;
  },
});

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
      const retryAt = astralForceReadyAt(context);
      if (retryAt != null) {
        return {
          ready: false,
          retryAt,
          code: "ranger.astral-force",
          reason: `${skill.name} is recharging astral force.`,
        };
      }
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
