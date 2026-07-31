import { MODIFIER_TARGET } from "../../../../platform/gw2/modifier-rules.js";
import { professionStaticRulesApplied } from "../../../../platform/gw2/attribute-provenance.js";
import { gw2AlliedPlayerAssumptions } from "../../../../platform/gw2/allied-players.js";
import { hasTrait } from "../../../../platform/gw2/trait-state.js";
import {
  REVENANT_LEGEND_IDS as LEGEND,
  REVENANT_SKILL_IDS as ID,
  REVENANT_TRAIT_IDS as TRAIT,
} from "../../data/ids.js";
import {
  revenantPlayer,
  revenantProfessionState,
  revenantTargetHasCondition,
  revenantTimedBuff,
} from "../../core/attribute-rules.js";
import { RENEGADE_MECHANICS as MECHANICS } from "./mechanics.js";
import { emitDamage } from "../../core/upkeep.js";
import { emitRevenantBoon } from "../../core/boons.js";
import { revenantCombatActive } from "../../core/legend.js";
import { hasRevenantTrait } from "../../core/state.js";
import { grantKallasFervor } from "./renegade.js";
import {
  initializeRenegadeTraits,
  modifyRenegadeCastDuration,
  modifyRenegadeRechargeDuration,
  observeRenegadeTraits,
} from "./traits.js";
import type {
  Gw2ModifierContext,
  Gw2ModifierRule,
} from "../../../../platform/gw2/types.js";
import type {
  RevenantCastContext,
  RevenantSchedulerContext,
  RevenantSimulationEvent,
  RevenantSkill,
} from "../../types.js";

function kallasFervorStacks(context: Gw2ModifierContext): number {
  return Math.min(
    MECHANICS.renegade.kallasFervor.maximumStacks,
    (revenantProfessionState(context).kallasFervor || []).filter(
      (application) =>
        Number(application.at || 0) <= context.time &&
        Number(application.expiresAt || 0) > context.time,
    ).length,
  );
}

export const renegadeModifierRules: readonly Gw2ModifierRule[] = Object.freeze([
  {
    id: "revenant.heartpiercer-strike",
    target: MODIFIER_TARGET.STRIKE_DAMAGE,
    operation: "multiply",
    factor: 1.15,
    when: (context) =>
      revenantPlayer(context) &&
      hasTrait(context, TRAIT.HEARTPIERCER) &&
      revenantTargetHasCondition(context, "Bleeding"),
  },
  {
    id: "revenant.heartpiercer-bleeding",
    target: MODIFIER_TARGET.CONDITION_DAMAGE,
    operation: "multiply",
    factor: 1.25,
    when: (context) =>
      revenantPlayer(context) &&
      context.condition === "Bleeding" &&
      hasTrait(context, TRAIT.HEARTPIERCER),
  },
  {
    id: "revenant.kallas-fervor-strike",
    target: MODIFIER_TARGET.STRIKE_DAMAGE,
    operation: "damage-additive",
    amount: (context) => {
      const profile = MECHANICS.renegade.kallasFervor;
      const perStack = hasTrait(context, TRAIT.LASTING_LEGACY)
        ? profile.improvedStrikeDamagePerStack
        : profile.strikeDamagePerStack;
      return kallasFervorStacks(context) * perStack;
    },
    when: (context) => revenantPlayer(context) && kallasFervorStacks(context) > 0,
  },
  {
    id: "revenant.kallas-fervor-condition",
    target: MODIFIER_TARGET.CONDITION_DAMAGE,
    operation: "damage-additive",
    amount: (context) => {
      const profile = MECHANICS.renegade.kallasFervor;
      const perStack = hasTrait(context, TRAIT.LASTING_LEGACY)
        ? profile.improvedConditionDamagePerStack
        : profile.conditionDamagePerStack;
      return kallasFervorStacks(context) * perStack;
    },
    when: (context) => revenantPlayer(context) && kallasFervorStacks(context) > 0,
  },
]);

function modifyRenegadeCriticalChance(
  context: Gw2ModifierContext,
  chance: number,
): number {
  if (!hasTrait(context, TRAIT.BRUTAL_MOMENTUM)) return chance;
  const state = revenantProfessionState(context);
  const maximum = Number(state.maximumEndurance || 0);
  const full = maximum > 0 && Number(state.endurance || 0) >= maximum - 1e-9;
  return chance + (full ? 0.33 : 0.1);
}

function modifyRenegadeConditionDuration(
  context: Gw2ModifierContext,
  duration: number,
): number {
  return context.condition === "Bleeding" &&
    hasTrait(context, TRAIT.BLOOD_FURY) &&
    revenantTimedBuff(context, "fury")
    ? duration + (
        MECHANICS.renegade.bloodFury.bleedingDurationMultiplier - 1
      )
    : duration;
}

export const renegadeAttributeRules = Object.freeze({
  modifierRules: renegadeModifierRules,
  modifyCriticalChance: modifyRenegadeCriticalChance,
  modifyConditionDuration: modifyRenegadeConditionDuration,
});

export const renegadeCastRules = Object.freeze({
  modifyCastDuration: modifyRenegadeCastDuration,
  modifyRechargeDuration: modifyRenegadeRechargeDuration,
});

function afterRenegadeCast(
  context: RevenantCastContext,
  skill: RevenantSkill,
): void {
  if (skill.id !== ID.SOULCLEAVES_SUMMIT) return;
  const active = context.state.profession.activeUpkeeps.find(
    (upkeep) => upkeep.skillId === skill.id,
  );
  if (!active) return;
  const allies = gw2AlliedPlayerAssumptions(context.config);
  active.nextAlliedProcAt =
    allies.count && allies.strikesPerSecond
      ? context.effectiveEnd + Math.max(1, 1 / allies.strikesPerSecond)
      : null;
}

function advanceRenegadeUpkeep(
  context: RevenantSchedulerContext,
  target: number,
): void {
  const active = context.state.profession.activeUpkeeps.find(
    (upkeep) => upkeep.skillId === ID.SOULCLEAVES_SUMMIT,
  );
  if (
    !active ||
    active.nextAlliedProcAt == null ||
    target + context.epsilon < active.nextAlliedProcAt
  ) {
    return;
  }
  const skill = context.catalog.skillsById.get(ID.SOULCLEAVES_SUMMIT);
  const allies = gw2AlliedPlayerAssumptions(context.config);
  if (!skill || !allies.count || !allies.strikesPerSecond) return;
  const profile = MECHANICS.soulcleave;
  while (
    active.nextAlliedProcAt != null &&
    target + context.epsilon >= active.nextAlliedProcAt
  ) {
    const at = active.nextAlliedProcAt;
    for (let allyIndex = 1; allyIndex <= allies.count; allyIndex += 1) {
      emitDamage(context, skill, at, profile.coefficient, {
        actorType: "effect",
        name: `Soulcleave's Summit — Ally ${allyIndex} Additional Strike`,
      });
      context.emit({
        type: "damage",
        at,
        source: "revenant",
        sourceId: skill.id,
        actorType: "effect",
        skillId: skill.id,
        skillName: skill.name,
        name: `Soulcleave's Summit — Ally ${allyIndex} Life Siphon`,
        coefficient: 0,
        flatStrikeBase: profile.siphon.flatStrikeBase,
        flatStrikePowerCoeff: profile.siphon.flatStrikePowerCoeff,
        noCrit: true,
        hits: 1,
        hitIndex: 1,
        totalHits: 1,
        skillWeapon: "Unequipped",
        extendsResolutionHorizon: true,
      });
    }
    active.nextAlliedProcAt += Math.max(
      profile.interval,
      1 / allies.strikesPerSecond,
    );
  }
}

function observeRenegadeEvent(
  context: RevenantSchedulerContext,
  event: RevenantSimulationEvent,
): void {
  if (
    event.type !== "sigil_swap" ||
    context.state.profession.activeLegendId !== LEGEND.RENEGADE ||
    !revenantCombatActive(context, event.at)
  ) {
    return;
  }
  const swapSkill = event.skillId == null
    ? undefined
    : context.catalog.skillsById.get(event.skillId);
  if (!swapSkill) return;
  const invocation = MECHANICS.legendInvocation;
  if (hasRevenantTrait(context.config, TRAIT.SPIRIT_BOON)) {
    const boon = invocation.spiritBoon;
    emitRevenantBoon(
      context,
      swapSkill,
      boon.kind,
      boon.duration,
      boon.stacks,
      {
      at: event.at,
      sourceId: TRAIT.SPIRIT_BOON,
      name: `Spirit Boon — ${boon.kind}`,
      },
    );
  }
  if (!hasRevenantTrait(context.config, TRAIT.SONG_OF_THE_MISTS)) return;
  const song = invocation.song;
  context.emit({
    type: "damage",
    at: event.at,
    source: "revenant",
    sourceId: TRAIT.SONG_OF_THE_MISTS,
    actorType: "player",
    skillId: TRAIT.SONG_OF_THE_MISTS,
    skillName: song.name,
    name: song.name,
    coefficient: song.coefficient,
    hits: 1,
    hitIndex: 1,
    totalHits: 1,
    skillWeapon: "Unequipped",
  });
  context.emit({
    type: "condition",
    at: event.at,
    source: "revenant",
    sourceId: TRAIT.SONG_OF_THE_MISTS,
    actorType: "player",
    skillId: TRAIT.SONG_OF_THE_MISTS,
    skillName: song.name,
    name: `${song.name} — ${song.conditions[0][0]}`,
    condition: String(song.conditions[0][0]),
    stacks: Number(song.conditions[0][1]),
    duration: Number(song.conditions[0][2]),
  });
  for (let index = 0; index < 2; index += 1) {
    grantKallasFervor(context, event, {
      at: event.at,
      sourceId: TRAIT.SONG_OF_THE_MISTS,
      sourceName: song.name,
    });
  }
}

export const renegadeSchedulerHooks = Object.freeze({
  initialize: {
    id: "revenant.renegade-traits",
    order: 20,
    handler: initializeRenegadeTraits,
  },
  advance: {
    id: "revenant.renegade-upkeep",
    order: 20,
    handler: advanceRenegadeUpkeep,
  },
  afterCast: {
    id: "revenant.renegade-upkeep-start",
    order: 20,
    handler: afterRenegadeCast,
  },
  onEventScheduled: {
    id: "revenant.renegade-legend-invocation",
    order: 20,
    handler: (
      context: RevenantSchedulerContext,
      event: RevenantSimulationEvent,
    ): void => {
      observeRenegadeTraits(context, event);
      observeRenegadeEvent(context, event);
    },
  },
});
