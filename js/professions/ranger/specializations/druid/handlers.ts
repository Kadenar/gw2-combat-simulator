import { enterAvatar, leaveAvatar } from "./mechanics.js";
import { hasTrait } from "../../../../platform/gw2/trait-state.js";
import { gw2StatsForWeaponSet } from "../../../../platform/gw2/runtime-rules.js";
import {
  RANGER_SKILL_IDS as ID,
  RANGER_TRAIT_IDS as TRAIT,
} from "../../data/ids.js";
import type { RangerCastContext, RangerSkill } from "../../types.js";

function boonDuration(
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
    duration: boonDuration(context, 1),
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

function applyCelestialAvatarTraits(
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

export const druidSkillHandlers = Object.freeze({
  "ranger.celestial-avatar-enter": {
    mode: "augment" as const,
    afterEffects: enterAvatar,
  },
  "ranger.celestial-avatar-exit": {
    mode: "augment" as const,
    afterEffects(context: RangerCastContext, skill: RangerSkill) {
      leaveAvatar(context, false, context.effectiveEnd, skill);
    },
  },
  "ranger.celestial-avatar-skill": {
    mode: "augment" as const,
    afterEffects: applyCelestialAvatarTraits,
  },
});
