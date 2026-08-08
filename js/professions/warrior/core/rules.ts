import { professionCoreState } from "../../../platform/engine/profession.js";
import {
  createModifierHooks,
  MODIFIER_TARGET,
} from "../../../platform/gw2/modifier-rules.js";
import { hasTrait } from "../../../platform/gw2/trait-state.js";
import { targetHasCondition } from "../../../platform/gw2/target-state.js";
import { WARRIOR_TRAIT_IDS as TRAIT } from "../data/ids.js";
import { warriorCastAvailability } from "./availability.js";
import { observeWarriorEvent, updateWarriorCastState } from "./handlers.js";
import { handleWarriorAdrenalineTask } from "./resources.js";
import type {
  SchedulerRecord,
  SkillId,
} from "../../../platform/engine/types.js";
import type {
  Gw2ModifierContext,
  Gw2ModifierRule,
} from "../../../platform/gw2/types.js";
import type {
  WarriorCastContext,
  WarriorRuntimeState,
  WarriorSchedulerContext,
  WarriorSkill,
} from "../types.js";
import type { WarriorCoreState } from "../types.js";

function runtimeState(
  context: Gw2ModifierContext,
): Partial<WarriorRuntimeState> {
  return ((context.runtime as { profession?: WarriorRuntimeState } | undefined)
    ?.profession || {}) as Partial<WarriorRuntimeState>;
}

function coreState(context: Gw2ModifierContext): Partial<WarriorCoreState> {
  return runtimeState(context).core || {};
}

function eventSkill(context: Gw2ModifierContext): WarriorSkill | undefined {
  const profession = context.profession as
    | { catalog?: { skillsById?: ReadonlyMap<SkillId, WarriorSkill> } }
    | undefined;
  return profession?.catalog?.skillsById?.get(
    (context.event?.skillId ?? context.skillId) as SkillId,
  );
}

function targetHealthFraction(context: Gw2ModifierContext): number {
  const maximum = Number(context.config?.target?.health || 0);
  if (!(maximum > 0)) return 1;
  const totals = (
    context.runtime as
      { totals?: { strike?: number; condition?: number } } | undefined
  )?.totals;
  return Math.max(
    0,
    1 -
      (Number(totals?.strike || 0) + Number(totals?.condition || 0)) / maximum,
  );
}

function targetControlled(context: Gw2ModifierContext): boolean {
  return Boolean(
    context.config?.target?.controlled ||
    context.config?.target?.defiant ||
    Number(coreState(context).targetControlledUntil || 0) > context.time,
  );
}

function boonActive(context: Gw2ModifierContext, boon: string): boolean {
  return Boolean(context.config?.boons?.[boon]);
}

function modifyWarriorAttributes(
  context: Gw2ModifierContext,
  attributes: SchedulerRecord,
): SchedulerRecord {
  const result = { ...attributes } as SchedulerRecord & {
    power: number;
    precision: number;
    ferocity: number;
    conditionDamage: number;
  };
  const state = coreState(context);
  const burstPower = (state.burstPowerExpiries || []).filter(
    (expiresAt: number) => expiresAt > context.time,
  ).length;
  const signetStacks = (state.signetMasteryExpiries || []).filter(
    (expiresAt: number) => expiresAt > context.time,
  ).length;
  if (hasTrait(context, TRAIT.PINNACLE_OF_STRENGTH)) {
    result.power +=
      Number(
        context.query?.mightStacksAt(
          context.time,
          context.runtime,
          context.event,
        ) || 0,
      ) * 10;
  }
  if (hasTrait(context, TRAIT.SIGNET_MASTERY))
    result.ferocity += signetStacks * 50;
  if (hasTrait(context, TRAIT.BERSERKERS_POWER) && burstPower > 0) {
    result.power += burstPower * 35;
  }
  return result;
}

const warriorModifierRules: readonly Gw2ModifierRule[] = Object.freeze([
  {
    id: "warrior.pinnacle-critical-chance",
    target: MODIFIER_TARGET.CRITICAL_CHANCE,
    operation: "add",
    amount: 0.05,
    when: (context) => hasTrait(context, TRAIT.PINNACLE_OF_STRENGTH),
  },
  {
    id: "warrior.berserkers-power",
    target: [MODIFIER_TARGET.STRIKE_DAMAGE, MODIFIER_TARGET.CONDITION_DAMAGE],
    operation: "damage-additive",
    amount: (context) =>
      (coreState(context).burstPowerExpiries || []).filter(
        (expiresAt: number) => expiresAt > context.time,
      ).length * 0.07,
    when: (context) => hasTrait(context, TRAIT.BERSERKERS_POWER),
  },
  {
    id: "warrior.leg-specialist",
    target: MODIFIER_TARGET.STRIKE_DAMAGE,
    operation: "multiply",
    factor: 1.1,
    order: 100,
    when: (context) =>
      hasTrait(context, TRAIT.LEG_SPECIALIST) &&
      ["Crippled", "Chilled", "Immobilized"].some((condition) =>
        targetHasCondition(
          context.config || {},
          condition,
          context.time,
          context.runtime,
        ),
      ),
  },
  {
    id: "warrior.warriors-cunning",
    target: MODIFIER_TARGET.STRIKE_DAMAGE,
    operation: "multiply",
    factor: 1.1,
    order: 100,
    when: (context) =>
      hasTrait(context, TRAIT.WARRIORS_CUNNING) &&
      targetHealthFraction(context) > 0.8,
  },
  {
    id: "warrior.cull-the-weak",
    target: MODIFIER_TARGET.STRIKE_DAMAGE,
    operation: "multiply",
    factor: 1.1,
    order: 100,
    when: (context) =>
      hasTrait(context, TRAIT.CULL_THE_WEAK) &&
      targetHasCondition(
        context.config || {},
        "Weakness",
        context.time,
        context.runtime,
      ),
  },
  {
    id: "warrior.merciless-hammer",
    target: MODIFIER_TARGET.STRIKE_DAMAGE,
    operation: "multiply",
    factor: 1.2,
    order: 100,
    when: (context) =>
      hasTrait(context, TRAIT.MERCILESS_HAMMER) &&
      ["Hammer", "Mace"].includes(String(eventSkill(context)?.weapon || "")) &&
      targetControlled(context),
  },
  {
    id: "warrior.deep-strikes",
    target: MODIFIER_TARGET.CRITICAL_CHANCE,
    operation: "add",
    amount: 0.1,
    when: (context) =>
      hasTrait(context, TRAIT.DEEP_STRIKES) &&
      targetHasCondition(
        context.config || {},
        "Bleeding",
        context.time,
        context.runtime,
      ),
  },
  {
    id: "warrior.unsuspecting-foe",
    target: MODIFIER_TARGET.CRITICAL_CHANCE,
    operation: "add",
    amount: 0.5,
    when: (context) =>
      hasTrait(context, TRAIT.UNSUSPECTING_FOE) && targetControlled(context),
  },
  {
    id: "warrior.burst-precision",
    target: MODIFIER_TARGET.CRITICAL_CHANCE,
    operation: "add",
    amount: 1,
    when: (context) =>
      hasTrait(context, TRAIT.BURST_PRECISION) &&
      Boolean(eventSkill(context)?.burst),
  },
  {
    id: "warrior.warriors-sprint",
    target: MODIFIER_TARGET.STRIKE_DAMAGE,
    operation: "multiply",
    factor: 1.1,
    order: 100,
    when: (context) =>
      hasTrait(context, TRAIT.WARRIORS_SPRINT) &&
      boonActive(context, "swiftness"),
  },
  {
    id: "warrior.burst-mastery",
    target: MODIFIER_TARGET.STRIKE_DAMAGE,
    operation: "multiply",
    factor: 1.15,
    order: 100,
    when: (context) =>
      hasTrait(context, TRAIT.BURST_MASTERY) &&
      Boolean(eventSkill(context)?.burst),
  },
]);

function modifyRechargeDuration(
  context: WarriorSchedulerContext & { skill?: WarriorSkill },
  duration: number,
): number {
  const skill = context.skill;
  let result = duration;
  if (skill?.burst && hasTrait(context, TRAIT.VERSATILE_POWER)) result *= 0.85;
  if (
    skill?.weapon === "Greatsword" &&
    hasTrait(context, TRAIT.FORCEFUL_GREATSWORD)
  )
    result *= 0.8;
  if (skill?.weapon === "Sword" && hasTrait(context, TRAIT.BLADEMASTER))
    result *= 0.8;
  if (skill?.weapon === "Axe" && hasTrait(context, TRAIT.AXE_MASTERY))
    result *= 0.8;
  return result;
}

export const warriorCoreAttributeRules = Object.freeze({
  modifyAttributes: modifyWarriorAttributes,
  modifierRules: warriorModifierRules,
  compileModifierRules: (rules: readonly Gw2ModifierRule[]) =>
    createModifierHooks({ rules }),
});

export const warriorCoreCastRules = Object.freeze({
  availability: {
    id: "warrior.resource",
    order: 10,
    handler: warriorCastAvailability,
  },
  modifyRechargeDuration,
});

export const warriorCoreSchedulerHooks = Object.freeze({
  afterCast: {
    id: "warrior.weapon-state",
    order: 10,
    handler: updateWarriorCastState,
  },
  onEventScheduled: {
    id: "warrior.adrenaline",
    order: 10,
    handler: observeWarriorEvent,
  },
  taskHandlers: Object.freeze({
    "warrior.adrenaline-hit": handleWarriorAdrenalineTask,
  }),
});
