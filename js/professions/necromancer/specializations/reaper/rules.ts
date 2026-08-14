import { professionCoreState } from "../../../../platform/engine/profession.js";
import { targetConditionStacks as configuredTargetConditionStacks } from "../../../../platform/gw2/target-state.js";
import { MODIFIER_TARGET } from "../../../../platform/gw2/modifier-rules.js";
import { hasTrait } from "../../../../platform/gw2/trait-state.js";
import {
  NECROMANCER_SKILL_IDS as ID,
  NECROMANCER_TRAIT_IDS as TRAIT,
} from "../../data/ids.js";
import { isInternalCooldownReady } from "../../../../platform/engine/clock.js";
import { requiredShroud } from "../../mechanics/availability.js";
import {
  emitDamage,
  gainNecromancerLifeForce,
  hasTrait as hasNecromancerTrait,
} from "../../core/shared.js";
import {
  cloneNecromancerAttributes,
  necromancerActiveShroud,
  necromancerEventSkill,
  necromancerTargetChilled,
} from "../../core/rules.js";
import { ensurePermanentIceFieldAssumption } from "./shroud.js";
import type { SchedulerRecord } from "../../../../platform/engine/types.js";
import type {
  Gw2ModifierContext,
  Gw2ModifierRule,
} from "../../../../platform/gw2/types.js";
import type {
  NecromancerCastContext,
  NecromancerCastModifierContext,
  NecromancerSchedulerContext,
  NecromancerSimulationEvent,
  NecromancerSkill,
} from "../../types.js";

function reduceShroudCooldowns(
  context: NecromancerSchedulerContext,
  at: number,
): void {
  for (const candidate of context.catalog.skills || []) {
    if (candidate.shroud !== "reaper") continue;
    const readyAt = Number(context.state.cooldowns.get(candidate.id) || 0);
    if (!(readyAt > at + context.epsilon)) continue;
    const reduced = Math.max(at, readyAt - 1);
    if (reduced <= at + context.epsilon) {
      context.state.cooldowns.delete(candidate.id);
    } else {
      context.state.cooldowns.set(candidate.id, reduced);
    }
  }
}

function afterCast(
  context: NecromancerCastContext,
  skill: NecromancerSkill,
): void {
  if (
    skill.id === ID.LIFE_REAP &&
    hasNecromancerTrait(context, TRAIT.REAPERS_ONSLAUGHT)
  ) {
    const hitAt = context.start + (context.fullEnd - context.start) / 2;
    if (context.effectiveEnd >= hitAt - context.epsilon) {
      reduceShroudCooldowns(context, hitAt);
    }
  }
  if (
    skill.categories?.includes("Shout") &&
    hasNecromancerTrait(context, TRAIT.AUGURY_OF_DEATH)
  ) {
    emitDamage(context, skill, 0, {
      name: "Augury of Death",
      source: "Trait",
      sourceId: TRAIT.AUGURY_OF_DEATH,
      actorType: "effect",
      skillWeapon: "Unequipped",
      metadata: {
        flatStrikeBase: 276,
        flatStrikePowerCoeff: 0.02,
        noCrit: true,
        damageKind: "life-steal",
      },
    });
  }
  if (context.effectiveEnd < context.fullEnd - context.epsilon) return;
  const state = professionCoreState(context);
  if (
    hasNecromancerTrait(context, TRAIT.CHILLING_VICTORY) &&
    requiredShroud(skill) === "reaper" &&
    isInternalCooldownReady(
      context.effectiveEnd,
      Number(state.traitProcReadyAt.chillingVictory || 0),
    ) &&
    context.config?.target?.conditions?.Chilled
  ) {
    gainNecromancerLifeForce(
      context,
      1,
      context.effectiveEnd,
      "chilling-victory",
    );
    state.traitProcReadyAt.chillingVictory = context.effectiveEnd + 1;
  }
}

function onEventScheduled(
  context: NecromancerSchedulerContext,
  event: NecromancerSimulationEvent,
): void {
  ensurePermanentIceFieldAssumption(context, event);
  if (
    event.type === "buff" &&
    event.actorType === "player" &&
    event.kind !== "target-vulnerability" &&
    hasNecromancerTrait(context, TRAIT.BLIGHTERS_BOON)
  ) {
    gainNecromancerLifeForce(context, 1, event.at, "blighters-boon");
  }
}

export const reaperSchedulerHooks = Object.freeze({
  afterCast,
  onEventScheduled,
});

function modifyReaperAttributes(
  context: Gw2ModifierContext,
  attributes: SchedulerRecord,
): SchedulerRecord {
  const result = cloneNecromancerAttributes(attributes);
  if (
    hasTrait(context, TRAIT.REAPERS_ONSLAUGHT) &&
    necromancerActiveShroud(context) === "reaper"
  ) {
    result.ferocity += 300;
  }
  return result;
}

function modifyReaperCastDuration(
  context: NecromancerCastModifierContext,
  duration: number,
): number {
  return hasTrait(context, TRAIT.REAPERS_ONSLAUGHT) &&
    professionCoreState(context).activeShroud === "reaper" &&
    !context.hasBuff?.("quickness", context.start)
    ? duration / 1.5
    : duration;
}

export const reaperModifierRules: readonly Gw2ModifierRule[] = Object.freeze([
  {
    id: "necromancer.reaper-shout-melee",
    target: MODIFIER_TARGET.STRIKE_DAMAGE,
    operation: "multiply",
    factor: 2,
    order: 100,
    when: (context) =>
      Boolean(
        context.event?.actorType === "player" &&
          necromancerEventSkill(context)?.categories?.includes("Shout") &&
          context.config?.target?.nearby !== false,
      ),
  },
  {
    id: "necromancer.decimate-defenses",
    target: MODIFIER_TARGET.CRITICAL_CHANCE,
    operation: "add",
    amount: (context) =>
      Math.min(
        25,
        Number(
          context.query?.targetConditionStacks
            ? context.query.targetConditionStacks(
                "Vulnerability",
                context.time,
                context.runtime,
              )
            : configuredTargetConditionStacks(
                context.config || {},
                "Vulnerability",
                context.time,
                context.runtime,
              ),
        ),
      ) * 0.02,
    when: (context) => hasTrait(context, TRAIT.DECIMATE_DEFENSES),
  },
  {
    id: "necromancer.cold-shoulder",
    target: MODIFIER_TARGET.STRIKE_DAMAGE,
    operation: "multiply",
    factor: 1.15,
    order: 100,
    when: (context) =>
      hasTrait(context, TRAIT.COLD_SHOULDER) &&
      necromancerTargetChilled(context),
  },
  {
    id: "necromancer.soul-eater",
    target: MODIFIER_TARGET.STRIKE_DAMAGE,
    operation: "multiply",
    factor: 1.15,
    order: 100,
    when: (context) =>
      hasTrait(context, TRAIT.SOUL_EATER) &&
      context.config?.target?.nearby !== false,
  },
]);

export const reaperAttributeRules = Object.freeze({
  modifyAttributes: modifyReaperAttributes,
  modifierRules: reaperModifierRules,
});

export const reaperCastRules = Object.freeze({
  modifyCastDuration: modifyReaperCastDuration,
});
