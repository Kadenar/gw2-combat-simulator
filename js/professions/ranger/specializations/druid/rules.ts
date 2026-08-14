import type { AvailabilityResult } from "../../../../platform/engine/types.js";
import { MODIFIER_TARGET } from "../../../../platform/gw2/modifier-rules.js";
import { gw2StatsForWeaponSet } from "../../../../platform/gw2/runtime-rules.js";
import { hasTrait } from "../../../../platform/gw2/trait-state.js";
import type {
  Gw2ModifierContext,
  Gw2ModifierRule,
} from "../../../../platform/gw2/types.js";
import {
  RANGER_SKILL_IDS as ID,
  RANGER_TRAIT_IDS as TRAIT,
} from "../../data/ids.js";
import type {
  RangerCastContext,
  RangerPrecastContext,
  RangerSkill,
} from "../../types.js";
import { druidState } from "./state.js";
import {
  advanceDruidState,
  astralForceReadyAt,
  generateAstralForce,
} from "./mechanics.js";

function druidBoonDuration(
  context: RangerCastContext,
  baseDuration: number,
): number {
  const stats = gw2StatsForWeaponSet(
    context.config,
    context.state.activeWeaponSet,
  );
  const bonus =
    Number(stats?.concentration || 0) / 1500 +
    Number(stats?.boonDurationBonus || 0) / 100 +
    Number(stats?.boonDurationBonuses?.Alacrity || 0) / 100;
  return baseDuration * Math.max(1, Math.min(2, 1 + bonus));
}

function emitGraceOfTheLand(
  context: RangerCastContext,
  skill: RangerSkill,
  at: number,
): void {
  context.emit({
    type: "buff",
    at,
    source: "Trait",
    sourceId: TRAIT.GRACE_OF_THE_LAND,
    actorType: "effect",
    skillId: TRAIT.GRACE_OF_THE_LAND,
    skillName: "Grace of the Land",
    name: "Grace of the Land - Alacrity",
    kind: "alacrity",
    duration: druidBoonDuration(context, 1),
    stacks: 1,
    triggeredBy: skill.name,
  });
}

function emitEclipseCondition(
  context: RangerCastContext,
  skill: RangerSkill,
  at: number,
  condition: string,
  duration: number,
): void {
  context.emit({
    type: "condition",
    at,
    source: "Trait",
    sourceId: TRAIT.ECLIPSE,
    actorType: "effect",
    skillId: TRAIT.ECLIPSE,
    skillName: "Eclipse",
    name: `Eclipse - ${condition}`,
    condition,
    duration,
    stacks: 1,
    triggeredBy: skill.name,
  });
}

export function applyCelestialAvatarTraits(
  context: RangerCastContext,
  skill: RangerSkill,
): void {
  const pulses =
    skill.id === ID.NATURAL_CONVERGENCE ? [0, 500, 1000, 1500] : [0];
  if (hasTrait(context, TRAIT.GRACE_OF_THE_LAND)) {
    for (const atMs of pulses) {
      emitGraceOfTheLand(context, skill, context.start + atMs / 1000);
    }
  }
  if (!hasTrait(context, TRAIT.ECLIPSE)) return;
  switch (skill.id) {
    case ID.COSMIC_RAY:
      emitEclipseCondition(context, skill, context.start, "Vulnerability", 8);
      break;
    case ID.SEED_OF_LIFE:
      emitEclipseCondition(context, skill, context.start, "Poisoned", 8);
      break;
    case ID.LUNAR_IMPACT:
      emitEclipseCondition(
        context,
        skill,
        context.effectiveEnd,
        "Immobilized",
        3,
      );
      break;
    case ID.REJUVENATING_TIDES:
      emitEclipseCondition(context, skill, context.start, "Chilled", 2);
      break;
    case ID.NATURAL_CONVERGENCE:
      for (const atMs of pulses) {
        emitEclipseCondition(
          context,
          skill,
          context.start + atMs / 1000,
          "Burning",
          5,
        );
      }
      break;
  }
}

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
