import { professionCoreState } from "../../../../platform/engine/profession.js";
import { enqueueOrdered } from "../../../../platform/engine/event-queue.js";
import { hasTrait } from "../../../../platform/gw2/trait-state.js";
import { onResolvedPlayerCriticalHit } from "../../../../platform/gw2/native-profession.js";
import { NECROMANCER_TRAIT_IDS as TRAIT } from "../../data/ids.js";
import { REAPER_MECHANICS as MECHANICS } from "./mechanics.js";
import { resolveSummonIceFieldComboFinisher } from "./shroud.js";
import {
  applyTraitCondition,
  queueTraitCoefficientDamage,
  targetIsChilled,
} from "../../core/resolver.js";
import type {
  NecromancerResolverContext,
  NecromancerResolverEvent,
  NecromancerResolverReactionDetails,
} from "../../types.js";

const chillingNovaCriticalHit = onResolvedPlayerCriticalHit<
  NecromancerResolverContext,
  NecromancerResolverEvent,
  NecromancerResolverReactionDetails
>({
  id: "necromancer.chilling-nova",
  chanceOnCriticalHit: 1,
  when: (context, event) =>
    Number(event.coefficient) > 0 &&
    hasTrait(context, TRAIT.CHILLING_NOVA) &&
    targetIsChilled(context, event.at),
  expectedProgress: {
    get: (context) => professionCoreState(context).chillingNovaProgress,
    set: (context, value) => {
      professionCoreState(context).chillingNovaProgress = value;
    },
  },
  internalCooldown: {
    duration: 3,
    readyAt: (context) =>
      Number(professionCoreState(context).traitProcReadyAt.chillingNova || 0),
    setReadyAt: (context, readyAt) => {
      professionCoreState(context).traitProcReadyAt.chillingNova = readyAt;
    },
  },
  attribution: { kind: "trait", id: TRAIT.CHILLING_NOVA },
  handler: (context, event) => {
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
  },
});

function reactToDamage(
  context: NecromancerResolverContext,
  event: NecromancerResolverEvent,
  details: NecromancerResolverReactionDetails = {},
): void {
  resolveSummonIceFieldComboFinisher(context, event);
  chillingNovaCriticalHit.handler(context, event, details);
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
