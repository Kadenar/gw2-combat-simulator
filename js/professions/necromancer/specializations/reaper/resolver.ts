import { enqueueOrdered } from "../../../../platform/engine/event-queue.js";
import { isInternalCooldownReady } from "../../../../platform/engine/internal-cooldown.js";
import { hasTrait } from "../../../../platform/gw2/trait-state.js";
import { NECROMANCER_TRAIT_IDS as TRAIT } from "../../data/ids.js";
import { REAPER_MECHANICS as MECHANICS } from "./mechanics.js";
import {
  applyTraitCondition,
  queueTraitCoefficientDamage,
  rolledCritical,
  targetIsChilled,
  usesRandomTraitProcs,
} from "../../core/resolver.js";
import type {
  NecromancerResolverContext,
  NecromancerResolverEvent,
  NecromancerResolverReactionDetails,
} from "../../types.js";

function reactToDamage(
  context: NecromancerResolverContext,
  event: NecromancerResolverEvent,
  details: NecromancerResolverReactionDetails = {},
): void {
  if (
    event.actorType === "effect" ||
    event.actorType !== "player" ||
    !(Number(event.coefficient) > 0) ||
    !hasTrait(context, TRAIT.CHILLING_NOVA) ||
    !targetIsChilled(context, event.at)
  ) {
    return;
  }
  if (!usesRandomTraitProcs(context)) {
    context.profession.chillingNovaProgress += Number(
      details.hitContext?.critical?.chance || 0,
    );
  }
  if (
    !(usesRandomTraitProcs(context)
      ? rolledCritical(details)
      : context.profession.chillingNovaProgress >= 1) ||
    !isInternalCooldownReady(
      event.at,
      Number(context.profession.traitProcReadyAt.chillingNova || 0),
    )
  ) {
    return;
  }
  if (!usesRandomTraitProcs(context)) {
    context.profession.chillingNovaProgress -= 1;
  }
  context.profession.traitProcReadyAt.chillingNova = event.at + 3;
  queueTraitCoefficientDamage(context, event, {
    name: "Chilling Nova",
    traitId: TRAIT.CHILLING_NOVA,
    coefficient: 1.125,
  });
  enqueueOrdered(context.queue, {
    type: "necromancer.chill",
    at: event.at,
    source: "Trait",
    sourceId: TRAIT.CHILLING_NOVA,
    actorType: "effect",
    skillName: "Chilling Nova",
    duration: 2,
  });
}

function reactToCondition(
  context: NecromancerResolverContext,
  event: NecromancerResolverEvent,
  details: NecromancerResolverReactionDetails = {},
): void {
  if (event.condition === "Chilled" && hasTrait(context, TRAIT.DEATHLY_CHILL)) {
    applyTraitCondition(
      details,
      context,
      event,
      MECHANICS.traitProcs[TRAIT.DEATHLY_CHILL],
    );
  }
}

function reactToControl(
  context: NecromancerResolverContext,
  event: NecromancerResolverEvent,
): void {
  if (
    (event.controlKind !== "fear" && event.kind !== "fear") ||
    !hasTrait(context, TRAIT.SHIVERS_OF_DREAD)
  ) {
    return;
  }
  enqueueOrdered(context.queue, {
    type: "necromancer.chill",
    at: event.at,
    source: "Trait",
    sourceId: TRAIT.SHIVERS_OF_DREAD,
    actorType: "effect",
    skillName: "Shivers of Dread",
    duration: 2,
  });
}

export const reaperResolverEventReactions = Object.freeze({
  damage: reactToDamage,
  condition: reactToCondition,
  control: reactToControl,
});
