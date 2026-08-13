import { MODIFIER_TARGET } from "../../../../platform/gw2/modifier-rules.js";
import { professionStaticRulesApplied } from "../../../../platform/gw2/attribute-provenance.js";
import { hasTrait } from "../../../../platform/gw2/trait-state.js";
import {
  THIEF_SKILL_IDS as ID,
  THIEF_TRAIT_IDS as TRAIT,
} from "../../data/ids.js";
import {
  thiefEventSkill,
  thiefPlayerEvent,
  thiefRuntimeSpecializationState,
} from "../../core/rules.js";
import { deadeyeCastAvailability } from "./availability.js";
import { updateDeadeyeCastState } from "./mechanics.js";
import type {
  Gw2ModifierContext,
  Gw2ModifierRule,
  Gw2ResolvedStats,
} from "../../../../platform/gw2/types.js";

export const deadeyeSchedulerHooks = Object.freeze({
  afterCast: Object.freeze([
    {
      id: "thief.deadeye-malice",
      order: 30,
      handler: updateDeadeyeCastState,
    },
  ]),
});

const BOON_KINDS = Object.freeze([
  "aegis",
  "alacrity",
  "fury",
  "might",
  "protection",
  "quickness",
  "regeneration",
  "resistance",
  "resolution",
  "stability",
  "swiftness",
  "vigor",
]);
const SHADOW_FLARE_SKILL_IDS: ReadonlySet<number> = new Set([
  ID.SHADOW_FLARE,
  ID.SHADOW_SWAP,
]);
const MALICIOUS_DAMAGE_SCALING_SKILL_IDS: ReadonlySet<number> = new Set([
  ID.MALICIOUS_BACKSTAB,
  ID.MALICIOUS_DEATHS_JUDGMENT,
]);

function boonActive(context: Gw2ModifierContext, boon: string): boolean {
  if (context.config?.boons?.[boon]) return true;
  if (context.timeline?.timedActive(boon, context.time)) return true;
  return (context.runtime?.boons?.get(boon) || []).some(
    (application) =>
      application.affectsSelf !== false &&
      application.at <= context.time &&
      application.expiresAt > context.time,
  );
}

function activeBoonCount(context: Gw2ModifierContext): number {
  return BOON_KINDS.filter((boon) => boonActive(context, boon)).length;
}

function markedTarget(context: Gw2ModifierContext): boolean {
  const state = thiefRuntimeSpecializationState(context, "Deadeye");
  return (
    Boolean(state.markedTargetId) &&
    Number(state.markExpiresAt || Infinity) > context.time
  );
}

function modifyDeadeyeAttributes(
  context: Gw2ModifierContext,
  attributes: Gw2ResolvedStats,
): Gw2ResolvedStats {
  const result = { ...attributes };
  if (!professionStaticRulesApplied(context.config)) {
    if (hasTrait(context, TRAIT.SILENT_SCOPE)) result.precision += 120;
    if (hasTrait(context, TRAIT.PREMEDITATION)) result.concentration += 180;
  }
  if (
    hasTrait(context, TRAIT.BE_QUICK_OR_BE_KILLED) &&
    boonActive(context, "quickness")
  ) {
    result.power += 200;
    result.precision += 200;
  }
  return result;
}

export const deadeyeModifierRules: readonly Gw2ModifierRule[] = Object.freeze([
  {
    id: "thief.iron-sight",
    target: MODIFIER_TARGET.STRIKE_DAMAGE,
    operation: "multiply",
    factor: 1.1,
    when: (context) =>
      thiefPlayerEvent(context) &&
      hasTrait(context, TRAIT.IRON_SIGHT) &&
      markedTarget(context),
  },
  {
    id: "thief.premeditation",
    target: MODIFIER_TARGET.STRIKE_DAMAGE,
    operation: "multiply",
    factor: (context) => 1 + activeBoonCount(context) * 0.01,
    when: (context) =>
      thiefPlayerEvent(context) && hasTrait(context, TRAIT.PREMEDITATION),
  },
  {
    id: "thief.one-in-the-chamber",
    target: MODIFIER_TARGET.STRIKE_DAMAGE,
    operation: "multiply",
    factor: 1.25,
    when: (context) =>
      thiefPlayerEvent(context) &&
      hasTrait(context, TRAIT.ONE_IN_THE_CHAMBER) &&
      Boolean(thiefEventSkill(context)?.categories?.includes("stolen skill")),
  },
  {
    id: "thief.shadow-flare-marked",
    target: MODIFIER_TARGET.STRIKE_DAMAGE,
    operation: "multiply",
    factor: 1.5,
    when: (context) =>
      thiefPlayerEvent(context) &&
      markedTarget(context) &&
      SHADOW_FLARE_SKILL_IDS.has(Number(thiefEventSkill(context)?.id)),
  },
  {
    id: "thief.relic-of-the-deadeye",
    target: MODIFIER_TARGET.STRIKE_DAMAGE,
    operation: "multiply",
    factor: 1.1,
    when: (context) =>
      thiefPlayerEvent(context) &&
      context.config?.relic === "Deadeye" &&
      Number(
        thiefRuntimeSpecializationState(context, "Deadeye").deadeyeRelicUntil ||
          0,
      ) > context.time,
  },
  {
    id: "thief.malicious-stealth-attack",
    target: MODIFIER_TARGET.STRIKE_DAMAGE,
    operation: "damage-additive",
    amount: (context) =>
      Math.max(
        0,
        Number(thiefRuntimeSpecializationState(context, "Deadeye").malice || 0),
      ) * 0.1,
    when: (context) =>
      thiefPlayerEvent(context) &&
      MALICIOUS_DAMAGE_SCALING_SKILL_IDS.has(
        Number(thiefEventSkill(context)?.id),
      ),
  },
]);

export const deadeyeAttributeRules = Object.freeze({
  modifyAttributes: modifyDeadeyeAttributes,
  modifierRules: deadeyeModifierRules,
});

export const deadeyeCastRules = Object.freeze({
  availability: {
    id: "thief.deadeye-availability",
    order: 20,
    handler: deadeyeCastAvailability,
  },
});
