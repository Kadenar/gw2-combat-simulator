import { professionCoreState } from "../../../platform/engine/profession.js";
import {
  CANONICAL_TARGET_CONDITIONS,
  canonicalTargetConditionName,
  targetHasCondition as targetHasConfiguredCondition,
} from "../../../platform/gw2/target-state.js";
import {
  createModifierHooks,
  MODIFIER_TARGET,
} from "../../../platform/gw2/modifier-rules.js";
import { professionStaticRulesApplied } from "../../../platform/gw2/attribute-provenance.js";
import { hasTrait } from "../../../platform/gw2/trait-state.js";
import {
  NECROMANCER_SKILL_IDS as ID,
  NECROMANCER_TRAIT_IDS as TRAIT,
} from "../data/ids.js";
import {
  necromancerCastRules,
  necromancerSchedulerHooks,
} from "./contract.js";
import type {
  SchedulerRecord,
  SkillId,
} from "../../../platform/engine/types.js";
import type {
  Gw2ModifierContext,
  Gw2ModifierRule,
} from "../../../platform/gw2/types.js";
import type {
  NecromancerConfig,
  NecromancerCoreState,
  NecromancerQueryRuntime,
  NecromancerRechargeModifierContext,
  NecromancerRuntimeState,
  NecromancerSkill,
  NecromancerState,
} from "../types.js";

function queryProfessionState(
  context: Gw2ModifierContext,
): Partial<NecromancerState> | NecromancerRuntimeState {
  return (
    (context.runtime as NecromancerQueryRuntime | null | undefined)
      ?.profession || {}
  );
}

export function necromancerRuntimeCoreState(
  context: Gw2ModifierContext,
): Partial<NecromancerCoreState> {
  const state = queryProfessionState(context);
  const runtime = state as Partial<NecromancerRuntimeState>;
  return runtime.core && typeof runtime.core === "object"
    ? runtime.core
    : state as Partial<NecromancerCoreState>;
}

export function necromancerRuntimeSpecializationState(
  context: Gw2ModifierContext,
): Partial<NecromancerState> {
  const state = queryProfessionState(context);
  const runtime = state as Partial<NecromancerRuntimeState>;
  return runtime.specialization
      && typeof runtime.specialization === "object"
      && runtime.specialization.state
    ? runtime.specialization.state
    : state as Partial<NecromancerState>;
}

export function necromancerEventSkill(
  context: Gw2ModifierContext,
): NecromancerSkill | undefined {
  const profession = context.profession as
    | {
        readonly catalog?: {
          readonly skillsById?: ReadonlyMap<SkillId, NecromancerSkill>;
        };
      }
    | undefined;
  return profession?.catalog?.skillsById?.get(
    (context.event?.skillId ?? context.skillId) as SkillId,
  );
}

export function necromancerTargetHasCondition(
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

export function necromancerTargetConditionCount(
  context: Gw2ModifierContext,
): number {
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
    necromancerTargetHasCondition(context, condition),
  ).length;
}

export function necromancerTargetHealthFraction(
  context: Gw2ModifierContext,
): number {
  const runtime = context.runtime as NecromancerQueryRuntime | null | undefined;
  const maximum = Number(context.config?.target?.health || 0);
  if (!(maximum > 0)) return 1;
  const damage =
    Number(runtime?.totals?.strike || 0) +
    Number(runtime?.totals?.condition || 0);
  return Math.max(0, 1 - damage / maximum);
}

export function necromancerActiveShroud(context: Gw2ModifierContext): string {
  return String(necromancerRuntimeCoreState(context).activeShroud || "");
}

export function necromancerTargetChilled(context: Gw2ModifierContext): boolean {
  return (
    necromancerTargetHasCondition(context, "Chilled") ||
    Number(necromancerRuntimeCoreState(context).targetChilledUntil || 0) >
      context.time
  );
}

export function necromancerTargetControlled(
  context: Gw2ModifierContext,
): boolean {
  return (
    Boolean(context.config?.target?.controlled) ||
    (context.config?.target?.defiant !== true &&
      Number(necromancerRuntimeCoreState(context).targetControlledUntil || 0) >
        context.time)
  );
}

export function cloneNecromancerAttributes(
  attributes: SchedulerRecord,
): SchedulerRecord & {
  power: number;
  precision: number;
  vitality: number;
  ferocity: number;
  conditionDamage: number;
  expertise: number;
  concentration: number;
} {
  return { ...attributes } as SchedulerRecord & {
    power: number;
    precision: number;
    vitality: number;
    ferocity: number;
    conditionDamage: number;
    expertise: number;
    concentration: number;
  };
}

export function necromancerCriticalExpectedFactor(
  context: Gw2ModifierContext,
  criticalHitFactor: number,
): number {
  if (!context.query || !context.event) return 1;
  const critical = context.query.critical(
    context.event,
    context.time,
    context.runtime,
  );
  const normalExpected = 1 + critical.chance * (critical.damage - 1);
  const modifiedExpected =
    1 - critical.chance + critical.chance * critical.damage * criticalHitFactor;
  return modifiedExpected / normalExpected;
}

function selectedSkill(context: Gw2ModifierContext, name: string): boolean {
  const config = (context.config || {}) as NecromancerConfig;
  const source = config.selectedSkills || [];
  const selected = Array.isArray(source) ? source : Object.values(source);
  return selected.map(String).includes(name);
}

function signetOfSpitePassiveActive(context: Gw2ModifierContext): boolean {
  return (
    selectedSkill(context, "Signet of Spite") &&
    !necromancerActiveShroud(context) &&
    !context.timeline?.skillOnCooldownAt(ID.SIGNET_OF_SPITE, context.time)
  );
}

export function modifyNecromancerCoreAttributes(
  context: Gw2ModifierContext,
  attributes: SchedulerRecord,
): SchedulerRecord {
  const result = cloneNecromancerAttributes(attributes);
  const staticRulesApplied = professionStaticRulesApplied(context.config);
  if (selectedSkill(context, "Signet of Spite")) {
    const passiveActive = signetOfSpitePassiveActive(context);
    if (staticRulesApplied) {
      if (!passiveActive) result.power -= 180;
    } else if (passiveActive) {
      result.power += 180;
    }
  }
  const timedCarapace = (
    necromancerRuntimeCoreState(context).carapaceExpiries || []
  ).filter((expiresAt: number) => expiresAt > context.time).length;
  const minionCarapace = hasTrait(context, TRAIT.FLESH_OF_THE_MASTER)
    ? Object.values(
        necromancerRuntimeCoreState(context).activeMinions || {},
      ).reduce(
        (total: number, count: number) => total + Number(count || 0) * 2,
        0,
      )
    : 0;
  const carapace = Math.min(30, timedCarapace + minionCarapace);
  if (hasTrait(context, TRAIT.DEADLY_STRENGTH) && carapace > 0) {
    result.power += carapace * 10;
    result.conditionDamage += carapace * 10;
  }
  if (hasTrait(context, TRAIT.AWAKEN_THE_PAIN)) {
    result.power +=
      Number(
        context.query?.mightStacksAt(
          context.time,
          context.runtime,
          context.event,
        ) || 0,
      ) * 10;
  }
  if (!staticRulesApplied) {
    if (hasTrait(context, TRAIT.SPITEFUL_FORTITUDE)) {
      result.vitality += Number(result.power || 0) * 0.1;
    }
    if (hasTrait(context, TRAIT.FURIOUS_DEMISE)) result.precision += 180;
    if (hasTrait(context, TRAIT.TARGET_THE_WEAK)) {
      result.conditionDamage += Math.floor(
        Number(result.precision || 0) * 0.13,
      );
    }
    if (hasTrait(context, TRAIT.LINGERING_CURSE)) {
      result.conditionDamage += 200;
    }
    if (hasTrait(context, TRAIT.VITAL_PERSISTENCE)) result.vitality += 180;
  }
  return result;
}

export const necromancerCoreModifierRules: readonly Gw2ModifierRule[] =
  Object.freeze([
    {
      id: "necromancer.life-siphon-bleeding-target",
      target: MODIFIER_TARGET.STRIKE_DAMAGE,
      operation: "multiply",
      factor: 1.5,
      order: 100,
      when: (context) =>
        Boolean(
          necromancerEventSkill(context)?.id === ID.LIFE_SIPHON &&
          necromancerTargetHasCondition(context, "Bleeding"),
        ),
    },
    {
      id: "necromancer.target-the-weak-critical-chance",
      target: MODIFIER_TARGET.CRITICAL_CHANCE,
      operation: "add",
      amount: (context) => necromancerTargetConditionCount(context) * 0.02,
      when: (context) => hasTrait(context, TRAIT.TARGET_THE_WEAK),
    },
    {
      id: "necromancer.death-perception-critical-chance",
      target: MODIFIER_TARGET.CRITICAL_CHANCE,
      operation: "add",
      amount: 0.15,
      when: (context) => hasTrait(context, TRAIT.DEATH_PERCEPTION),
    },
    {
      id: "necromancer.soul-barbs",
      target: [MODIFIER_TARGET.STRIKE_DAMAGE, MODIFIER_TARGET.CONDITION_DAMAGE],
      operation: "damage-additive",
      amount: 0.1,
      when: (context) =>
        Boolean(
          hasTrait(context, TRAIT.SOUL_BARBS) &&
          context.timeline?.timedActive("necromancer-soul-barbs", context.time),
        ),
    },
    {
      id: "necromancer.dread",
      target: MODIFIER_TARGET.STRIKE_DAMAGE,
      operation: "damage-additive",
      amount: 0.2,
      when: (context) =>
        hasTrait(context, TRAIT.DREAD) &&
        Number(necromancerRuntimeCoreState(context).dreadUntil || 0) >
          context.time,
    },
    {
      id: "necromancer.death-perception-critical-hit-damage",
      target: MODIFIER_TARGET.STRIKE_DAMAGE,
      operation: "multiply",
      factor: (context) => necromancerCriticalExpectedFactor(context, 1.1),
      order: 100,
      when: (context) =>
        hasTrait(context, TRAIT.DEATH_PERCEPTION) &&
        Boolean(necromancerActiveShroud(context)),
    },
    {
      id: "necromancer.spiteful-talisman",
      target: MODIFIER_TARGET.STRIKE_DAMAGE,
      operation: "multiply",
      factor: (context) => (context.config?.target?.boonless ? 1.05 : 1.03),
      order: 100,
      when: (context) => hasTrait(context, TRAIT.SPITEFUL_TALISMAN),
    },
    {
      id: "necromancer.close-to-death",
      target: MODIFIER_TARGET.STRIKE_DAMAGE,
      operation: "multiply",
      factor: 1.2,
      order: 100,
      when: (context) =>
        hasTrait(context, TRAIT.CLOSE_TO_DEATH) &&
        necromancerTargetHealthFraction(context) < 0.5,
    },
    {
      id: "necromancer.necromantic-corruption",
      target: MODIFIER_TARGET.STRIKE_DAMAGE,
      operation: "multiply",
      factor: 1.25,
      order: 100,
      when: (context) =>
        Boolean(
          context.event?.summonKind === "minion" &&
          hasTrait(context, TRAIT.NECROMANTIC_CORRUPTION),
        ),
    },
    {
      id: "necromancer.putrid-defense",
      target: MODIFIER_TARGET.CONDITION_DAMAGE,
      operation: "multiply",
      factor: 1.15,
      order: 100,
      when: (context) =>
        context.condition === "Poisoned" &&
        hasTrait(context, TRAIT.PUTRID_DEFENSE),
    },
    {
      id: "necromancer.barbed-precision-duration",
      target: MODIFIER_TARGET.CONDITION_DURATION,
      operation: "multiply",
      factor: 1.2,
      when: (context) =>
        context.condition === "Bleeding" &&
        hasTrait(context, TRAIT.BARBED_PRECISION) &&
        !professionStaticRulesApplied(context.config),
    },
  ]);

export function compileNecromancerModifierRules(
  rules: readonly Gw2ModifierRule[],
) {
  return createModifierHooks({ rules });
}

function modifyNecromancerCoreRechargeDuration(
  context: NecromancerRechargeModifierContext,
  duration: number,
): number {
  let result = duration;
  const skill = context.skill;
  if (skill?.rechargeOnMinionDeath && !context.minionDeathRecharge) return 0;
  if (
    skill?.categories?.includes("Corruption") &&
    hasTrait(context, TRAIT.MASTER_OF_CORRUPTION)
  ) {
    result *= 0.67;
  }
  if (
    (skill?.shroud || skill?.handlerId === "necromancer.shade") &&
    hasTrait(context, TRAIT.SINISTER_SHROUD)
  ) {
    result *= 0.85;
  }
  return result;
}

function modifyNecromancerConditionBaseDuration(
  context: Gw2ModifierContext,
  duration: number,
): number {
  return necromancerEventSkill(context)?.weapon === "Scepter" &&
    context.event?.skillId !== ID.DEVOURING_DARKNESS &&
    hasTrait(context, TRAIT.LINGERING_CURSE)
    ? duration * 1.5
    : duration;
}

function modifyNecromancerRechargeStart(
  context: {
    readonly skill?: NecromancerSkill;
    readonly start: number;
  },
  rechargeStart: number,
): number {
  return context.skill?.id === ID.ISOLATE &&
    context.skill.flipActivationAtMs != null
    ? context.start + Number(context.skill.flipActivationAtMs) / 1000
    : rechargeStart;
}

export const necromancerCoreAttributeRules = Object.freeze({
  modifyAttributes: modifyNecromancerCoreAttributes,
  modifyConditionBaseDuration: modifyNecromancerConditionBaseDuration,
  modifierRules: necromancerCoreModifierRules,
  compileModifierRules: compileNecromancerModifierRules,
});

export const necromancerCoreCastRules = Object.freeze({
  ...necromancerCastRules,
  modifyRechargeDuration: modifyNecromancerCoreRechargeDuration,
  modifyRechargeStart: modifyNecromancerRechargeStart,
});

export { necromancerSchedulerHooks };
