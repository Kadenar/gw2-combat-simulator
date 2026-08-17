import { MODIFIER_TARGET } from "../../../../platform/gw2/modifier-rules.js";
import { hasTrait } from "../../../../platform/gw2/trait-state.js";
import {
  RANGER_SKILL_IDS as ID,
  RANGER_TRAIT_IDS as TRAIT,
} from "../../data/ids.js";
import { selectedRangerPet } from "../../core/state.js";
import type { AvailabilityResult } from "../../../../platform/engine/types.js";
import type {
  Gw2ModifierContext,
  Gw2ModifierRule,
} from "../../../../platform/gw2/types.js";
import type { RangerPrecastContext, RangerSkill } from "../../types.js";
import { soulbeastState } from "./state.js";

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

// Three-layer lookup: static config assumptions → timeline snapshot → live resolver boon map.
// Config/timeline are checked first because runtime may not be populated during attribute pre-computation.
function activeBuff(context: Gw2ModifierContext, kind: string): boolean {
  if (context.config?.boons?.[kind]) return true;
  if (context.timeline?.timedActive(kind, context.time)) return true;
  return (context.runtime?.boons?.get(kind) || []).some(
    (application: { at: number; expiresAt: number; stacks: number }) =>
      application.at <= context.time &&
      application.expiresAt > context.time &&
      application.stacks > 0,
  );
}

function targetHealthFraction(context: Gw2ModifierContext): number {
  const maximum = Number(context.config?.target?.health || 0);
  if (!(maximum > 0)) return 1;
  const totals = context.runtime?.totals as
    { strike?: number; condition?: number } | undefined;
  return Math.max(
    0,
    1 -
      (Number(totals?.strike || 0) + Number(totals?.condition || 0)) / maximum,
  );
}

// Oppressive Superiority activates when the target's HP fraction is below the player's HP fraction —
// playerHealthFraction defaults to 1 (full HP) if unset, making the condition always false unless configured.
function oppressiveSuperiorityActive(context: Gw2ModifierContext): boolean {
  return (
    hasTrait(context, TRAIT.OPPRESSIVE_SUPERIORITY) &&
    targetHealthFraction(context) <
      Number(context.config?.playerHealthFraction ?? 1)
  );
}

export function soulbeastCastAvailability(
  context: RangerPrecastContext,
  skill: RangerSkill,
): AvailabilityResult {
  const state = soulbeastState.from(context);
  const toggle = skill.id === ID.BEASTMODE || skill.id === ID.LEAVE_BEASTMODE;
  // Wrong-pet check must precede the beastmode-active check: a skill can be a beastmodeSkill
  // but still invalid if it belongs to a different pet than the one currently selected.
  if (
    skill.beastmodeSkill &&
    !toggle &&
    !selectedRangerPet(context.config)?.beastmodeSkillIds.includes(skill.id)
  ) {
    return deny(
      skill,
      "ranger.inactive-merged-pet-skill",
      "select the pet that grants this merged Beast skill.",
    );
  }
  if (
    skill.beastmodeSkill &&
    !state.beastmodeActive &&
    skill.name !== "Beastmode"
  ) {
    return deny(skill, "ranger.beastmode-inactive", "enter Beastmode first.");
  }
  if (skill.name === "Beastmode" && state.beastmodeActive) {
    return deny(
      skill,
      "ranger.beastmode-active",
      "Beastmode is already active.",
    );
  }
  if (skill.name === "Leave Beastmode" && !state.beastmodeActive) {
    return deny(skill, "ranger.beastmode-inactive", "Beastmode is not active.");
  }
  return { ready: true };
}

export const soulbeastModifierRules: readonly Gw2ModifierRule[] = Object.freeze(
  [
    {
      id: "ranger.furious-strength",
      target: MODIFIER_TARGET.STRIKE_DAMAGE,
      operation: "damage-additive",
      amount: 0.15,
      // Furious Strength requires the player to have Fury; pet fury does not count.
      when: (context) =>
        hasTrait(context, TRAIT.FURIOUS_STRENGTH) &&
        activeBuff(context, "fury"),
    },
    {
      id: "ranger.sic-em-player",
      target: MODIFIER_TARGET.STRIKE_DAMAGE,
      operation: "multiply",
      factor: 1.25,
      when: (context) => activeBuff(context, "sic-em"),
    },
    {
      id: "ranger.lesser-sic-em-player",
      target: MODIFIER_TARGET.STRIKE_DAMAGE,
      operation: "multiply",
      factor: 1.15,
      when: (context) => activeBuff(context, "lesser-sic-em"),
    },
    {
      id: "ranger.twice-as-vicious-strike",
      target: MODIFIER_TARGET.STRIKE_DAMAGE,
      operation: "damage-additive",
      amount: 0.07,
      when: (context) => activeBuff(context, "twice-as-vicious"),
    },
    {
      id: "ranger.twice-as-vicious-condition",
      target: MODIFIER_TARGET.CONDITION_DAMAGE,
      operation: "damage-additive",
      amount: 0.1,
      when: (context) => activeBuff(context, "twice-as-vicious"),
    },
    {
      id: "ranger.oppressive-superiority",
      target: MODIFIER_TARGET.STRIKE_DAMAGE,
      operation: "multiply",
      factor: 1.1,
      when: oppressiveSuperiorityActive,
    },
    {
      id: "ranger.oppressive-superiority-condition-duration",
      target: MODIFIER_TARGET.CONDITION_DURATION,
      operation: "add",
      amount: 0.1,
      when: oppressiveSuperiorityActive,
    },
  ],
);

export const soulbeastAttributeRules = Object.freeze({
  modifierRules: soulbeastModifierRules,
});
export const soulbeastCastRules = Object.freeze({
  availability: {
    id: "ranger.soulbeast-availability",
    order: 20,
    handler: soulbeastCastAvailability,
  },
});
