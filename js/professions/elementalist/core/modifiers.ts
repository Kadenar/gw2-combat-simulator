import {
  createModifierHooks,
  MODIFIER_TARGET,
} from "../../../platform/gw2/modifier-rules.js";
import { hasTrait } from "../../../platform/gw2/trait-state.js";
import type { SchedulerRecord } from "../../../platform/engine/types.js";
import type {
  Gw2ModifierContext,
  Gw2ModifierRule,
} from "../../../platform/gw2/types.js";
import type { ElementalistAttunement, ElementalistCoreState } from "./state.js";

function coreState(
  context: Gw2ModifierContext,
): Partial<ElementalistCoreState> {
  const profession = context.runtime?.profession as
    | { core?: Partial<ElementalistCoreState> }
    | Partial<ElementalistCoreState>
    | undefined;
  if (!profession) return {};
  return "core" in profession && profession.core ? profession.core : profession;
}

function attunements(context: Gw2ModifierContext): Set<string> {
  const state = coreState(context);
  return new Set(
    [state.primaryAttunement, state.secondaryAttunement].filter(
      (value): value is ElementalistAttunement => value != null,
    ),
  );
}

function primaryAttunement(
  context: Gw2ModifierContext,
): ElementalistAttunement | string {
  return (
    coreState(context).primaryAttunement ||
    String(context.config?.startAttunement || "Fire")
  );
}

function playerEvent(context: Gw2ModifierContext): boolean {
  return context.event?.actorType !== "summon";
}

function eventWeapon(context: Gw2ModifierContext): string {
  return String(context.event?.skillWeapon || context.event?.weapon || "");
}

function targetHas(context: Gw2ModifierContext, condition: string): boolean {
  return Boolean(
    context.query?.targetHasCondition(condition, context.time, context.runtime),
  );
}

function mightStacks(context: Gw2ModifierContext): number {
  return Number(
    context.query?.mightStacksAt(
      context.time,
      context.runtime,
      context.event,
    ) ??
      context.config?.boons?.might ??
      0,
  );
}

function targetHealthFraction(context: Gw2ModifierContext): number {
  const maximum = Number(context.config?.target?.health || 0);
  if (!(maximum > 0)) return 1;
  const totals = (context.runtime?.totals || {}) as {
    readonly strike?: number;
    readonly condition?: number;
  };
  const damage = Number(totals?.strike || 0) + Number(totals?.condition || 0);
  return Math.max(0, 1 - damage / maximum);
}

function timedBuffStacks(
  context: Gw2ModifierContext,
  kind: string,
  maximum = 25,
): number {
  const applications = context.runtime?.boons?.get(kind) || [];
  return Math.min(
    maximum,
    applications
      .filter(
        (application) =>
          application.at <= context.time &&
          application.expiresAt > context.time,
      )
      .reduce((sum, application) => sum + Number(application.stacks || 1), 0),
  );
}

function infernoBurningFactor(context: Gw2ModifierContext): number {
  const stats = context.query?.statsAt(
    context.time,
    context.event,
    context.runtime,
  );
  const power = Number(stats?.power || 0);
  const conditionDamage = Number(stats?.conditionDamage || 0);
  const normalBurningRate = 131 + 0.155 * conditionDamage;
  return normalBurningRate > 0 ? (131 + 0.0825 * power) / normalBurningRate : 1;
}

export const elementalistCoreModifierRules: readonly Gw2ModifierRule[] =
  Object.freeze([
    {
      id: "elementalist.inferno",
      target: MODIFIER_TARGET.CONDITION_DAMAGE,
      operation: "multiply",
      factor: infernoBurningFactor,
      when: (context) =>
        hasTrait(context, "Inferno") && context.condition === "Burning",
    },
    {
      id: "elementalist.bountiful-power",
      target: MODIFIER_TARGET.STRIKE_DAMAGE,
      operation: "damage-additive",
      amount: 0.2,
      when: (context) =>
        hasTrait(context, "Bountiful Power") &&
        timedBuffStacks(context, "bountiful power active", 1) > 0,
    },
    {
      id: "elementalist.tempestuous-aria-strike",
      target: MODIFIER_TARGET.STRIKE_DAMAGE,
      operation: "damage-additive",
      amount: 0.1,
      when: (context) =>
        hasTrait(context, "Tempestuous Aria") &&
        timedBuffStacks(context, "tempestuous aria", 1) > 0,
    },
    {
      id: "elementalist.tempestuous-aria-condition",
      target: MODIFIER_TARGET.CONDITION_DAMAGE,
      operation: "damage-additive",
      amount: 0.05,
      when: (context) =>
        hasTrait(context, "Tempestuous Aria") &&
        timedBuffStacks(context, "tempestuous aria", 1) > 0,
    },
    {
      id: "elementalist.persisting-flames",
      target: MODIFIER_TARGET.STRIKE_DAMAGE,
      operation: "damage-additive",
      amount: (context) =>
        timedBuffStacks(context, "persisting flames", 5) * 0.02,
      when: (context) => hasTrait(context, "Persisting Flames"),
    },
    {
      id: "elementalist.weave-self-air",
      target: MODIFIER_TARGET.STRIKE_DAMAGE,
      operation: "damage-additive",
      amount: 0.1,
      when: (context) => timedBuffStacks(context, "weave self air", 1) > 0,
    },
    {
      id: "elementalist.weave-self-fire",
      target: MODIFIER_TARGET.CONDITION_DAMAGE,
      operation: "damage-additive",
      amount: 0.2,
      when: (context) => timedBuffStacks(context, "weave self fire", 1) > 0,
    },
    {
      id: "elementalist.elements-of-rage-strike",
      target: MODIFIER_TARGET.STRIKE_DAMAGE,
      operation: "damage-additive",
      amount: 0.15,
      when: (context) =>
        hasTrait(context, "Elements of Rage") &&
        timedBuffStacks(context, "elements of rage", 1) > 0,
    },
    {
      id: "elementalist.elements-of-rage-condition",
      target: MODIFIER_TARGET.CONDITION_DAMAGE,
      operation: "damage-additive",
      amount: 0.1,
      when: (context) =>
        hasTrait(context, "Elements of Rage") &&
        timedBuffStacks(context, "elements of rage", 1) > 0,
    },
    {
      id: "elementalist.empowering-auras-strike",
      target: MODIFIER_TARGET.STRIKE_DAMAGE,
      operation: "damage-additive",
      amount: (context) =>
        timedBuffStacks(context, "empowering auras", 5) * 0.01,
      when: (context) => hasTrait(context, "Empowering Auras"),
    },
    {
      id: "elementalist.empowering-auras-condition",
      target: MODIFIER_TARGET.CONDITION_DAMAGE,
      operation: "damage-additive",
      amount: (context) =>
        timedBuffStacks(context, "empowering auras", 5) * 0.01,
      when: (context) => hasTrait(context, "Empowering Auras"),
    },
    {
      id: "elementalist.relentless-fire",
      target: MODIFIER_TARGET.STRIKE_DAMAGE,
      operation: "damage-additive",
      amount: 0.1,
      when: (context) => timedBuffStacks(context, "relentless fire", 1) > 0,
    },
    {
      id: "elementalist.familiars-prowess-strike",
      target: MODIFIER_TARGET.STRIKE_DAMAGE,
      operation: "damage-additive",
      amount: (context) => (hasTrait(context, "Familiar's Focus") ? 0.1 : 0.05),
      when: (context) =>
        context.config?.specialization === "Evoker" &&
        context.config?.evokerElement === "Air" &&
        timedBuffStacks(context, "familiar's-prowess", 1) > 0,
    },
    {
      id: "elementalist.familiars-prowess-condition",
      target: MODIFIER_TARGET.CONDITION_DAMAGE,
      operation: "damage-additive",
      amount: (context) => (hasTrait(context, "Familiar's Focus") ? 0.1 : 0.05),
      when: (context) =>
        context.config?.specialization === "Evoker" &&
        context.config?.evokerElement === "Fire" &&
        timedBuffStacks(context, "familiar's-prowess", 1) > 0,
    },
    {
      id: "elementalist.fiery-might",
      target: MODIFIER_TARGET.STRIKE_DAMAGE,
      operation: "multiply",
      factor: 1.05,
      when: (context) =>
        hasTrait(context, "Fiery Might") && targetHas(context, "Burning"),
    },
    {
      id: "elementalist.pyromancers-training",
      target: MODIFIER_TARGET.STRIKE_DAMAGE,
      operation: "multiply",
      factor: 1.07,
      when: (context) =>
        playerEvent(context) &&
        hasTrait(context, "Pyromancer's Training") &&
        targetHas(context, "Burning"),
    },
    {
      id: "elementalist.serrated-stones",
      target: MODIFIER_TARGET.STRIKE_DAMAGE,
      operation: "multiply",
      factor: 1.05,
      when: (context) =>
        playerEvent(context) &&
        hasTrait(context, "Serrated Stones") &&
        targetHas(context, "Bleeding"),
    },
    {
      id: "elementalist.stormsoul",
      target: MODIFIER_TARGET.STRIKE_DAMAGE,
      operation: "multiply",
      factor: 1.07,
      when: (context) => playerEvent(context) && hasTrait(context, "Stormsoul"),
    },
    {
      id: "elementalist.flow-like-water",
      target: MODIFIER_TARGET.STRIKE_DAMAGE,
      operation: "multiply",
      factor: 1.1,
      when: (context) =>
        playerEvent(context) && hasTrait(context, "Flow like Water"),
    },
    {
      id: "elementalist.bolt-to-the-heart",
      target: MODIFIER_TARGET.STRIKE_DAMAGE,
      operation: "multiply",
      factor: 1.2,
      when: (context) =>
        playerEvent(context) &&
        hasTrait(context, "Bolt to the Heart") &&
        targetHealthFraction(context) <= 0.5,
    },
    {
      id: "elementalist.piercing-shards",
      target: MODIFIER_TARGET.STRIKE_DAMAGE,
      operation: "multiply",
      factor: (context) =>
        primaryAttunement(context) === "Water" ? 1.14 : 1.07,
      when: (context) =>
        playerEvent(context) &&
        hasTrait(context, "Piercing Shards") &&
        targetHas(context, "Vulnerability"),
    },
    {
      id: "elementalist.zephyrs-speed-critical-chance",
      target: MODIFIER_TARGET.CRITICAL_CHANCE,
      operation: "add",
      amount: 0.05,
      when: (context) =>
        playerEvent(context) && hasTrait(context, "Zephyr's Speed"),
    },
    {
      id: "elementalist.superior-elements",
      target: MODIFIER_TARGET.CRITICAL_CHANCE,
      operation: "add",
      amount: 0.2,
      when: (context) =>
        playerEvent(context) &&
        hasTrait(context, "Superior Elements") &&
        targetHas(context, "Weakness"),
    },
    {
      id: "elementalist.electric-discharge-critical-damage",
      target: MODIFIER_TARGET.CRITICAL_DAMAGE,
      operation: "multiply",
      factor: 2,
      when: (context) =>
        String(context.event?.skillName || context.event?.name || "") ===
        "Electric Discharge",
    },
    {
      id: "elementalist.enhanced-potency-air",
      target: MODIFIER_TARGET.CRITICAL_CHANCE,
      operation: "add",
      amount: 0.15,
      when: (context) =>
        context.config?.specialization === "Evoker" &&
        context.config?.evokerElement === "Air" &&
        hasTrait(context, "Enhanced Potency") &&
        Boolean(
          context.query?.furyActiveAt(
            context.time,
            context.runtime,
            context.event,
          ),
        ),
    },
    {
      id: "elementalist.transcendent-tempest-strike",
      target: MODIFIER_TARGET.STRIKE_DAMAGE,
      operation: "damage-additive",
      amount: 0.25,
      when: (context) =>
        hasTrait(context, "Transcendent Tempest") &&
        timedBuffStacks(context, "transcendent-tempest", 1) > 0,
    },
    {
      id: "elementalist.transcendent-tempest-condition",
      target: MODIFIER_TARGET.CONDITION_DAMAGE,
      operation: "damage-additive",
      amount: 0.2,
      when: (context) =>
        hasTrait(context, "Transcendent Tempest") &&
        timedBuffStacks(context, "transcendent-tempest", 1) > 0,
    },
    {
      id: "elementalist.hammer-fire-orb",
      target: [MODIFIER_TARGET.STRIKE_DAMAGE, MODIFIER_TARGET.CONDITION_DAMAGE],
      operation: "damage-additive",
      amount: 0.05,
      when: (context) => timedBuffStacks(context, "hammer fire orb", 1) > 0,
    },
    {
      id: "elementalist.hammer-air-orb",
      target: MODIFIER_TARGET.CRITICAL_CHANCE,
      operation: "add",
      amount: 0.15,
      when: (context) => timedBuffStacks(context, "hammer air orb", 1) > 0,
    },
    {
      id: "elementalist.frost-bow-condition-duration",
      target: MODIFIER_TARGET.CONDITION_DURATION,
      operation: "multiply",
      factor: 1.2,
      when: (context) => eventWeapon(context) === "Frost Bow",
    },
    {
      id: "elementalist.zap",
      target: MODIFIER_TARGET.STRIKE_DAMAGE,
      operation: "multiply",
      factor: 1.03,
      when: (context) =>
        context.config?.specialization === "Evoker" &&
        context.config?.evokerElement === "Air" &&
        timedBuffStacks(context, "zap buff", 1) > 0,
    },
  ]);

export function compileElementalistModifierRules(
  rules: readonly Gw2ModifierRule[],
) {
  return createModifierHooks({ rules });
}

export function modifyElementalistAttributes(
  context: Gw2ModifierContext,
  attributes: SchedulerRecord,
): SchedulerRecord {
  const modified = { ...attributes };
  const active = attunements(context);
  const primary = primaryAttunement(context);
  if (hasTrait(context, "Empowering Flame") && primary === "Fire") {
    modified.power = Number(modified.power || 0) + 150;
  }
  if (hasTrait(context, "Power Overwhelming") && mightStacks(context) >= 10) {
    modified.power =
      Number(modified.power || 0) + (primary === "Fire" ? 300 : 150);
  }
  if (hasTrait(context, "Elemental Polyphony")) {
    if (active.has("Fire")) {
      modified.power = Number(modified.power || 0) + 200;
    }
    if (active.has("Air")) {
      modified.ferocity = Number(modified.ferocity || 0) + 200;
    }
  }
  if (
    hasTrait(context, "Fresh Air") &&
    timedBuffStacks(context, "fresh air", 1) > 0
  ) {
    modified.ferocity = Number(modified.ferocity || 0) + 250;
  }
  if (hasTrait(context, "Aeromancer's Training") && primary === "Air") {
    modified.ferocity = Number(modified.ferocity || 0) + 150;
  }
  if (
    hasTrait(context, "Raging Storm") &&
    Boolean(
      context.query?.furyActiveAt(context.time, context.runtime, context.event),
    )
  ) {
    modified.ferocity = Number(modified.ferocity || 0) + 180;
  }
  if (
    hasTrait(context, "Arcane Lightning") &&
    timedBuffStacks(context, "arcane lightning", 1) > 0
  ) {
    modified.ferocity = Number(modified.ferocity || 0) + 150;
  }
  if (
    context.config?.specialization === "Evoker" &&
    context.config?.evokerElement === "Air" &&
    Boolean(
      context.query?.furyActiveAt(context.time, context.runtime, context.event),
    )
  ) {
    modified.ferocity = Number(modified.ferocity || 0) + 75;
  }
  const weapon = eventWeapon(context);
  if (weapon === "Fiery Greatsword") {
    modified.power = Number(modified.power || 0) + 260;
    modified.conditionDamage = Number(modified.conditionDamage || 0) + 180;
  } else if (weapon === "Lightning Hammer") {
    modified.precision = Number(modified.precision || 0) + 180;
    modified.ferocity = Number(modified.ferocity || 0) + 75;
  }
  if (
    Number(coreState(context).signetOfFireDisabledUntil || 0) > context.time
  ) {
    modified.precision = Number(modified.precision || 0) - 180;
  }
  if (
    context.config?.specialization === "Evoker" &&
    context.config?.evokerElement === "Fire" &&
    hasTrait(context, "Enhanced Potency")
  ) {
    modified.conditionDamage =
      Number(modified.conditionDamage || 0) + mightStacks(context) * 5;
  }
  return modified;
}

export const elementalistCoreAttributeRules = Object.freeze({
  modifyAttributes: modifyElementalistAttributes,
  modifierRules: elementalistCoreModifierRules,
  compileModifierRules: compileElementalistModifierRules,
});
