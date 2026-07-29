import { enqueueOrdered } from "../../../platform/engine/event-queue.js";
import {
  REVENANT_HANDLER_MECHANICS as MECHANICS,
} from "../mechanics/handler-mechanics.js";
import {
  REVENANT_SKILL_IDS as ID,
  REVENANT_TRAIT_IDS as TRAIT,
} from "../data/ids.js";
import { hasRevenantTrait } from "../state.js";
import {
  activeKallasFervorStacks,
} from "../mechanics/specific/assassin-renegade.js";

function activeSkillIds(context) {
  return new Set(
    (context.profession.activeUpkeeps || []).map(upkeep => upkeep.skillId),
  );
}

function skillById(context, id) {
  return context.helpers.skillsById?.get(id);
}

function kallasFervorLifeSiphonMultiplier(context, at) {
  const stacks = activeKallasFervorStacks(context.profession, at);
  if (!stacks) return 1;
  const profile = MECHANICS.renegade.kallasFervor;
  const perStack = hasRevenantTrait(
    context.config,
    TRAIT.LASTING_LEGACY,
  )
    ? profile.improvedLifeSiphonDamagePerStack
    : profile.lifeSiphonDamagePerStack;
  return 1 + stacks * perStack;
}

function reactToDamage(context, event) {
  if (event.actorType !== "player" || !(Number(event.coefficient) > 0)) return;
  const active = activeSkillIds(context);
  const impossible = skillById(context, ID.IMPOSSIBLE_ODDS);
  if (
    impossible
    && active.has(impossible.id)
    && event.skillId !== impossible.id
    && event.at >= Number(context.profession.traitProcReadyAt.impossibleOdds || 0)
  ) {
    const profile = MECHANICS.impossibleOdds;
    context.profession.traitProcReadyAt.impossibleOdds =
      event.at + profile.interval;
    enqueueOrdered(context.queue, {
      type: "damage",
      at: event.at + profile.delay,
      name: "Impossible Odds",
      skillName: "Impossible Odds",
      coefficient: profile.coefficient,
      hits: 1,
      hitIndex: 1,
      totalHits: 1,
      source: "revenant",
      sourceId: impossible.id,
      actorType: "effect",
      skillId: impossible.id,
      skillWeapon: "Unequipped",
      triggeredBy: event.skillName,
    });
  }
  const soulcleave = skillById(context, ID.SOULCLEAVES_SUMMIT);
  if (
    soulcleave
    && active.has(soulcleave.id)
    && event.skillId !== soulcleave.id
    && event.at >= Number(context.profession.traitProcReadyAt.soulcleave || 0)
  ) {
    const profile = MECHANICS.soulcleave;
    context.profession.traitProcReadyAt.soulcleave =
      event.at + profile.interval;
    enqueueOrdered(context.queue, {
      type: "damage",
      at: event.at,
      name: "Soulcleave's Summit â€” Additional Strike",
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
      name: "Soulcleave's Summit â€” Life Siphon",
      skillName: "Soulcleave's Summit",
      coefficient: 0,
      flatStrikeBase: profile.siphon.flatStrikeBase,
      flatStrikePowerCoeff: profile.siphon.flatStrikePowerCoeff,
      flatStrikeMultiplier: kallasFervorLifeSiphonMultiplier(
        context,
        event.at,
      ),
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

function reactToFoodProc(context, event) {
  if (!event.lifeSiphon) return;
  return {
    flatStrikeMultiplier: kallasFervorLifeSiphonMultiplier(
      context,
      event.at,
    ),
  };
}

export const revenantResolverEventReactions = Object.freeze({
  damage: reactToDamage,
  food_proc: reactToFoodProc,
});
