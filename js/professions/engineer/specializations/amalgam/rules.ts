import { MODIFIER_TARGET } from "../../../../platform/gw2/modifier-rules.js";
import { hasTrait } from "../../../../platform/gw2/trait-state.js";
import { ENGINEER_TRAIT_IDS as TRAIT } from "../../data/ids.js";
import {
  activeBoonStacks,
  activeEngineerSpecializationState,
  cloneEngineerAttributes,
  eventSkill,
} from "../../core/rule-helpers.js";
import { hasEngineerTrait } from "../../core/state.js";
import { engineerBalanceValue } from "../../core/profiles.js";
import { AMALGAM_BALANCE_PROFILE_IDS as PROFILE } from "./profiles.js";
import { amalgamCastAvailability } from "./availability.js";
import type { SchedulerRecord } from "../../../../platform/engine/types.js";
import type {
  Gw2ModifierContext,
  Gw2ModifierRule,
} from "../../../../platform/gw2/types.js";
import type { EngineerMaximumAmmoContext } from "../../types.js";
import type { EngineerMechAttributes } from "../../types.js";
import {
  handleMercurialTendencies,
  observeAmalgamScheduledEvent,
} from "./amalgam.js";

export const amalgamSchedulerHooks = Object.freeze({
  onEventScheduled: {
    id: "engineer.amalgam-events",
    order: 20,
    handler: observeAmalgamScheduledEvent,
  },
  taskHandlers: Object.freeze({
    "engineer.mercurial-tendencies": handleMercurialTendencies,
  }),
});

// All secondary stats scaled by Evolved (×1.1, or ×1.2 with Double Helix).
// Note: armor/critDamage/critChance are derived, not listed — they update
// automatically when the underlying stats (toughness/ferocity/precision) change.
const EVOLVE_ATTRIBUTES: readonly (keyof EngineerMechAttributes)[] =
  Object.freeze([
    "power",
    "precision",
    "toughness",
    "vitality",
    "ferocity",
    "conditionDamage",
    "expertise",
    "concentration",
    "healingPower",
  ]);

function morphStrike(context: Gw2ModifierContext): boolean {
  return Boolean(
    context.event?.actorType !== "summon" &&
    eventSkill(context)?.categories?.includes("Morph"),
  );
}

export const amalgamModifierRules: readonly Gw2ModifierRule[] = Object.freeze([
  {
    id: "engineer.willing-host",
    target: [MODIFIER_TARGET.STRIKE_DAMAGE, MODIFIER_TARGET.CONDITION_DAMAGE],
    operation: "damage-additive",
    amount: 0.05,
    when: (context) =>
      context.event?.actorType !== "summon" &&
      hasTrait(context, TRAIT.WILLING_HOST) &&
      activeEngineerSpecializationState(context, "Amalgam", "willingHostUntil"),
  },
  {
    id: "engineer.symbiotic-synergy",
    target: MODIFIER_TARGET.STRIKE_DAMAGE,
    operation: "damage-additive",
    amount: 0.33,
    when: (context) =>
      hasTrait(context, TRAIT.SYMBIOTIC_SYNERGY) && morphStrike(context),
  },
  {
    id: "engineer.plasmatic-state",
    target: [MODIFIER_TARGET.STRIKE_DAMAGE, MODIFIER_TARGET.CONDITION_DAMAGE],
    operation: "damage-additive",
    amount: 0.07,
    when: (context) =>
      context.event?.actorType !== "summon" &&
      activeEngineerSpecializationState(
        context,
        "Amalgam",
        "plasmaticStateUntil",
      ),
  },
  {
    id: "engineer.carbolic-composition-duration",
    target: MODIFIER_TARGET.CONDITION_DURATION,
    operation: "add",
    amount: 0.33,
    when: (context) =>
      context.condition === "Poisoned" &&
      hasTrait(context, TRAIT.CARBOLIC_COMPOSITION),
  },
]);

function modifyAmalgamAttributes(
  context: Gw2ModifierContext,
  attributes: SchedulerRecord,
): SchedulerRecord {
  const modified = cloneEngineerAttributes(attributes);
  if (activeEngineerSpecializationState(context, "Amalgam", "evolvedUntil")) {
    const evolveFactor = hasTrait(context, TRAIT.DOUBLE_HELIX)
      ? engineerBalanceValue(
          context,
          PROFILE.evolve,
          "coefficientMultiplier",
          1.2,
        )
      : engineerBalanceValue(context, PROFILE.evolve, "damageMultiplier", 1.1);
    for (const attribute of EVOLVE_ATTRIBUTES) {
      modified[attribute] = Number(modified[attribute] || 0) * evolveFactor;
    }
  }
  if (activeEngineerSpecializationState(context, "Amalgam", "titanicUntil")) {
    // Titanic Strain adds 5 power + 5 condition damage per might stack on top
    // of the standard 30 power per stack that's already in the base attributes.
    const improvedMight =
      activeBoonStacks(context, "might") *
      engineerBalanceValue(context, PROFILE.strains, "attributePerStack", 5);
    modified.power += improvedMight;
    modified.conditionDamage += improvedMight;
  }
  return modified;
}

// Double Helix upgrades Evolve from a single-charge to a 2-ammo skill, which
// lets it store a second use while on cooldown.
function modifyAmalgamMaximumAmmo(
  context: EngineerMaximumAmmoContext,
  maximum: number,
): number {
  return context.skill?.name === "Evolve" &&
    hasEngineerTrait(context.config, TRAIT.DOUBLE_HELIX)
    ? Math.max(
        engineerBalanceValue(context, PROFILE.evolve, "maximumStacks", 2),
        Number(maximum || 0),
      )
    : maximum;
}

export const amalgamAttributeRules = Object.freeze({
  modifyAttributes: modifyAmalgamAttributes,
  modifierRules: amalgamModifierRules,
});

export const amalgamCastRules = Object.freeze({
  availability: {
    id: "engineer.amalgam-availability",
    order: 30,
    handler: amalgamCastAvailability,
  },
  modifyMaximumAmmo: modifyAmalgamMaximumAmmo,
});
