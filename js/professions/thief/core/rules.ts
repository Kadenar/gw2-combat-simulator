import { professionCoreState } from "../../../platform/engine/profession.js";
import {
  CANONICAL_TARGET_CONDITIONS,
  canonicalTargetConditionName,
} from "../../../platform/gw2/target-state.js";
import {
  createModifierHooks,
  MODIFIER_TARGET,
} from "../../../platform/gw2/modifier-rules.js";
import { professionStaticRulesApplied } from "../../../platform/gw2/attribute-provenance.js";
import { hasTrait } from "../../../platform/gw2/trait-state.js";
import {
  THIEF_SKILL_IDS as ID,
  THIEF_TRAIT_IDS as TRAIT,
} from "../data/ids.js";
import { thiefCoreCastAvailability } from "./availability.js";
import {
  advanceThiefCoreResources,
  completeThiefCoreResources,
  spendThiefCoreResources,
} from "./resources.js";
import { hasThiefTrait, snapshotThiefState } from "./state.js";
import { updateThiefTraitCastState } from "./traits.js";
import { updateThiefWeaponState } from "./weapon-state.js";
import { thiefCoreTaskHandlers } from "./tasks.js";
import type { Skill, SkillId } from "../../../platform/engine/types.js";
import type {
  Gw2ModifierContext,
  Gw2ModifierHooks,
  Gw2ModifierRule,
  Gw2ResolvedStats,
} from "../../../platform/gw2/types.js";
import type {
  AntiquaryState,
  DaredevilState,
  DeadeyeState,
  SpecterState,
  ThiefCoreState,
  ThiefPrecastContext,
  ThiefQueryRuntime,
  ThiefSchedulerContext,
} from "../types.js";
import {
  thiefBalanceProfile,
  THIEF_CORE_BALANCE_PROFILE_IDS as PROFILE,
} from "./profiles.js";

export function thiefEventSkill(
  context: Gw2ModifierContext,
): Skill | undefined {
  const source = context as Gw2ModifierContext & {
    readonly profession?: {
      readonly catalog?: { readonly skillsById?: ReadonlyMap<SkillId, Skill> };
    };
    readonly skillId?: SkillId;
  };
  const skillId = context.event?.skillId ?? source.skillId;
  return skillId == null
    ? undefined
    : source.profession?.catalog?.skillsById?.get(skillId);
}

export function thiefPlayerEvent(context: Gw2ModifierContext): boolean {
  return context.event?.actorType !== "summon";
}

export function thiefRuntimeState(
  context: Gw2ModifierContext,
): Partial<ThiefCoreState> {
  const state = (context.runtime as ThiefQueryRuntime | undefined)?.profession;
  if (!state) return {};
  return "core" in state && state.core
    ? state.core
    : (state as Partial<ThiefCoreState>);
}

interface ThiefSpecializationStateMap {
  Antiquary: AntiquaryState;
  Daredevil: DaredevilState;
  Deadeye: DeadeyeState;
  Specter: SpecterState;
}

export function thiefRuntimeSpecializationState<
  TKind extends keyof ThiefSpecializationStateMap,
>(
  context: Gw2ModifierContext,
  expectedKind: TKind,
): Partial<ThiefSpecializationStateMap[TKind]> {
  const state =
    (context.runtime as ThiefQueryRuntime | undefined)?.profession || {};
  if (
    "specialization" in state &&
    state.specialization &&
    typeof state.specialization === "object" &&
    state.specialization.state
  ) {
    if (state.specialization.kind !== expectedKind) {
      throw new TypeError(
        `Expected active specialization ${expectedKind}, received ${
          state.specialization.kind
        }.`,
      );
    }
    return state.specialization.state as unknown as Partial<
      ThiefSpecializationStateMap[TKind]
    >;
  }
  return state as Partial<ThiefSpecializationStateMap[TKind]>;
}

export function thiefTargetHealthFraction(context: Gw2ModifierContext): number {
  const maximum = Number(context.config?.target?.health || 0);
  if (!(maximum > 0)) return 1;
  const totals = (context.runtime as ThiefQueryRuntime | undefined)?.totals;
  const damage = Number(totals?.strike || 0) + Number(totals?.condition || 0);
  return Math.max(0, 1 - damage / maximum);
}

export function thiefTargetHasCondition(
  context: Gw2ModifierContext,
  condition: string,
): boolean {
  return Boolean(
    context.query?.targetHasCondition(condition, context.time, context.runtime),
  );
}

function targetConditionCount(context: Gw2ModifierContext): number {
  const names = new Set([
    ...CANONICAL_TARGET_CONDITIONS,
    ...Object.keys(context.config?.target?.conditions || {}).map(
      canonicalTargetConditionName,
    ),
    ...[...(context.runtime?.conditionState?.keys?.() || [])].map(
      canonicalTargetConditionName,
    ),
  ]);
  return [...names].filter((condition) =>
    thiefTargetHasCondition(context, condition),
  ).length;
}

function targetBoonless(context: Gw2ModifierContext): boolean {
  return context.config?.target?.boonless !== false;
}

function selectedSkill(context: Gw2ModifierContext, name: string): boolean {
  const source = context.config?.selectedSkills || [];
  const selected = Array.isArray(source) ? source : Object.values(source);
  return selected.some(
    (value) => (typeof value === "string" ? value : value?.name) === name,
  );
}

export const thiefCoreModifierRules: readonly Gw2ModifierRule[] = Object.freeze(
  [
    {
      id: "thief.exposed-weakness",
      target: MODIFIER_TARGET.STRIKE_DAMAGE,
      operation: "multiply",
      parameters: {
        damagePerCondition: 0.02,
      } as Readonly<Record<string, number>>,
      factor: (context, _target, parameters) =>
        1 + targetConditionCount(context) * parameters.damagePerCondition,
      when: (context) =>
        thiefPlayerEvent(context) && hasTrait(context, TRAIT.EXPOSED_WEAKNESS),
    },
    {
      id: "thief.vampiric-slash-vulnerable",
      target: MODIFIER_TARGET.STRIKE_DAMAGE,
      operation: "multiply",
      factor: 1.5,
      when: (context) =>
        thiefPlayerEvent(context) &&
        context.event?.name === "Vampiric Slash — Life Siphon" &&
        thiefTargetHasCondition(context, "Vulnerability"),
    },
    {
      id: "thief.executioner",
      target: MODIFIER_TARGET.STRIKE_DAMAGE,
      operation: "multiply",
      factor: 1.2,
      when: (context) =>
        thiefPlayerEvent(context) &&
        hasTrait(context, TRAIT.EXECUTIONER) &&
        thiefTargetHealthFraction(context) < 0.5,
    },
    {
      id: "thief.ferocious-strikes",
      target: MODIFIER_TARGET.CRITICAL_DAMAGE,
      operation: "multiply",
      factor: 1.1,
      when: (context) =>
        thiefPlayerEvent(context) &&
        hasTrait(context, TRAIT.FEROCIOUS_STRIKES) &&
        thiefTargetHealthFraction(context) > 0.5,
    },
    {
      id: "thief.twin-fangs-critical-damage",
      target: MODIFIER_TARGET.CRITICAL_DAMAGE,
      operation: "multiply",
      factor: 1.07,
      when: (context) =>
        thiefPlayerEvent(context) && hasTrait(context, TRAIT.TWIN_FANGS),
    },
    {
      id: "thief.twin-fangs-critical-chance",
      target: MODIFIER_TARGET.CRITICAL_CHANCE,
      operation: "add",
      amount: 0.07,
      when: (context) =>
        thiefPlayerEvent(context) &&
        hasTrait(context, TRAIT.TWIN_FANGS) &&
        Boolean(context.config?.target?.defiant),
    },
    {
      id: "thief.deadly-aim",
      target: MODIFIER_TARGET.STRIKE_DAMAGE,
      operation: "multiply",
      factor: 1.1,
      when: (context) =>
        thiefPlayerEvent(context) &&
        hasTrait(context, TRAIT.DEADLY_AIM) &&
        thiefEventSkill(context)?.weapon === "Pistol",
    },
    {
      id: "thief.larcenous-strike-boonless",
      target: MODIFIER_TARGET.STRIKE_DAMAGE,
      operation: "multiply",
      factor: 1.2,
      when: (context) =>
        thiefPlayerEvent(context) &&
        thiefEventSkill(context)?.name === "Larcenous Strike" &&
        targetBoonless(context),
    },
    {
      id: "thief.lead-attacks",
      target: [MODIFIER_TARGET.STRIKE_DAMAGE, MODIFIER_TARGET.CONDITION_DAMAGE],
      operation: "damage-additive",
      parameters: {
        maximumStacks: 15,
        damagePerStack: 0.01,
      } as Readonly<Record<string, number>>,
      amount: (context, _target, parameters) =>
        Math.min(
          parameters.maximumStacks,
          Number(thiefRuntimeState(context).leadAttacksStacks || 0),
        ) * parameters.damagePerStack,
      when: (context) =>
        thiefPlayerEvent(context) && hasTrait(context, TRAIT.LEAD_ATTACKS),
    },
    {
      id: "thief.fluid-strikes",
      target: MODIFIER_TARGET.STRIKE_DAMAGE,
      operation: "damage-additive",
      amount: 0.1,
      when: (context) =>
        thiefPlayerEvent(context) &&
        hasTrait(context, TRAIT.FLUID_STRIKES) &&
        Number(thiefRuntimeState(context).fluidStrikesUntil || 0) >
          context.time,
    },
    {
      id: "thief.distracting-throw-finisher",
      target: [MODIFIER_TARGET.STRIKE_DAMAGE, MODIFIER_TARGET.CONDITION_DAMAGE],
      operation: "damage-additive",
      amount: 0.1,
      when: (context) =>
        thiefPlayerEvent(context) &&
        Number(thiefRuntimeState(context).distractingThrowBuffUntil || 0) >
          context.time,
    },
    {
      id: "thief.backstab-position",
      target: MODIFIER_TARGET.STRIKE_DAMAGE,
      operation: "multiply",
      factor: 2,
      when: (context) =>
        thiefPlayerEvent(context) &&
        ["Backstab", "Malicious Backstab"].includes(
          thiefEventSkill(context)?.name || "",
        ) &&
        Boolean(
          context.config?.target?.behind || context.config?.target?.defiant,
        ),
    },
    {
      id: "thief.potent-poison-damage",
      target: MODIFIER_TARGET.CONDITION_DAMAGE,
      operation: "multiply",
      factor: 1.33,
      when: (context) =>
        thiefPlayerEvent(context) &&
        context.event?.condition === "Poisoned" &&
        hasTrait(context, TRAIT.POTENT_POISON),
    },
    {
      id: "thief.deadly-ambush-bleeding",
      target: MODIFIER_TARGET.CONDITION_DAMAGE,
      operation: "multiply",
      factor: 1.25,
      when: (context) =>
        thiefPlayerEvent(context) &&
        context.event?.condition === "Bleeding" &&
        hasTrait(context, TRAIT.DEADLY_AMBUSH),
    },
    {
      id: "thief.potent-poison-duration",
      target: MODIFIER_TARGET.CONDITION_DURATION,
      operation: "multiply",
      factor: 1.33,
      when: (context) =>
        context.event?.condition === "Poisoned" &&
        hasTrait(context, TRAIT.POTENT_POISON),
    },
    {
      id: "thief.keen-observer",
      target: MODIFIER_TARGET.CRITICAL_CHANCE,
      operation: "add",
      amount: 0.15,
      when: (context) =>
        thiefPlayerEvent(context) && hasTrait(context, TRAIT.KEEN_OBSERVER),
    },
    {
      id: "thief.hidden-killer",
      target: MODIFIER_TARGET.CRITICAL_CHANCE,
      operation: "add",
      amount: 1,
      when: (context) => {
        const state = thiefRuntimeState(context);
        return (
          thiefPlayerEvent(context) &&
          hasTrait(context, TRAIT.HIDDEN_KILLER) &&
          (Number(state.stealthUntil || 0) > context.time ||
            Number(state.revealedUntil || 0) + 1 > context.time)
        );
      },
    },
  ],
);

function modifyThiefCoreAttributes(
  context: Gw2ModifierContext,
  attributes: Gw2ResolvedStats,
): Gw2ResolvedStats {
  const result = { ...attributes };
  const state = thiefRuntimeState(context);
  const staticRulesApplied = professionStaticRulesApplied(context.config);
  if (selectedSkill(context, "Assassin's Signet")) {
    const profile = thiefBalanceProfile(context, PROFILE.assassinsSignet);
    const passive = Number(profile?.attributeBonus || 180);
    const passiveDisabled =
      Number(state.assassinsSignetPassiveDisabledUntil || 0) > context.time;
    if (staticRulesApplied && passiveDisabled) result.power -= passive;
    if (!staticRulesApplied && !passiveDisabled) result.power += passive;
    if (Number(state.assassinsSignetActiveUntil || 0) > context.time) {
      result.power += Number(profile?.attributePerStack || 540);
    }
  }
  if (hasTrait(context, TRAIT.REVEALED_TRAINING)) {
    const profile = thiefBalanceProfile(context, PROFILE.revealedTraining);
    if (!staticRulesApplied) {
      result.power += Number(profile?.attributeBonus || 80);
    }
    if (
      Number(state.revealedUntil || 0) > context.time &&
      !thiefEventSkill(context)?.stealthAttack
    ) {
      result.power += Number(profile?.attributePerStack || 120);
    }
  }
  if (
    hasTrait(context, TRAIT.NO_QUARTER) &&
    context.query?.furyActiveAt(context.time, context.runtime, context.event) &&
    !(
      staticRulesApplied &&
      Boolean((context.config?.boons as Record<string, unknown>)?.fury)
    )
  ) {
    result.ferocity += Number(
      thiefBalanceProfile(context, PROFILE.noQuarter)?.attributeBonus || 250,
    );
  }
  return result;
}

export function compileThiefModifierRules(
  rules: readonly Gw2ModifierRule[],
): Gw2ModifierHooks {
  return createModifierHooks({ rules });
}

export const thiefCoreAttributeRules = Object.freeze({
  modifyAttributes: modifyThiefCoreAttributes,
  modifierRules: thiefCoreModifierRules,
  compileModifierRules: compileThiefModifierRules,
});

function modifyThiefCoreRechargeDuration(
  context: ThiefPrecastContext,
  duration: number,
): number {
  const skill = context.skill;
  const state = professionCoreState(context);
  const readyAt = Number(context.state.cooldowns.get(skill.id) || 0);
  if (
    skill.usableWhileRecharging === true &&
    readyAt > context.start + Number(context.epsilon || 0.0001)
  ) {
    return 0;
  }
  let result = duration;
  if (skill.id === state.professionSkillId) {
    const leadAttacks = hasThiefTrait(context.config, TRAIT.LEAD_ATTACKS);
    const sleightOfHand = hasThiefTrait(context.config, TRAIT.SLEIGHT_OF_HAND);
    const leadReduction = Number(
      thiefBalanceProfile(context, PROFILE.leadAttacks)?.rechargeReduction ||
        0.15,
    );
    const sleightReduction = Number(
      thiefBalanceProfile(context, PROFILE.sleightOfHand)?.rechargeReduction ||
        0.2,
    );
    if (skill.id === ID.SIPHON) {
      // Specter's Siphon is the exception to the ordinary multiplicative
      // stacking used by Steal replacements: these two reductions add.
      result *=
        1 -
        Number(leadAttacks) * leadReduction -
        Number(sleightOfHand) * sleightReduction;
    } else {
      if (leadAttacks) result *= 1 - leadReduction;
      if (sleightOfHand) result *= 1 - sleightReduction;
    }
  }
  return result;
}

export const thiefCoreCastRules = Object.freeze({
  availability: {
    id: "thief.core-availability",
    order: 10,
    handler: thiefCoreCastAvailability,
  },
  modifyRechargeDuration: modifyThiefCoreRechargeDuration,
});

export const thiefCoreSchedulerHooks = Object.freeze({
  advance: advanceThiefCoreResources,
  onCastStart: spendThiefCoreResources,
  onCastComplete: {
    id: "thief.core-resources",
    order: 10,
    handler: completeThiefCoreResources,
  },
  afterCast: Object.freeze([
    {
      id: "thief.weapon-state",
      order: 10,
      handler: updateThiefWeaponState,
    },
    {
      id: "thief.traits",
      order: 20,
      handler: updateThiefTraitCastState,
    },
  ]),
  taskHandlers: thiefCoreTaskHandlers,
  snapshot: (context: ThiefSchedulerContext) =>
    snapshotThiefState(context.state.profession),
});
