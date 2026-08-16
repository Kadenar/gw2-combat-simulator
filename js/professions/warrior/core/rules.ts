import { professionStaticRulesApplied } from "../../../platform/gw2/attribute-provenance.js";
import {
  createModifierHooks,
  MODIFIER_TARGET,
} from "../../../platform/gw2/modifier-rules.js";
import { hasTrait } from "../../../platform/gw2/trait-state.js";
import { targetHasCondition } from "../../../platform/gw2/target-state.js";
import {
  WARRIOR_SKILL_IDS as ID,
  WARRIOR_TRAIT_IDS as TRAIT,
} from "../data/ids.js";
import { warriorCastAvailability } from "./availability.js";
import {
  advanceWarriorTraits,
  beginWarriorSkill,
  completeWarriorSkill,
  handleWarriorArmsCriticalTask,
  initializeWarriorTraits,
  observeWarriorEvent,
  updateWarriorCastState,
} from "./traits.js";
import {
  advanceWarriorResources,
  handleWarriorAdrenalineTask,
} from "./resources.js";
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

export { snapshotWarriorState } from "./state.js";

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

const BREACHING_STRIKE_IDS = new Set<number>([
  ID.BREACHING_STRIKE,
  ID.BREACHING_STRIKE_ID_69297,
  ID.BREACHING_STRIKE_ID_69433,
]);

function boonActive(context: Gw2ModifierContext, boon: string): boolean {
  if (context.config?.boons?.[boon]) return true;
  return (context.runtime?.boons?.get(boon) || []).some(
    (application) =>
      application.affectsSelf !== false &&
      application.at <= context.time &&
      application.expiresAt > context.time,
  );
}

function activeBuffStacks(
  context: Gw2ModifierContext,
  kind: string,
  maximum: number,
): number {
  const stacks = (context.runtime?.boons?.get(kind) || [])
    .filter(
      (application) =>
        application.affectsSelf !== false &&
        application.at <= context.time &&
        application.expiresAt > context.time,
    )
    .reduce((total, application) => total + application.stacks, 0);
  return Math.min(maximum, stacks);
}

const WARRIOR_BOONS = Object.freeze([
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

function activeBoonCount(context: Gw2ModifierContext): number {
  return WARRIOR_BOONS.filter((boon) => boonActive(context, boon)).length;
}

function targetBoonCount(context: Gw2ModifierContext): number {
  const target = context.config?.target;
  if (target?.boonless === true) return 0;
  if (Array.isArray(target?.boons)) {
    return new Set(target.boons.map(String)).size;
  }
  if (target?.boonCount != null) {
    return Math.max(0, Math.trunc(Number(target.boonCount) || 0));
  }
  return target?.boonless === false ? 1 : 0;
}

function wieldingWeapon(context: Gw2ModifierContext, weapon: string): boolean {
  if (eventSkill(context)?.weapon === weapon) return true;
  const weaponSet = Number(context.runtime?.activeWeaponSet) === 2 ? 2 : 1;
  const primary = String(
    weaponSet === 1
      ? context.config?.primaryWeapon || ""
      : context.config?.weaponSet2Primary || "",
  );
  const secondary = String(
    weaponSet === 1
      ? context.config?.secondaryWeapon || ""
      : context.config?.weaponSet2Secondary || "",
  );
  return primary === weapon || secondary === weapon;
}

function selectedSkill(context: Gw2ModifierContext, name: string): boolean {
  const source = context.config?.selectedSkills || [];
  const selected = Array.isArray(source) ? source : Object.values(source);
  return selected.map(String).includes(name);
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
    expertise: number;
    vitality: number;
    healingPower: number;
    concentration: number;
  };
  const staticRulesApplied = professionStaticRulesApplied(context.config);
  const signetStacks = activeBuffStacks(context, "signet-mastery", 5);
  result.power = Number(result.power || 0);
  result.precision = Number(result.precision || 0);
  result.ferocity = Number(result.ferocity || 0);
  result.conditionDamage = Number(result.conditionDamage || 0);
  result.expertise = Number(result.expertise || 0);
  result.vitality = Number(result.vitality || 0);
  result.healingPower = Number(result.healingPower || 0);
  result.concentration = Number(result.concentration || 0);
  // Pattern C: attribute conversions read the gear-only pool. config.stats
  // holds pre-boon gear attributes (might is baked into the seed's power, and
  // live trait bonuses accrue on `result`), so this converts gear power only.
  const gearPower = Number(context.config?.stats?.power || 0);
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
  if (hasTrait(context, TRAIT.FORCEFUL_GREATSWORD) && !staticRulesApplied) {
    result.power += wieldingWeapon(context, "Greatsword") ? 240 : 120;
  }
  if (hasTrait(context, TRAIT.ROARING_REVEILLE) && !staticRulesApplied) {
    result.concentration += 120;
  }
  if (hasTrait(context, TRAIT.SIGNET_MASTERY))
    result.ferocity += signetStacks * 100;
  if (hasTrait(context, TRAIT.GREAT_FORTITUDE) && !staticRulesApplied) {
    // Static path bakes this from conversionPool in build-attributes; add no
    // dynamic delta so might/signets never leak into the conversion.
    result.vitality += gearPower * 0.1;
    result.ferocity += gearPower * 0.1;
  }
  if (hasTrait(context, TRAIT.VIGOROUS_SHOUTS) && !staticRulesApplied) {
    result.healingPower += gearPower * 0.13;
  }
  if (
    hasTrait(context, TRAIT.DEEP_STRIKES) &&
    boonActive(context, "fury") &&
    !(staticRulesApplied && Boolean(context.config?.boons?.fury))
  ) {
    result.conditionDamage += 180;
  }
  if (
    hasTrait(context, TRAIT.BLADEMASTER) &&
    wieldingWeapon(context, "Sword")
  ) {
    result.conditionDamage += 120;
  }
  result.conditionDamage += activeBuffStacks(context, "furious-surge", 25) * 15;
  if (
    hasTrait(context, TRAIT.BURST_PRECISION) &&
    activeBuffStacks(context, "burst-precision", 1) > 0
  ) {
    result.ferocity += 250;
  }
  if (activeBuffStacks(context, "signet-of-fury-active", 1) > 0) {
    result.precision += 360;
    result.ferocity += 360;
  }
  for (const [name, id, attribute] of [
    ["Signet of Might", ID.SIGNET_OF_MIGHT, "power"],
    ["Signet of Fury", ID.SIGNET_OF_FURY, "precision"],
  ] as const) {
    if (!selectedSkill(context, name)) continue;
    const onCooldown = Boolean(
      context.timeline?.skillOnCooldownAt(id, context.time),
    );
    if (staticRulesApplied ? onCooldown : !onCooldown) {
      const delta = staticRulesApplied ? -180 : 180;
      // Signet power/precision toggles are real stat changes, but they are not
      // part of the gear pool, so they no longer feed Great Fortitude /
      // Wounding Precision conversions (Pattern C).
      result[attribute] += delta;
    }
  }
  return result;
}

const warriorModifierRules: readonly Gw2ModifierRule[] = Object.freeze([
  {
    id: "warrior.throw-axe-health-threshold",
    target: MODIFIER_TARGET.STRIKE_DAMAGE,
    operation: "multiply",
    factor: (context) =>
      targetHealthFraction(context) <= 0.25
        ? 2
        : targetHealthFraction(context) <= 0.5
          ? 1.5
          : 1,
    order: 100,
    when: (context) => eventSkill(context)?.id === ID.THROW_AXE,
  },
  {
    id: "warrior.pinnacle-critical-chance",
    target: MODIFIER_TARGET.CRITICAL_CHANCE,
    operation: "add",
    amount: 0.05,
    when: (context) => hasTrait(context, TRAIT.PINNACLE_OF_STRENGTH),
  },
  {
    id: "warrior.berserkers-power",
    target: MODIFIER_TARGET.STRIKE_DAMAGE,
    operation: "damage-additive",
    amount: (context) =>
      (context.timeline?.buffStacksAt("berserkers-power", context.time, 0, 4) ??
        activeBuffStacks(context, "berserkers-power", 4)) * 0.0375,
    when: (context) => hasTrait(context, TRAIT.BERSERKERS_POWER),
  },
  {
    id: "warrior.peak-performance",
    target: MODIFIER_TARGET.STRIKE_DAMAGE,
    operation: "damage-additive",
    amount: (context) =>
      0.05 + (activeBuffStacks(context, "peak-performance", 1) ? 0.1 : 0),
    when: (context) => hasTrait(context, TRAIT.PEAK_PERFORMANCE),
  },
  {
    id: "warrior.empowered",
    target: MODIFIER_TARGET.STRIKE_DAMAGE,
    operation: "multiply",
    factor: (context) => 1 + activeBoonCount(context) * 0.01,
    order: 100,
    when: (context) => hasTrait(context, TRAIT.EMPOWERED),
  },
  {
    id: "warrior.leg-specialist",
    target: MODIFIER_TARGET.STRIKE_DAMAGE,
    operation: "multiply",
    factor: 1.05,
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
    factor: 1.25,
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
    factor: 1.25,
    order: 100,
    when: (context) =>
      hasTrait(context, TRAIT.MERCILESS_HAMMER) &&
      ["Hammer", "Mace"].includes(
        String(
          context.event?.skillWeapon ||
            eventSkill(context)?.skillWeapon ||
            eventSkill(context)?.weapon ||
            "",
        ),
      ) &&
      targetControlled(context),
  },
  {
    id: "warrior.stalwart-strength",
    target: MODIFIER_TARGET.STRIKE_DAMAGE,
    operation: "multiply",
    factor: 1.1,
    order: 100,
    when: (context) =>
      hasTrait(context, TRAIT.STALWART_STRENGTH) &&
      boonActive(context, "stability"),
  },
  {
    id: "warrior.furious-burst-fury-critical-chance",
    target: MODIFIER_TARGET.CRITICAL_CHANCE,
    operation: "add",
    amount: 0.05,
    when: (context) =>
      hasTrait(context, TRAIT.FURIOUS_BURST) && boonActive(context, "fury"),
  },
  {
    id: "warrior.deep-strikes",
    target: MODIFIER_TARGET.CRITICAL_CHANCE,
    operation: "add",
    amount: 0.05,
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
    amount: 0.25,
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
      (Boolean(eventSkill(context)?.burst) ||
        activeBuffStacks(context, "burst-precision", 1) > 0),
  },
  {
    id: "warrior.dagger-auto-critical-damage",
    target: MODIFIER_TARGET.CRITICAL_DAMAGE,
    operation: "multiply",
    factor: 1.15,
    order: 100,
    when: (context) => {
      const skillId = Number(eventSkill(context)?.id);
      return skillId === ID.PRECISE_CUT || skillId === ID.FOCUSED_SLASH;
    },
  },
  {
    id: "warrior.wastrels-ruin-defiant",
    target: MODIFIER_TARGET.STRIKE_DAMAGE,
    operation: "multiply",
    factor: 2,
    order: 100,
    when: (context) =>
      eventSkill(context)?.id === ID.WASTRELS_RUIN &&
      context.config?.target?.defiant === true,
  },
  {
    id: "warrior.breaching-strike-boonless",
    target: MODIFIER_TARGET.STRIKE_DAMAGE,
    operation: "multiply",
    factor: 1.5,
    order: 100,
    when: (context) =>
      BREACHING_STRIKE_IDS.has(Number(eventSkill(context)?.id)) &&
      context.config?.target?.boonless === true,
  },
  {
    id: "warrior.slicing-maelstrom-boonless",
    target: MODIFIER_TARGET.STRIKE_DAMAGE,
    operation: "multiply",
    factor: 1.5,
    order: 100,
    when: (context) =>
      eventSkill(context)?.id === ID.SLICING_MAELSTROM &&
      context.config?.target?.boonless === true,
  },
  {
    id: "warrior.warriors-sprint",
    target: MODIFIER_TARGET.STRIKE_DAMAGE,
    operation: "damage-additive",
    amount: 0.1,
    when: (context) =>
      hasTrait(context, TRAIT.WARRIORS_SPRINT) &&
      boonActive(context, "swiftness"),
  },
  {
    id: "warrior.destruction-of-the-empowered",
    target: MODIFIER_TARGET.STRIKE_DAMAGE,
    operation: "multiply",
    factor: (context) => 1 + targetBoonCount(context) * 0.03,
    order: 100,
    when: (context) =>
      hasTrait(context, TRAIT.DESTRUCTION_OF_THE_EMPOWERED) &&
      targetBoonCount(context) > 0,
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
  if (skill?.id === ID.SWAP_WEAPONS) return duration > 0 ? 5 : 0;
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

const DUAL_WIELD_OFFHANDS = new Set(["Axe", "Dagger", "Mace", "Sword"]);
const DUAL_WIELDING_EXCLUDED_SKILL_IDS = new Set<number>([
  ID.AURA_SLICER,
  ID.KICK,
  ID.BULLS_CHARGE,
  ...BREACHING_STRIKE_IDS,
]);
/** GW2 completes cast durations on 40 ms action-tick boundaries. */
const ACTION_TICK_MS = 40;

// Dual Wielding increases attack speed by 25%, so cast duration is divided by
// 1.25. The tick snap must happen once, on the final duration: the game applies
// every attack-speed modifier (Quickness included) and only then rounds to the
// nearest action tick. Rounding the Quickness duration first — as the shared
// scheduler does — then dividing here would double-round and run long.
function roundToActionTick(durationSeconds: number): number {
  return (
    (Math.round((durationSeconds * 1000) / ACTION_TICK_MS) * ACTION_TICK_MS) /
    1000
  );
}

function modifyCastDuration(
  context: WarriorCastContext,
  duration: number,
): number {
  const skill = context.skill;
  const offhand = String(
    context.state.activeWeaponSet === 2
      ? context.config.weaponSet2Secondary || ""
      : context.config.secondaryWeapon || "",
  );
  const measured = Number(skill.dualWieldCastTimeMs || 0);
  const dualWielding =
    hasTrait(context, TRAIT.DUAL_WIELDING) &&
    DUAL_WIELD_OFFHANDS.has(offhand) &&
    !DUAL_WIELDING_EXCLUDED_SKILL_IDS.has(Number(skill.id)) &&
    (skill.type === "Weapon" ||
      skill.type === "Utility" ||
      Boolean(skill.weapon) ||
      Boolean(skill.burst) ||
      measured > 0);
  if (!dualWielding) return duration;
  // A measured Dual Wielding cast (captured under Quickness) is used verbatim;
  // the 1.25 divide is only a fallback for skills without a measured value.
  if (measured > 0 && context.hasBuff("quickness", context.start)) {
    return measured / 1000;
  }
  return roundToActionTick(duration / 1.25);
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
  modifyCastDuration,
  modifyRechargeDuration,
});

export const warriorCoreSchedulerHooks = Object.freeze({
  initialize: initializeWarriorTraits,
  onCastStart: beginWarriorSkill,
  advance: {
    id: "warrior.core-resources-and-traits",
    order: 10,
    handler: (context: WarriorSchedulerContext, target: number) => {
      advanceWarriorResources(context, target);
      advanceWarriorTraits(context, target);
    },
  },
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
  onCastComplete: {
    id: "warrior.core-skill-completion",
    order: 10,
    handler: completeWarriorSkill,
  },
  taskHandlers: Object.freeze({
    "warrior.adrenaline-hit": handleWarriorAdrenalineTask,
    "warrior.arms-critical": handleWarriorArmsCriticalTask,
  }),
});
