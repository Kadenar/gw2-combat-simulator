import {
  createModifierHooks,
  MODIFIER_TARGET,
} from "../../../platform/gw2/modifier-rules.js";
import { hasTrait } from "../../../platform/gw2/trait-state.js";
import { professionStaticRulesApplied } from "../../../platform/gw2/attribute-provenance.js";
import { professionCoreState } from "../../../platform/engine/profession.js";
import {
  RANGER_SKILL_IDS as ID,
  RANGER_TRAIT_IDS as TRAIT,
} from "../data/ids.js";
import { rangerCoreCastAvailability } from "./availability.js";
import { selectedRangerPet } from "./state.js";
import type { SkillId } from "../../../platform/engine/types.js";
import type {
  Gw2ModifierContext,
  Gw2ModifierRule,
  Gw2ResolvedStats,
} from "../../../platform/gw2/types.js";
import type { RangerSchedulerContext, RangerSkill } from "../types.js";

function playerEvent(context: Gw2ModifierContext): boolean {
  return context.event?.actorType !== "summon";
}

function petEvent(context: Gw2ModifierContext): boolean {
  return (
    context.event?.actorType === "summon" &&
    context.event?.source === "ranger-pet"
  );
}

function beastmodeActive(context: Gw2ModifierContext): boolean {
  const profession = (
    context.runtime as
      | {
          profession?: {
            specialization?: {
              kind?: string;
              state?: { beastmodeActive?: boolean };
            };
          };
        }
      | undefined
  )?.profession;
  return Boolean(
    profession?.specialization?.kind === "Soulbeast" &&
    profession.specialization.state?.beastmodeActive,
  );
}

function targetConditionCount(context: Gw2ModifierContext): number {
  const active = new Set(
    Object.entries(context.config?.target?.conditions || {})
      .filter(([, value]) => value === true || Number(value) > 0)
      .map(([condition]) => condition),
  );
  const runtime = context.runtime as
    | {
        conditionState?: Map<
          string,
          { stacks?: readonly { expiresAt?: number }[] }
        >;
      }
    | undefined;
  for (const [condition, entry] of runtime?.conditionState || []) {
    if (
      (entry.stacks || []).some(
        (stack) => Number(stack.expiresAt) > context.time,
      )
    ) {
      active.add(condition);
    }
  }
  return active.size;
}

function boonActive(context: Gw2ModifierContext, boon: string): boolean {
  if (context.config?.boons?.[boon]) return true;
  if (context.timeline?.timedActive(boon, context.time)) return true;
  return (context.runtime?.boons?.get(boon) || []).some(
    (application) =>
      application.at <= context.time && application.expiresAt > context.time,
  );
}

function activePrimaryWeapon(context: Gw2ModifierContext): string {
  return Number(context.runtime?.activeWeaponSet) === 2
    ? String(context.config?.weaponSet2Primary || "")
    : String(context.config?.primaryWeapon || "");
}

function selectedSkill(context: Gw2ModifierContext, name: string): boolean {
  const source = context.config?.selectedSkills || [];
  const selected = Array.isArray(source) ? source : Object.values(source);
  return selected.map(String).includes(name);
}

function eventSkill(context: Gw2ModifierContext): RangerSkill | undefined {
  const profession = context.profession as
    | { catalog?: { skillsById?: ReadonlyMap<SkillId, RangerSkill> } }
    | undefined;
  return profession?.catalog?.skillsById?.get(
    (context.event?.skillId ?? context.skillId) as SkillId,
  );
}

function modifyRangerAttributes(
  context: Gw2ModifierContext,
  attributes: Gw2ResolvedStats,
): Gw2ResolvedStats {
  const result = { ...attributes };
  const staticRulesApplied = professionStaticRulesApplied(context.config);
  const calculatedWeapon = String(
    context.config?.attributeProvenance?.calculatedPrimaryWeapon || "",
  );
  const merged = beastmodeActive(context);
  const adjust = (attribute: keyof Gw2ResolvedStats, amount: number): void => {
    result[attribute] = Number(result[attribute] || 0) + amount;
  };
  if (petEvent(context) && hasTrait(context, TRAIT.FANG_AND_CLAW)) {
    const family = selectedRangerPet(context.config).family;
    if (["feline", "avian", "drake"].includes(family)) {
      adjust("precision", 420);
      adjust("ferocity", 450);
    }
  }
  if (!staticRulesApplied) {
    if (hasTrait(context, TRAIT.STRIDERS_STRENGTH)) {
      adjust(
        "power",
        120 + (activePrimaryWeapon(context) === "Sword" ? 120 : 0),
      );
    }
    if (hasTrait(context, TRAIT.HONED_AXES)) {
      adjust(
        "ferocity",
        120 + (activePrimaryWeapon(context) === "Axe" ? 120 : 0),
      );
    }
    if (
      hasTrait(context, TRAIT.VICIOUS_QUARRY) &&
      boonActive(context, "fury")
    ) {
      adjust("ferocity", 250);
    }
    if (merged && hasTrait(context, TRAIT.PACK_ALPHA)) {
      for (const attribute of [
        "power",
        "precision",
        "toughness",
        "vitality",
        "ferocity",
        "conditionDamage",
        "expertise",
        "concentration",
        "healingPower",
      ] as const) {
        adjust(attribute, 150);
      }
    }
    if (merged && hasTrait(context, TRAIT.PETS_PROWESS)) {
      adjust("ferocity", 300);
    }
  } else if (!merged) {
    if (hasTrait(context, TRAIT.PACK_ALPHA)) {
      for (const attribute of [
        "power",
        "precision",
        "toughness",
        "vitality",
        "ferocity",
        "conditionDamage",
        "expertise",
        "concentration",
        "healingPower",
      ] as const) {
        adjust(attribute, -150);
      }
    }
    if (hasTrait(context, TRAIT.PETS_PROWESS)) adjust("ferocity", -300);
  }
  if (
    staticRulesApplied &&
    hasTrait(context, TRAIT.HONED_AXES) &&
    activePrimaryWeapon(context) === "Axe" &&
    calculatedWeapon !== "Axe"
  ) {
    result.ferocity = Number(result.ferocity || 0) + 120;
  }
  if (
    staticRulesApplied &&
    hasTrait(context, TRAIT.STRIDERS_STRENGTH) &&
    activePrimaryWeapon(context) === "Sword" &&
    calculatedWeapon !== "Sword"
  ) {
    result.power = Number(result.power || 0) + 120;
  }
  if (selectedSkill(context, "Signet of the Wild")) {
    const active = !context.timeline?.skillOnCooldownAt(
      ID.SIGNET_OF_THE_WILD,
      context.time,
    );
    if (staticRulesApplied && !active) adjust("ferocity", -180);
    if (!staticRulesApplied && active) adjust("ferocity", 180);
  }
  return result;
}

function modifyRangerConditionBaseDuration(
  context: Gw2ModifierContext,
  duration: number,
): number {
  const skill = eventSkill(context);
  if (
    skill?.categories?.includes("Trap") &&
    hasTrait(context, TRAIT.TRAPPERS_EXPERTISE)
  ) {
    return duration * (skill.id === ID.FLAME_TRAP ? 1.66 : 1.6);
  }
  if (hasTrait(context, TRAIT.LIGHT_ON_YOUR_FEET) && positional(context)) {
    if (skill?.id === ID.CROSSFIRE && context.condition === "Bleeding") {
      return duration + 2;
    }
    if (skill?.id === ID.POISON_VOLLEY && context.condition === "Poisoned") {
      return duration + 2;
    }
    if (
      skill?.id === ID.CRIPPLING_SHOT &&
      context.condition === "Immobilized"
    ) {
      return duration + 1;
    }
  }
  return duration;
}

function positional(context: Gw2ModifierContext): boolean {
  return Boolean(
    context.config?.target?.behind ||
    context.config?.target?.flanking ||
    context.config?.target?.defiant,
  );
}

function targetImpaired(context: Gw2ModifierContext): boolean {
  if (context.config?.target?.defiant) return true;
  return ["Chilled", "Crippled", "Immobilized", "Taunt", "Fear", "Slow"].some(
    (condition) =>
      Boolean(
        context.query?.targetHasCondition(
          condition,
          context.time,
          context.runtime,
        ),
      ),
  );
}

export const rangerCoreModifierRules: readonly Gw2ModifierRule[] =
  Object.freeze([
    {
      id: "ranger.hunters-tactics-damage",
      target: [MODIFIER_TARGET.STRIKE_DAMAGE, MODIFIER_TARGET.CONDITION_DAMAGE],
      operation: "damage-additive",
      amount: 0.1,
      when: (context) =>
        playerEvent(context) &&
        positional(context) &&
        hasTrait(context, TRAIT.HUNTERS_TACTICS),
    },
    {
      id: "ranger.hunters-tactics-critical-chance",
      target: MODIFIER_TARGET.CRITICAL_CHANCE,
      operation: "add",
      amount: 0.1,
      when: (context) =>
        playerEvent(context) &&
        positional(context) &&
        hasTrait(context, TRAIT.HUNTERS_TACTICS),
    },
    {
      id: "ranger.vicious-quarry-critical-chance",
      target: MODIFIER_TARGET.CRITICAL_CHANCE,
      operation: "add",
      amount: 0.15,
      when: (context) =>
        hasTrait(context, TRAIT.VICIOUS_QUARRY) && boonActive(context, "fury"),
    },
    {
      id: "ranger.farsighted",
      target: MODIFIER_TARGET.STRIKE_DAMAGE,
      operation: "damage-additive",
      amount: 0.1,
      when: (context) =>
        playerEvent(context) && hasTrait(context, TRAIT.FARSIGHTED),
    },
    {
      id: "ranger.predators-onslaught-player",
      target: MODIFIER_TARGET.STRIKE_DAMAGE,
      operation: "damage-additive",
      amount: 0.1,
      when: (context) =>
        playerEvent(context) &&
        targetImpaired(context) &&
        hasTrait(context, TRAIT.PREDATORS_ONSLAUGHT),
    },
    {
      id: "ranger.predators-onslaught-pet",
      target: MODIFIER_TARGET.STRIKE_DAMAGE,
      operation: "damage-additive",
      amount: 0.1,
      when: (context) =>
        petEvent(context) &&
        targetImpaired(context) &&
        hasTrait(context, TRAIT.PREDATORS_ONSLAUGHT),
    },
    {
      id: "ranger.hidden-barbs",
      target: MODIFIER_TARGET.CONDITION_DAMAGE,
      operation: "multiply",
      factor: 1.2,
      when: (context) =>
        context.condition === "Bleeding" &&
        hasTrait(context, TRAIT.HIDDEN_BARBS),
    },
    {
      id: "ranger.poison-master",
      target: MODIFIER_TARGET.CONDITION_DAMAGE,
      operation: "multiply",
      factor: 1.2,
      when: (context) =>
        context.condition === "Poisoned" &&
        hasTrait(context, TRAIT.POISON_MASTER),
    },
    {
      id: "ranger.survival-instincts",
      target: MODIFIER_TARGET.STRIKE_DAMAGE,
      operation: "damage-additive",
      amount: 0.1,
      when: (context) =>
        playerEvent(context) && hasTrait(context, TRAIT.SURVIVAL_INSTINCTS),
    },
    {
      id: "ranger.loud-whistle-player",
      target: MODIFIER_TARGET.STRIKE_DAMAGE,
      operation: "multiply",
      factor: 1.1,
      when: (context) =>
        playerEvent(context) &&
        beastmodeActive(context) &&
        hasTrait(context, TRAIT.LOUD_WHISTLE),
    },
    {
      id: "ranger.loud-whistle-pet",
      target: MODIFIER_TARGET.STRIKE_DAMAGE,
      operation: "multiply",
      factor: 1.15,
      when: (context) =>
        petEvent(context) && hasTrait(context, TRAIT.LOUD_WHISTLE),
    },
    {
      id: "ranger.disabled-skill-bonus",
      target: MODIFIER_TARGET.STRIKE_DAMAGE,
      operation: "multiply",
      factor: 1.2,
      when: (context) =>
        Boolean(
          String(context.event?.damageKind || "").startsWith(
            "ranger-unleashed-disabled",
          ) &&
          (context.config?.target?.defiant ||
            context.config?.target?.disabled ||
            context.config?.target?.defianceBroken),
        ),
    },
    {
      id: "ranger.condition-count-skill-bonus",
      target: MODIFIER_TARGET.STRIKE_DAMAGE,
      operation: "multiply",
      factor: (context) => 1 + targetConditionCount(context) * 0.02,
      when: (context) =>
        context.event?.damageKind ===
        "ranger-unleashed-disabled-condition-count",
    },
  ]);

export function compileRangerModifierRules(rules: readonly Gw2ModifierRule[]) {
  return createModifierHooks({ rules });
}

export const rangerCoreAttributeRules = Object.freeze({
  modifyAttributes: modifyRangerAttributes,
  modifyConditionBaseDuration: modifyRangerConditionBaseDuration,
  modifierRules: rangerCoreModifierRules,
  compileModifierRules: compileRangerModifierRules,
});

export const rangerCoreCastRules = Object.freeze({
  availability: {
    id: "ranger.core-availability",
    order: 10,
    handler: rangerCoreCastAvailability,
  },
  modifyRechargeDuration(
    context: RangerSchedulerContext & { skill?: RangerSkill },
    duration: number,
  ): number {
    const skill = context.skill;
    let result = duration;
    const state = professionCoreState(context);
    if (
      skill?.type === "Weapon" &&
      skill.slot !== "Weapon_1" &&
      state.quickDrawUntil > context.state.time &&
      hasTrait(context as unknown as Gw2ModifierContext, TRAIT.QUICK_DRAW)
    ) {
      result *= 0.34;
    }
    if (
      skill?.weapon === "Axe" &&
      hasTrait(context as unknown as Gw2ModifierContext, TRAIT.HONED_AXES)
    ) {
      result *= 0.8;
    }
    if (
      skill?.weapon === "Shortbow" &&
      hasTrait(
        context as unknown as Gw2ModifierContext,
        TRAIT.LIGHT_ON_YOUR_FEET,
      )
    ) {
      result *= 0.8;
    }
    if (
      skill?.petSkill &&
      !skill.beastmodeSkill &&
      !skill.unleashedPetSkill &&
      hasTrait(context as unknown as Gw2ModifierContext, TRAIT.PACK_ALPHA)
    ) {
      result *= 0.8;
    }
    return result;
  },
});
