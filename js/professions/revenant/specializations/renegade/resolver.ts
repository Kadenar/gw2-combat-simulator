import { renegadeState } from "./state.js";
import {
  professionCoreState,
} from "../../../../platform/engine/profession.js";
import { enqueueOrdered } from "../../../../platform/engine/event-queue.js";
import { RENEGADE_MECHANICS as MECHANICS } from "./mechanics.js";
import {
  REVENANT_SKILL_IDS as ID,
  REVENANT_TRAIT_IDS as TRAIT,
} from "../../data/ids.js";
import { hasRevenantTrait } from "../../core/state.js";
import { activeKallasFervorStacks } from "./renegade.js";
import type {
  SchedulerRecord,
  SkillId,
} from "../../../../platform/engine/types.js";
import type {
  RevenantResolverContext,
  RevenantResolverEvent,
  RevenantSkill,
} from "../../types.js";

function activeSkillIds(
  context: RevenantResolverContext,
): Set<SkillId> {
  return new Set<SkillId>(
    professionCoreState(context).activeUpkeeps.map(
      (upkeep) => upkeep.skillId,
    ),
  );
}

function skillById(
  context: RevenantResolverContext,
  id: SkillId,
): RevenantSkill | undefined {
  return context.helpers.skillsById?.get(id) as RevenantSkill | undefined;
}

function kallasFervorLifeSiphonMultiplier(
  context: RevenantResolverContext,
  at: number,
): number {
  const stacks = activeKallasFervorStacks(renegadeState.from(context), at);
  if (!stacks) return 1;
  const profile = MECHANICS.renegade.kallasFervor;
  const perStack = hasRevenantTrait(context.config, TRAIT.LASTING_LEGACY)
    ? profile.improvedLifeSiphonDamagePerStack
    : profile.lifeSiphonDamagePerStack;
  return 1 + stacks * perStack;
}

function reactToDamage(
  context: RevenantResolverContext,
  event: RevenantResolverEvent,
): void {
  if (event.actorType !== "player" || !(Number(event.coefficient) > 0)) return;
  const active = activeSkillIds(context);
  const soulcleave = skillById(context, ID.SOULCLEAVES_SUMMIT);
  if (
    soulcleave &&
    active.has(soulcleave.id) &&
    event.skillId !== soulcleave.id &&
    event.at >= Number(
      professionCoreState(context).traitProcReadyAt.soulcleave || 0
    )
  ) {
    const profile = MECHANICS.soulcleave;
    professionCoreState(context).traitProcReadyAt.soulcleave =
      event.at + profile.interval;
    enqueueOrdered(context.queue, {
      type: "damage",
      at: event.at,
      name: "Soulcleave's Summit — Additional Strike",
      skillName: "Soulcleave's Summit",
      coefficient: profile.coefficient,
      hits: 1,
      hitIndex: 1,
      totalHits: 1,
      source: "revenant",
      sourceId: soulcleave.id,
      actorType: "effect",
      skillId: soulcleave.id,
      skillWeapon: "Unequipped",
      triggeredBy: event.skillName,
    });
    enqueueOrdered(context.queue, {
      type: "damage",
      at: event.at,
      name: "Soulcleave's Summit — Life Siphon",
      skillName: "Soulcleave's Summit",
      coefficient: 0,
      flatStrikeBase: profile.siphon.flatStrikeBase,
      flatStrikePowerCoeff: profile.siphon.flatStrikePowerCoeff,
      flatStrikeMultiplier: kallasFervorLifeSiphonMultiplier(context, event.at),
      noCrit: true,
      hits: 1,
      hitIndex: 1,
      totalHits: 1,
      source: "revenant",
      sourceId: soulcleave.id,
      actorType: "effect",
      skillId: soulcleave.id,
      skillWeapon: "Unequipped",
      triggeredBy: event.skillName,
    });
  }
}

function reactToFoodProc(
  context: RevenantResolverContext,
  event: RevenantResolverEvent,
): SchedulerRecord | undefined {
  if (!event.lifeSiphon) return;
  return {
    flatStrikeMultiplier: kallasFervorLifeSiphonMultiplier(context, event.at),
  };
}

export const revenantRenegadeEventReactions = Object.freeze({
  damage: reactToDamage,
  food_proc: reactToFoodProc,
});
