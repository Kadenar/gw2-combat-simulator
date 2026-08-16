import { MODIFIER_TARGET } from "../../../../platform/gw2/modifier-rules.js";
import { professionStaticRulesApplied } from "../../../../platform/gw2/attribute-provenance.js";
import { hasTrait } from "../../../../platform/gw2/trait-state.js";
import { THIEF_TRAIT_IDS as TRAIT } from "../../data/ids.js";
import { thiefPlayerEvent } from "../../core/rules.js";
import { specterCastAvailability } from "./availability.js";
import { advanceSpecterResources, spendSpecterResources } from "./shroud.js";
import {
  handleDarkSentry,
  handleLarcenousTorment,
  observeSpecterEvent,
} from "./traits.js";
import type {
  Gw2ModifierContext,
  Gw2ModifierRule,
  Gw2ResolvedStats,
} from "../../../../platform/gw2/types.js";

export const specterSchedulerHooks = Object.freeze({
  advance: advanceSpecterResources,
  onCastStart: spendSpecterResources,
  onEventScheduled: {
    id: "thief.specter-events",
    order: 30,
    handler: observeSpecterEvent,
  },
  taskHandlers: Object.freeze({
    "thief.larcenous-torment": handleLarcenousTorment,
    "thief.specter-dark-sentry": handleDarkSentry,
  }),
});

// Second Opinion grants an extra +90 condition damage only while wielding Scepter in the active set.
function wieldingScepter(context: Gw2ModifierContext): boolean {
  const activeSet = Number(context.runtime?.activeWeaponSet) === 2 ? 2 : 1;
  return activeSet === 2
    ? context.config?.weaponSet2Primary === "Scepter"
    : context.config?.primaryWeapon === "Scepter";
}

function modifySpecterAttributes(
  context: Gw2ModifierContext,
  attributes: Gw2ResolvedStats,
): Gw2ResolvedStats {
  if (professionStaticRulesApplied(context.config)) return attributes;
  const result = { ...attributes };
  // Pattern C: conversions read gear-only stats. config.stats excludes might
  // (baked into the seed's condition damage) and live trait bonuses.
  // Using gear stats directly avoids double-counting the flat bonuses added below.
  const gearConditionDamage = Number(context.config?.stats?.conditionDamage || 0);
  const gearVitality = Number(context.config?.stats?.vitality || 0);
  if (hasTrait(context, TRAIT.SECOND_OPINION)) {
    result.healingPower =
      Number(result.healingPower || 0) + gearConditionDamage * 0.07;
    result.conditionDamage =
      Number(result.conditionDamage || 0) +
      90 +
      (wieldingScepter(context) ? 90 : 0);
  }
  if (hasTrait(context, TRAIT.STRENGTH_OF_SHADOWS)) {
    result.expertise = Number(result.expertise || 0) + gearVitality * 0.13;
  }
  return result;
}

export const specterModifierRules: readonly Gw2ModifierRule[] = Object.freeze([
  {
    id: "thief.strength-of-shadows",
    target: MODIFIER_TARGET.CONDITION_DAMAGE,
    operation: "damage-additive",
    amount: 0.2,
    when: (context) =>
      thiefPlayerEvent(context) &&
      hasTrait(context, TRAIT.STRENGTH_OF_SHADOWS) &&
      context.event?.condition === "Torment",
  },
]);

export const specterAttributeRules = Object.freeze({
  modifyAttributes: modifySpecterAttributes,
  modifierRules: specterModifierRules,
});

export const specterCastRules = Object.freeze({
  availability: {
    id: "thief.specter-availability",
    order: 20,
    handler: specterCastAvailability,
  },
});
