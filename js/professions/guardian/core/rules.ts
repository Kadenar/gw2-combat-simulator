import {
  createModifierHooks,
  MODIFIER_TARGET,
} from "../../../platform/gw2/modifier-rules.js";
import { professionCoreState } from "../../../platform/engine/profession.js";
import { attributeProvenance } from "../../../platform/gw2/attribute-provenance.js";
import { targetHasCondition as targetHasConfiguredCondition } from "../../../platform/gw2/target-state.js";
import { hasTrait } from "../../../platform/gw2/trait-state.js";
import { GUARDIAN_SKILL_IDS, GUARDIAN_TRAIT_IDS } from "../data/ids.js";
import type {
  SchedulerRecord,
  SimulationEvent,
} from "../../../platform/engine/types.js";
import type {
  Gw2ModifierContext,
  Gw2ModifierRule,
  Gw2ResolvedStats,
} from "../../../platform/gw2/types.js";
import type {
  GuardianCastContext,
  GuardianSchedulerContext,
  GuardianSkill,
  GuardianState,
} from "../types.js";
import { validateGuardianAvailability } from "./availability.js";
import {
  advanceSpearIlluminationState,
  updateSpearIlluminationState,
} from "./spear.js";
import {
  observeGuardianScheduledEvent,
  updateGuardianTraitCastState,
} from "./traits.js";
import { validateVirtueCast } from "./virtues.js";
import { updateWeaponCastState, validateWeaponState } from "./weapon-state.js";

type GuardianRechargeModifierContext = GuardianSchedulerContext &
  SchedulerRecord & {
    readonly skill?: GuardianSkill;
  };

type GuardianAmmoModifierContext = GuardianSchedulerContext &
  SchedulerRecord & {
    readonly skill?: GuardianSkill;
  };

/** @param {Gw2ModifierContext} context */
export function guardianRuntimeState(
  context: Gw2ModifierContext,
): Partial<GuardianState> {
  const state = context.runtime?.profession as
    | { readonly core?: Partial<GuardianState> }
    | Partial<GuardianState>
    | undefined;
  return state && "core" in state && state.core
    ? state.core
    : state as Partial<GuardianState> || {};
}

/** @param {Gw2ModifierContext} context */
function activeWeapon(context: Gw2ModifierContext): string | undefined {
  const eventWeapon = context.event?.skillWeapon;
  if (typeof eventWeapon === "string") return eventWeapon;
  const weaponSet = context.timeline?.activeWeaponSetAt(context.time) || 1;
  return weaponSet === 2
    ? context.config?.weaponSet2Primary
    : context.config?.primaryWeapon;
}

/**
 * @param {Gw2ModifierContext} context
 * @param {string} condition
 */
function targetHasCondition(
  context: Gw2ModifierContext,
  condition: string,
): boolean {
  if (context.query?.targetHasCondition) {
    return Boolean(
      context.query.targetHasCondition(
        condition,
        context.time,
        context.runtime,
      ),
    );
  }
  return targetHasConfiguredCondition(
    context.config || {},
    condition,
    context.time,
    context.runtime,
  );
}

/** @param {string | undefined} weapon */
function isOneHandedWeapon(weapon: string | undefined): boolean {
  return (
    typeof weapon === "string" &&
    ![
      "Greatsword",
      "Hammer",
      "Longbow",
      "Short Bow",
      "Spear",
      "Staff",
    ].includes(weapon)
  );
}

/**
 * @param {Gw2ModifierContext} context
 * @param {string} boon
 */
export function guardianBoonActive(
  context: Gw2ModifierContext,
  boon: string,
): boolean {
  if (context.config?.boons?.[boon]) return true;
  if (context.timeline?.timedActive(boon, context.time)) return true;
  if (
    boon === "resolution" &&
    Number(guardianRuntimeState(context).resolutionUntil || 0) > context.time
  )
    return true;
  return (context.runtime?.boons?.get(boon) || []).some(
    (application) =>
      application.at <= context.time && application.expiresAt > context.time,
  );
}

/**
 * @param {Gw2ModifierContext} context
 * @param {string} kind
 */
export function guardianTimedBuffActive(
  context: Gw2ModifierContext,
  kind: string,
): boolean {
  return Boolean(context.timeline?.timedActive(kind, context.time));
}

/**
 * @param {Gw2ModifierContext} context
 * @param {string} kind
 * @returns {SimulationEvent | null}
 */
export function latestGuardianTimedBuff(
  context: Gw2ModifierContext,
  kind: string,
): SimulationEvent | null {
  let latest: SimulationEvent | null = null;
  for (const event of context.events || []) {
    if (event.at > context.time) break;
    if (event.type === "buff" && event.kind === kind) latest = event;
  }
  return latest;
}

/** @param {Gw2ModifierContext} context */
export function guardianTargetDisabled(context: Gw2ModifierContext): boolean {
  if (
    context.config?.target?.disabled ||
    context.config?.target?.defianceBroken
  )
    return true;
  return (context.events || []).some(
    (event) =>
      event.type === "control" &&
      event.at <= context.time &&
      event.at + Math.max(0, Number(event.duration || 0)) > context.time,
  );
}

/**
 * @param {Gw2ModifierContext} context
 * @param {Gw2ResolvedStats} attributes
 * @returns {Gw2ResolvedStats}
 */
function modifyGuardianAttributes(
  context: Gw2ModifierContext,
  attributes: Gw2ResolvedStats,
): Gw2ResolvedStats {
  const result = { ...attributes };
  const currentWeapon = activeWeapon(context);
  const provenance = attributeProvenance(context.config);
  const staticWeapon = provenance.calculatedPrimaryWeapon;
  const staticApplied = provenance.professionStaticRulesApplied;
  if (hasTrait(context, GUARDIAN_TRAIT_IDS.ZEALOUS_BLADE)) {
    if (staticApplied) {
      result.power +=
        (Number(currentWeapon === "Greatsword") -
          Number(staticWeapon === "Greatsword")) *
        120;
    } else {
      result.power += 120;
      if (currentWeapon === "Greatsword") result.power += 120;
    }
  }
  if (hasTrait(context, GUARDIAN_TRAIT_IDS.RIGHT_HAND_STRENGTH)) {
    if (staticApplied) {
      result.power +=
        (Number(isOneHandedWeapon(currentWeapon)) -
          Number(isOneHandedWeapon(staticWeapon))) *
        80;
    } else {
      result.precision += 80;
      if (isOneHandedWeapon(currentWeapon)) result.power += 80;
    }
  }
  if (!staticApplied && hasTrait(context, GUARDIAN_TRAIT_IDS.RADIANT_POWER)) {
    result.ferocity += 150;
  }
  if (hasTrait(context, GUARDIAN_TRAIT_IDS.POWER_OF_THE_VIRTUOUS)) {
    result.conditionDamage += Number(result.vitality || 0) * 0.13;
  }
  return result;
}

export const guardianCoreModifierRules: readonly Gw2ModifierRule[] =
  Object.freeze([
    {
      id: "guardian.radiant-power-critical-chance",
      target: MODIFIER_TARGET.CRITICAL_CHANCE,
      operation: "add",
      amount: 0.1,
      when: (context) =>
        hasTrait(context, GUARDIAN_TRAIT_IDS.RADIANT_POWER) &&
        targetHasCondition(context, "Burning"),
    },
    {
      id: "guardian.righteous-instincts",
      target: MODIFIER_TARGET.CRITICAL_CHANCE,
      operation: "add",
      amount: 0.25,
      when: (context) =>
        hasTrait(context, GUARDIAN_TRAIT_IDS.RIGHTEOUS_INSTINCTS) &&
        guardianBoonActive(context, "resolution"),
    },
    {
      id: "guardian.retribution",
      target: MODIFIER_TARGET.STRIKE_DAMAGE,
      operation: "damage-additive",
      amount: 0.1,
      when: (context) =>
        hasTrait(context, GUARDIAN_TRAIT_IDS.RETRIBUTION) &&
        guardianBoonActive(context, "resolution"),
    },
    {
      id: "guardian.furious-focus",
      target: MODIFIER_TARGET.STRIKE_DAMAGE,
      operation: "damage-additive",
      amount: 0.1,
      when: (context) =>
        hasTrait(context, GUARDIAN_TRAIT_IDS.FURIOUS_FOCUS) &&
        Boolean(context.timeline?.furyActiveAt(context.time)),
    },
    {
      id: "guardian.symbolic-avenger",
      target: MODIFIER_TARGET.STRIKE_DAMAGE,
      operation: "damage-additive",
      amount: (context) =>
        Math.min(
          5,
          Number(guardianRuntimeState(context).symbolicAvengerStacks || 0),
        ) / 100,
      when: (context) =>
        hasTrait(context, GUARDIAN_TRAIT_IDS.SYMBOLIC_AVENGER) &&
        Number(guardianRuntimeState(context).symbolicAvengerUntil || 0) >
          context.time,
    },
    {
      id: "guardian.fiery-wrath",
      target: MODIFIER_TARGET.STRIKE_DAMAGE,
      operation: "multiply",
      factor: 1.05,
      order: 100,
      when: (context) =>
        hasTrait(context, GUARDIAN_TRAIT_IDS.FIERY_WRATH) &&
        targetHasCondition(context, "Burning"),
    },
    {
      id: "guardian.symbolic-exposure",
      target: MODIFIER_TARGET.STRIKE_DAMAGE,
      operation: "multiply",
      factor: 1.05,
      order: 100,
      when: (context) =>
        hasTrait(context, GUARDIAN_TRAIT_IDS.SYMBOLIC_EXPOSURE) &&
        targetHasCondition(context, "Vulnerability"),
    },
    {
      id: "guardian.amplified-wrath-damage",
      target: MODIFIER_TARGET.CONDITION_DAMAGE,
      operation: "multiply",
      factor: 1.1,
      when: (context) =>
        context.condition === "Burning" &&
        hasTrait(context, GUARDIAN_TRAIT_IDS.AMPLIFIED_WRATH),
    },
    {
      id: "guardian.radiant-fire-duration",
      target: MODIFIER_TARGET.CONDITION_DURATION,
      operation: "multiply",
      factor: 1.2,
      when: (context) =>
        context.condition === "Burning" &&
        hasTrait(context, GUARDIAN_TRAIT_IDS.RADIANT_FIRE),
    },
    {
      id: "guardian.justice-passive-duration",
      target: MODIFIER_TARGET.CONDITION_DURATION,
      operation: "multiply",
      factor: 1.2,
      when: (context) =>
        context.condition === "Burning" &&
        context.sourceId === "guardian.justice-passive" &&
        hasTrait(context, GUARDIAN_TRAIT_IDS.AMPLIFIED_WRATH),
    },
  ]);

export function compileGuardianModifierRules(
  rules: readonly Gw2ModifierRule[],
) {
  return createModifierHooks({ rules });
}

const guardianModifierHooks = compileGuardianModifierRules(
  guardianCoreModifierRules,
);

/**
 * @param {GuardianRechargeModifierContext} context
 * @param {number} duration
 */
function modifyGuardianRechargeDuration(
  context: GuardianRechargeModifierContext,
  duration: number,
): number {
  const skill = context.skill;
  let result = duration;
  if (
    skill?.weapon === "Greatsword" &&
    hasTrait(context, GUARDIAN_TRAIT_IDS.ZEALOUS_BLADE)
  ) {
    result *= 0.8;
  }
  if (
    skill?.weapon === "Torch" &&
    hasTrait(context, GUARDIAN_TRAIT_IDS.RADIANT_FIRE)
  ) {
    result *= 0.8;
  }
  if (
    skill?.weapon === "Focus" &&
    hasTrait(context, GUARDIAN_TRAIT_IDS.FOCUS_MASTERY)
  ) {
    result *= 0.8;
  }
  if (
    [
      GUARDIAN_SKILL_IDS.JUSTICE,
      GUARDIAN_SKILL_IDS.RESOLVE,
      GUARDIAN_SKILL_IDS.COURAGE,
    ].some((skillId) => skillId === skill?.id) &&
    hasTrait(context, GUARDIAN_TRAIT_IDS.POWER_OF_THE_VIRTUOUS)
  ) {
    result *= 0.85;
  }
  return result;
}

/**
 * @param {GuardianAmmoModifierContext} context
 * @param {number} maximum
 */
function modifyGuardianMaximumAmmo(
  context: GuardianAmmoModifierContext,
  maximum: number,
): number {
  return context.skill?.categories?.includes("SpiritWeapon") &&
    hasTrait(context, GUARDIAN_TRAIT_IDS.ETERNAL_ARMORY)
    ? maximum + 1
    : maximum;
}

/**
 * @param {GuardianCastContext} context
 * @param {number} duration
 */
function modifyGuardianCastDuration(
  context: GuardianCastContext,
  duration: number,
): number {
  if (
    context.skill?.id !== GUARDIAN_SKILL_IDS.DAYBREAKING_SLASH ||
    !context.hasBuff?.("quickness", context.start)
  ) {
    return duration;
  }
  return Number(professionCoreState(context).daybreakingSlashChainStep || 0) === 0
    ? 0.52
    : 0.44;
}

export const guardianCoreAttributeRules = Object.freeze({
  modifyAttributes: modifyGuardianAttributes,
  modifierRules: guardianCoreModifierRules,
  compileModifierRules: compileGuardianModifierRules,
});

export const guardianCoreCastRules = Object.freeze({
  validateCast: Object.freeze([
    {
      id: "guardian.availability",
      order: 10,
      handler: validateGuardianAvailability,
    },
    {
      id: "guardian.virtues",
      order: 20,
      handler: validateVirtueCast,
    },
    {
      id: "guardian.weapon-state",
      order: 50,
      handler: validateWeaponState,
    },
  ]),
  modifyCastDuration: modifyGuardianCastDuration,
  modifyRechargeDuration: modifyGuardianRechargeDuration,
  modifyMaximumAmmo: modifyGuardianMaximumAmmo,
});

export const guardianCoreSchedulerHooks = Object.freeze({
  advance: Object.freeze([
    {
      id: "guardian.spear",
      order: 30,
      handler: advanceSpearIlluminationState,
    },
  ]),
  afterCast: Object.freeze([
    {
      id: "guardian.weapon-state",
      order: 10,
      handler: updateWeaponCastState,
    },
    {
      id: "guardian.spear",
      order: 20,
      handler: updateSpearIlluminationState,
    },
    {
      id: "guardian.core-traits",
      order: 30,
      handler: updateGuardianTraitCastState,
    },
  ]),
  onEventScheduled: Object.freeze([
    {
      id: "guardian.traits",
      order: 10,
      handler: observeGuardianScheduledEvent,
    },
  ]),
});

export const guardianCoreModifierHooks = guardianModifierHooks;
