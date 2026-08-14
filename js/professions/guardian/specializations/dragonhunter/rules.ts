import { MODIFIER_TARGET } from "../../../../platform/gw2/modifier-rules.js";
import { professionCoreState } from "../../../../platform/engine/profession.js";
import { hasTrait } from "../../../../platform/gw2/trait-state.js";
import {
  GUARDIAN_SKILL_IDS as ID,
  GUARDIAN_TRAIT_IDS,
} from "../../data/ids.js";
import { guardianTargetDisabled } from "../../core/rules.js";
import {
  emitGuardianBuff,
  emitGuardianProc,
  guardianTraitIcon,
  hasGuardianTrait,
} from "../../core/traits.js";
import type {
  Gw2ModifierContext,
  Gw2ModifierRule,
} from "../../../../platform/gw2/types.js";
import type {
  GuardianCastContext,
  GuardianSchedulerContext,
  GuardianSkill,
} from "../../types.js";
import { dragonhunterState } from "./state.js";

function targetHasCondition(
  context: Gw2ModifierContext,
  condition: string,
): boolean {
  return Boolean(
    context.query?.targetHasCondition(condition, context.time, context.runtime),
  );
}

export const dragonhunterModifierRules: readonly Gw2ModifierRule[] =
  Object.freeze([
    {
      id: "guardian.dragonhunter.pure-of-sight",
      target: MODIFIER_TARGET.STRIKE_DAMAGE,
      operation: "multiply",
      factor: 1.07,
      order: 100,
      when: (context) => hasTrait(context, GUARDIAN_TRAIT_IDS.PURE_OF_SIGHT),
    },
    {
      id: "guardian.dragonhunter.zealots-aggression",
      target: MODIFIER_TARGET.STRIKE_DAMAGE,
      operation: "multiply",
      factor: 1.1,
      order: 100,
      when: (context) =>
        hasTrait(context, GUARDIAN_TRAIT_IDS.ZEALOTS_AGGRESSION) &&
        targetHasCondition(context, "Crippled"),
    },
    {
      id: "guardian.dragonhunter.heavy-light",
      target: MODIFIER_TARGET.STRIKE_DAMAGE,
      operation: "multiply",
      factor: 1.15,
      order: 100,
      when: (context) =>
        hasTrait(context, GUARDIAN_TRAIT_IDS.HEAVY_LIGHT) &&
        guardianTargetDisabled(context),
    },
    {
      id: "guardian.dragonhunter.big-game-hunter",
      target: MODIFIER_TARGET.STRIKE_DAMAGE,
      operation: "multiply",
      factor: 1.25,
      order: 100,
      when: (context) =>
        hasTrait(context, GUARDIAN_TRAIT_IDS.BIG_GAME_HUNTER) &&
        dragonhunterState.from(context).tetherUntil > context.time,
    },
  ]);

export const dragonhunterAttributeRules = Object.freeze({
  modifierRules: dragonhunterModifierRules,
});

export function advanceDragonhunterState(
  context: GuardianSchedulerContext,
  target: number,
): void {
  const state = dragonhunterState.from(context);
  const interval = hasGuardianTrait(
    context,
    GUARDIAN_TRAIT_IDS.INDOMITABLE_COURAGE,
  )
    ? 30
    : 40;
  const courage = context.catalog.skillsById.get(ID.SHIELD_OF_COURAGE);
  while (
    courage &&
    state.nextShieldOfCourageAegisAt <= target + context.epsilon
  ) {
    const at = state.nextShieldOfCourageAegisAt;
    if (
      at >=
      Number(professionCoreState(context).virtueReadyAt.courage || 0) -
        context.epsilon
    ) {
      context.emit({
        type: "buff",
        at,
        source: "guardian",
        sourceId: courage.id,
        actorType: "player",
        skillId: courage.id,
        skillName: courage.name,
        name: "Shield of Courage — Passive Aegis",
        kind: "aegis",
        stacks: 1,
        duration: 20,
      });
    }
    state.nextShieldOfCourageAegisAt += interval;
  }
}

export function updateDragonhunterCastState(
  context: GuardianCastContext,
  skill: GuardianSkill,
): void {
  if (
    skill.slot === "Elite" &&
    hasGuardianTrait(context, GUARDIAN_TRAIT_IDS.HUNTERS_DETERMINATION)
  ) {
    const core = professionCoreState(context);
    core.endurance = Math.min(core.maximumEndurance, core.endurance + 100);
    core.enduranceUpdatedAt = context.effectiveEnd;
    emitGuardianProc(context, {
      name: "Hunter's Determination",
      at: context.effectiveEnd,
      sourceSkill: skill.name,
      detail: "100 endurance",
      icon: guardianTraitIcon(GUARDIAN_TRAIT_IDS.HUNTERS_DETERMINATION),
    });
  }
  if (skill.id === ID.SPEAR_OF_JUSTICE) {
    const state = dragonhunterState.from(context);
    professionCoreState(context).availableFlips[ID.HUNTERS_VERDICT] =
      state.tetherUntil;
  }
  if (
    skill.categories?.includes("Trap") &&
    hasGuardianTrait(context, GUARDIAN_TRAIT_IDS.HUNTERS_PREMONITION)
  ) {
    emitGuardianBuff(context, skill, context.effectiveEnd, "aegis", 3);
  }
}

export const dragonhunterSchedulerHooks = Object.freeze({
  advance: Object.freeze([
    {
      id: "guardian.dragonhunter.passive-courage",
      order: 40,
      handler: advanceDragonhunterState,
    },
  ]),
  afterCast: Object.freeze([
    {
      id: "guardian.dragonhunter.traits",
      order: 40,
      handler: updateDragonhunterCastState,
    },
  ]),
});
