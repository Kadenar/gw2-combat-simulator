import {
  createModifierHooks,
  MODIFIER_TARGET,
} from "../../../platform/gw2/modifier-rules.js";
import { professionStaticRulesApplied } from "../../../platform/gw2/attribute-provenance.js";
import { hasTrait } from "../../../platform/gw2/trait-state.js";
import {
  REVENANT_TRAIT_IDS as TRAIT,
} from "../data/ids.js";
import type {
  Gw2ModifierContext,
  Gw2ModifierRule,
  Gw2Stats,
} from "../../../platform/gw2/types.js";
import type {
  RevenantConfig,
  RevenantCoreState,
  RevenantRuntimeState,
  RevenantState,
} from "../types.js";

export interface RevenantModifierContext extends Gw2ModifierContext {
  readonly config?: RevenantConfig;
  readonly state?: {
    readonly profession?: Partial<RevenantState>;
  };
}

export function revenantPlayer(context: RevenantModifierContext): boolean {
  return context.event?.actorType !== "summon";
}

function revenantRuntimeState(
  context: RevenantModifierContext,
): Partial<RevenantState> | RevenantRuntimeState {
  return (
    context.runtime?.profession ??
    context.state?.profession ??
    {}
  ) as Partial<RevenantState> | RevenantRuntimeState;
}

export function revenantRuntimeCoreState(
  context: RevenantModifierContext,
): Partial<RevenantCoreState> {
  const state = revenantRuntimeState(context);
  return "core" in state && state.core
    ? state.core
    : state as Partial<RevenantCoreState>;
}

export function revenantRuntimeSpecializationState(
  context: RevenantModifierContext,
): Partial<RevenantState> {
  const state = revenantRuntimeState(context);
  return "specialization" in state && state.specialization?.state
    ? state.specialization.state as Partial<RevenantState>
    : state as Partial<RevenantState>;
}

export function revenantTimedBuff(
  context: RevenantModifierContext,
  kind: string,
): boolean {
  if (context.config?.boons?.[kind]) return true;
  return (context.runtime?.boons?.get(kind) || []).some(
    (application) =>
      application.at <= context.time && application.expiresAt > context.time,
  );
}

export function revenantTargetHealthFraction(
  context: RevenantModifierContext,
): number {
  const maximum = Number(context.config?.target?.health || 0);
  if (!(maximum > 0)) return 1;
  const totals = context.runtime?.totals as
    | { readonly strike?: number; readonly condition?: number }
    | undefined;
  const dealt = Number(totals?.strike || 0) + Number(totals?.condition || 0);
  return Math.max(0, 1 - dealt / maximum);
}

export function revenantTargetHasCondition(
  context: RevenantModifierContext,
  condition: string,
): boolean {
  return Boolean(
    context.query?.targetHasCondition(condition, context.time, context.runtime),
  );
}

export function revenantTargetVulnerability(
  context: RevenantModifierContext,
): number {
  return Number(
    context.query?.targetConditionStacks(
      "Vulnerability",
      context.time,
      context.runtime,
    ) || 0,
  );
}

function activeOffhand(context: RevenantModifierContext): boolean {
  const set = Number(context.runtime?.activeWeaponSet || 1);
  return Boolean(
    set === 2
      ? context.config?.weaponSet2Secondary
      : context.config?.secondaryWeapon,
  );
}

function targetHasDefensiveBoon(context: RevenantModifierContext): boolean {
  const boons = context.config?.target?.boons || {};
  return Boolean(
    (boons as Record<string, boolean | number>).stability ||
    (boons as Record<string, boolean | number>).protection
  );
}

function periodicAssassinsPresence(
  context: RevenantModifierContext,
): boolean {
  if (!hasTrait(context, TRAIT.ASSASSINS_PRESENCE)) return false;
  const start = Number(
    context.runtime?.combatStartTime ??
      context.runtime?.firstHitTime ??
      context.time,
  );
  return Math.max(0, context.time - start) % 10 < 3;
}

const DAMAGING_CONDITIONS = new Set([
  "Bleeding",
  "Burning",
  "Confusion",
  "Poisoned",
  "Torment",
]);

export function revenantActiveBoonCount(
  context: RevenantModifierContext,
): number {
  const allowed = new Set([
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
  const active = new Set(
    Object.entries(context.config?.boons || {})
      .filter(([, value]) =>
        typeof value === "number" ? value > 0 : Boolean(value),
      )
      .map(([kind]) => kind.toLowerCase())
      .filter((kind) => allowed.has(kind)),
  );
  for (const [kind, applications] of context.runtime?.boons || []) {
    const normalized = String(kind).toLowerCase();
    if (
      allowed.has(normalized) &&
      applications.some(
        (application) =>
          application.at <= context.time &&
          application.expiresAt > context.time,
      )
    ) {
      active.add(normalized);
    }
  }
  return active.size;
}

export const revenantCoreModifierRules: readonly Gw2ModifierRule[] =
  Object.freeze([
    {
      id: "revenant.ferocious-aggression",
      target: [MODIFIER_TARGET.STRIKE_DAMAGE, MODIFIER_TARGET.CONDITION_DAMAGE],
      operation: "damage-additive",
      amount: 0.1,
      when: (context) =>
        revenantPlayer(context) &&
        hasTrait(context, TRAIT.FEROCIOUS_AGGRESSION) &&
        Boolean(context.config?.boons?.fury),
    },
    {
      id: "revenant.rising-tide",
      target: MODIFIER_TARGET.STRIKE_DAMAGE,
      operation: "multiply",
      factor: 1.1,
      when: (context) =>
        revenantPlayer(context) &&
        hasTrait(context, TRAIT.RISING_TIDE) &&
        Number(context.config?.playerHealthFraction ?? 1) > 0.75,
    },
    {
      id: "revenant.acolyte-of-torment",
      target: MODIFIER_TARGET.CONDITION_DAMAGE,
      operation: "multiply",
      factor: 1.1,
      when: (context) =>
        revenantPlayer(context) &&
        context.condition === "Torment" &&
        hasTrait(context, TRAIT.ACOLYTE_OF_TORMENT),
    },
    {
      id: "revenant.dwarven-battle-training",
      target: MODIFIER_TARGET.STRIKE_DAMAGE,
      operation: "multiply",
      factor: 1.1,
      when: (context) =>
        revenantPlayer(context) &&
        hasTrait(context, TRAIT.DWARVEN_BATTLE_TRAINING) &&
        revenantTargetHasCondition(context, "Weakness"),
    },
    {
      id: "revenant.vicious-reprisal",
      target: [MODIFIER_TARGET.STRIKE_DAMAGE, MODIFIER_TARGET.CONDITION_DAMAGE],
      operation: "damage-additive",
      amount: 0.1,
      when: (context) =>
        revenantPlayer(context) &&
        hasTrait(context, TRAIT.VICIOUS_REPRISAL) &&
        revenantTimedBuff(context, "resolution"),
    },
    {
      id: "revenant.destructive-impulses",
      target: [MODIFIER_TARGET.STRIKE_DAMAGE, MODIFIER_TARGET.CONDITION_DAMAGE],
      operation: "damage-additive",
      amount: (context) => (activeOffhand(context) ? 0.075 : 0.05),
      when: (context) =>
        revenantPlayer(context) &&
        hasTrait(context, TRAIT.DESTRUCTIVE_IMPULSES),
    },
    {
      id: "revenant.unsuspecting-strikes",
      target: MODIFIER_TARGET.STRIKE_DAMAGE,
      operation: "multiply",
      factor: 1.2,
      when: (context) =>
        revenantPlayer(context) &&
        hasTrait(context, TRAIT.UNSUSPECTING_STRIKES) &&
        revenantTargetHealthFraction(context) > 0.8,
    },
    {
      id: "revenant.targeted-destruction",
      target: MODIFIER_TARGET.STRIKE_DAMAGE,
      operation: "multiply",
      factor: (context) =>
        1 + revenantTargetVulnerability(context) * 0.005,
      when: (context) =>
        revenantPlayer(context) &&
        hasTrait(context, TRAIT.TARGETED_DESTRUCTION),
    },
    {
      id: "revenant.brutality",
      target: [MODIFIER_TARGET.STRIKE_DAMAGE, MODIFIER_TARGET.CONDITION_DAMAGE],
      operation: "multiply",
      factor: 1.15,
      when: (context) =>
        revenantPlayer(context) &&
        hasTrait(context, TRAIT.BRUTALITY) &&
        targetHasDefensiveBoon(context),
    },
    {
      id: "revenant.swift-termination",
      target: MODIFIER_TARGET.STRIKE_DAMAGE,
      operation: "multiply",
      factor: 1.2,
      when: (context) =>
        revenantPlayer(context) &&
        hasTrait(context, TRAIT.SWIFT_TERMINATION) &&
        revenantTargetHealthFraction(context) < 0.5,
    },
  ]);

export function compileRevenantModifierRules(
  rules: readonly Gw2ModifierRule[],
) {
  return createModifierHooks({ rules });
}

function modifyCoreCriticalChance(
  context: RevenantModifierContext,
  chance: number,
): number {
  return hasTrait(context, TRAIT.ROILING_MISTS) &&
    (revenantTimedBuff(context, "fury") ||
      periodicAssassinsPresence(context))
    ? chance + 0.25
    : chance;
}

function modifyCoreConditionDuration(
  context: RevenantModifierContext,
  duration: number,
): number {
  let modified = duration;
  if (
    hasTrait(context, TRAIT.PACT_OF_PAIN) &&
    !professionStaticRulesApplied(context.config)
  ) {
    modified += 0.15;
  }
  if (
    DAMAGING_CONDITIONS.has(String(context.condition || "")) &&
    hasTrait(context, TRAIT.YEARNING_EMPOWERMENT) &&
    !professionStaticRulesApplied(context.config)
  ) {
    modified += 0.1;
  }
  return modified;
}

function modifyCoreAttributes(
  context: RevenantModifierContext,
  attributes: Gw2Stats,
): Gw2Stats {
  const modified = { ...attributes } as Record<string, number>;
  if (hasTrait(context, TRAIT.NOTORIETY)) {
    const baseMight = Math.max(
      0,
      Math.min(25, Number(context.config?.boons?.might || 0)),
    );
    const dynamicMight = Math.min(
      Math.max(0, 25 - baseMight),
      (context.runtime?.boons?.get("might") || [])
        .filter(
          (application) =>
            application.at <= context.time &&
            application.expiresAt > context.time,
        )
        .reduce((sum, application) => sum + Number(application.stacks || 1), 0),
    );
    const might = Math.min(25, baseMight + dynamicMight);
    modified.power = Number(modified.power || 0) + might * 10;
    modified.conditionDamage =
      Number(modified.conditionDamage || 0) - might * 10;
  }
  return modified;
}

export const revenantCoreAttributeRules = Object.freeze({
  modifyAttributes: modifyCoreAttributes,
  modifyCriticalChance: modifyCoreCriticalChance,
  modifyConditionDuration: modifyCoreConditionDuration,
  modifierRules: revenantCoreModifierRules,
  compileModifierRules: compileRevenantModifierRules,
});
