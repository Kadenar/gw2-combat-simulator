import {
  professionCoreState,
  professionSpecializationState,
} from "../../../../platform/engine/profession.js";
import { reaperResolverEventReactions } from "./resolver.js";
import { executionersScythe, soulSpiral } from "./shroud.js";
import {
  NECROMANCER_SKILL_IDS as ID,
  NECROMANCER_TRAIT_IDS as TRAIT,
} from "../../data/ids.js";
import { requiredShroud } from "../../mechanics/availability.js";
import {
  emitDamage,
  gainNecromancerLifeForce,
  hasTrait,
} from "../../core/shared.js";
import { isInternalCooldownReady } from "../../../../platform/engine/clock.js";
import { augmentSkillHandler } from "../../../../platform/engine/skill-handlers.js";
import type {
  NecromancerCastContext,
  NecromancerSchedulerContext,
  NecromancerSimulationEvent,
  NecromancerSkill,
} from "../../types.js";

export const reaperSkillHandlers = new Map([
  [
    "necromancer.executioners-scythe",
    augmentSkillHandler(null, {
      afterEffect:
        executionersScythe,
    }),
  ],
  [
    "necromancer.soul-spiral",
    augmentSkillHandler(null, {
      afterEffect: soulSpiral,
    }),
  ],
]);

export const reaperEventReactions = reaperResolverEventReactions;

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
  if (skill.id === ID.LIFE_REAP && hasTrait(context, TRAIT.REAPERS_ONSLAUGHT)) {
    const hitAt = context.start + (context.fullEnd - context.start) / 2;
    if (context.effectiveEnd >= hitAt - context.epsilon) {
      reduceShroudCooldowns(context, hitAt);
    }
  }
  if (
    skill.categories?.includes("Shout")
    && hasTrait(context, TRAIT.AUGURY_OF_DEATH)
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
    hasTrait(context, TRAIT.CHILLING_VICTORY)
    && requiredShroud(skill) === "reaper"
    && isInternalCooldownReady(
      context.effectiveEnd,
      Number(state.traitProcReadyAt.chillingVictory || 0),
    )
    && context.config?.target?.conditions?.Chilled
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
  if (
    event.type === "buff"
    && event.actorType === "player"
    && event.kind !== "target-vulnerability"
    && hasTrait(context, TRAIT.BLIGHTERS_BOON)
  ) {
    gainNecromancerLifeForce(context, 1, event.at, "blighters-boon");
  }
}

export const reaperSchedulerHooks = Object.freeze({
  afterCast,
  onEventScheduled,
});
