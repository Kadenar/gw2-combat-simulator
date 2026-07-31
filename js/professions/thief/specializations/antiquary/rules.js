import { professionSpecializationState } from "../../../../platform/engine/profession.js";
import { MODIFIER_TARGET } from "../../../../platform/gw2/modifier-rules.js";
import { hasTrait } from "../../../../platform/gw2/trait-state.js";
import {
  THIEF_SKILL_IDS as ID,
  THIEF_TRAIT_IDS as TRAIT,
} from "../../data/ids.js";
import {
  thiefPlayerEvent,
  thiefRuntimeSpecializationState,
} from "../../core/rules.js";
import { antiquaryCastAvailability } from "./availability.js";

function meticulousArtifactStrikeFactor(context) {
  const event = context.event || {};
  if (event.skillId === ID.METAL_LEGION_GUITAR) {
    return event.name === "Final Smash" ? 3 / 2.5 : 1.2 / 0.8;
  }
  if (event.skillId === ID.MISTBURN_MORTAR) return 0.6 / 0.5;
  if (event.skillId === ID.CHAK_SHIELD) return 1;
  if (event.skillId === ID.SUMMON_KRYPTIS_TURRET_ID_77192) {
    return 3.84 / 2.8;
  }
  if (event.skillId === ID.HOLO_DANCER_DECOY) return 3 / 2;
  return 1;
}

export const antiquaryModifierRules = Object.freeze([
  {
    id: "thief.antiquary-artifact-momentum",
    target: MODIFIER_TARGET.STRIKE_DAMAGE,
    operation: "damage-additive",
    amount: 0.1,
    when: context =>
      thiefPlayerEvent(context)
      && Number(
        thiefRuntimeSpecializationState(context, "Antiquary")
          .antiquaryDamageUntil || 0,
      )
        > context.time,
  },
  {
    id: "thief.combat-high-strike",
    target: MODIFIER_TARGET.STRIKE_DAMAGE,
    operation: "damage-additive",
    amount: context => Math.min(
      10,
      Math.ceil(Math.max(
        0,
        Number(
          thiefRuntimeSpecializationState(context, "Antiquary")
            .combatHighExpiresAt || 0,
        )
          - context.time,
      ) / 2),
    ) * 0.03,
    when: context =>
      thiefPlayerEvent(context) && hasTrait(context, TRAIT.COMBAT_HIGH),
  },
  {
    id: "thief.combat-high-condition",
    target: MODIFIER_TARGET.CONDITION_DAMAGE,
    operation: "damage-additive",
    amount: context => Math.min(
      10,
      Math.ceil(Math.max(
        0,
        Number(
          thiefRuntimeSpecializationState(context, "Antiquary")
            .combatHighExpiresAt || 0,
        )
          - context.time,
      ) / 2),
    ) * 0.02,
    when: context =>
      thiefPlayerEvent(context) && hasTrait(context, TRAIT.COMBAT_HIGH),
  },
  {
    id: "thief.kryptis-turret-damage",
    target: MODIFIER_TARGET.STRIKE_DAMAGE,
    operation: "multiply",
    factor: 1.15,
    when: context =>
      thiefPlayerEvent(context)
      && Number(
        thiefRuntimeSpecializationState(context, "Antiquary")
          .kryptisDamageUntil || 0,
      )
        > context.time,
  },
  {
    id: "thief.meticulous-custodian-artifact-strike",
    target: MODIFIER_TARGET.STRIKE_DAMAGE,
    operation: "multiply",
    factor: meticulousArtifactStrikeFactor,
    when: context =>
      thiefPlayerEvent(context)
      && hasTrait(context, TRAIT.METICULOUS_CUSTODIAN)
      && [
        ID.METAL_LEGION_GUITAR,
        ID.MISTBURN_MORTAR,
        ID.CHAK_SHIELD,
        ID.SUMMON_KRYPTIS_TURRET_ID_77192,
        ID.HOLO_DANCER_DECOY,
      ].includes(Number(context.event?.skillId)),
  },
  {
    id: "thief.meticulous-custodian-mortar-burning",
    target: MODIFIER_TARGET.CONDITION_DURATION,
    operation: "multiply",
    factor: 2 / 1.5,
    when: context =>
      hasTrait(context, TRAIT.METICULOUS_CUSTODIAN)
      && context.event?.skillId === ID.MISTBURN_MORTAR
      && context.event?.condition === "Burning"
      && context.event?.triggeredBy == null,
  },
  {
    id: "thief.meticulous-custodian-sun-crystal-burning",
    target: MODIFIER_TARGET.CONDITION_DURATION,
    operation: "multiply",
    factor: 5 / 4,
    when: context =>
      hasTrait(context, TRAIT.METICULOUS_CUSTODIAN)
      && context.event?.skillId === ID.ZEPHYRITE_SUN_CRYSTAL
      && context.event?.condition === "Burning",
  },
]);

export const antiquaryAttributeRules = Object.freeze({
  modifierRules: antiquaryModifierRules,
});

function modifyAntiquaryRechargeDuration(context, duration) {
  const state = professionSpecializationState(context, "Antiquary");
  const expirations = (
    state.holoUtilityCooldownReductionExpirations || []
  ).filter(expiresAt => Number(expiresAt) > context.start);
  state.holoUtilityCooldownReductionExpirations = expirations;
  if (context.skill.type !== "Utility" || expirations.length === 0) {
    return duration;
  }
  expirations.shift();
  state.holoUtilityCooldownReduction = expirations.length ? 0.8 : 0;
  state.holoUtilityCooldownReductionExpiresAt = expirations.length
    ? Math.max(...expirations)
    : 0;
  return duration * 0.2;
}

export const antiquaryCastRules = Object.freeze({
  availability: {
    id: "thief.antiquary-availability",
    order: 20,
    handler: antiquaryCastAvailability,
  },
  modifyRechargeDuration: modifyAntiquaryRechargeDuration,
});
