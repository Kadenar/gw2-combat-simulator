import { professionCoreState } from "../../../../platform/engine/profession.js";
/** Soulbeast resolver-phase reactions and event handlers. */
import { enqueueOrdered } from "../../../../platform/engine/event-queue.js";
import { hasTrait } from "../../../../platform/gw2/trait-state.js";
import type { Gw2TimedBuffApplication } from "../../../../platform/gw2/types.js";
import {
  RANGER_SKILL_IDS as ID,
  RANGER_TRAIT_IDS as TRAIT,
} from "../../data/ids.js";
import type {
  RangerResolverContext,
  RangerResolverEvent,
} from "../../types.js";
import { rangerPetByName } from "../../core/state.js";
import { soulbeastState } from "./state.js";

export function handleSoulbeastModeEvent(
  context: RangerResolverContext,
  event: RangerResolverEvent,
): void {
  soulbeastState.from(context).beastmodeActive = event.active === true;
}

export function handleRangerBoonExtension(
  context: RangerResolverContext,
  event: RangerResolverEvent,
): void {
  const boons = new Set([
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
  const extension = Math.max(0, Number(event.duration || 0));
  const excluded = String(event.excludedKind || "");
  if (!(extension > 0)) return;
  for (const [kind, applications] of context.boons) {
    if (!boons.has(kind) || kind === excluded) continue;
    for (const application of applications) {
      if (
        application.affectsSelf !== false &&
        application.at <= event.at &&
        application.expiresAt > event.at
      ) {
        (application as { expiresAt: number }).expiresAt += extension;
      }
    }
  }
}

export const soulbeastEventHandlers = Object.freeze({
  "ranger.beastmode": handleSoulbeastModeEvent,
  "ranger.boon-extension": handleRangerBoonExtension,
});

export function activeSoulbeastBuff(
  context: RangerResolverContext,
  kind: string,
  at: number,
): boolean {
  return (context.boons.get(kind) || []).some(
    (application: Gw2TimedBuffApplication) =>
      application.at <= at &&
      application.expiresAt > at &&
      application.stacks > 0,
  );
}

export function queueSoulbeastBuff(
  context: RangerResolverContext,
  event: RangerResolverEvent,
  kind: string,
  duration: number,
  stacks: number,
  name: string,
  sourceId: number,
): void {
  enqueueOrdered(context.queue, {
    type: "buff",
    at: event.at,
    source: "Trait",
    sourceId,
    actorType: "effect",
    skillId: sourceId,
    skillName: name,
    name,
    kind,
    duration,
    stacks,
    triggeredBy: event.skillName,
  });
}

function firstBeastAbilityHit(
  context: RangerResolverContext,
  event: RangerResolverEvent,
): boolean {
  const activePet = rangerPetByName(professionCoreState(context).activePet);
  const beastSkillId = activePet.beastmodeSkillIds.at(-1);
  if (event.skillId !== beastSkillId || !event.activationId) return false;
  const activations = soulbeastState.from(context).beastAbilityActivations;
  if (activations[event.activationId]) return false;
  activations[event.activationId] = true;
  return true;
}

function queueCondition(
  context: RangerResolverContext,
  event: RangerResolverEvent,
  condition: string,
  duration: number,
  sourceId: number,
  name: string,
): void {
  enqueueOrdered(context.queue, {
    type: "condition",
    at: event.at,
    source: "Trait",
    sourceId,
    actorType: "effect",
    skillId: sourceId,
    skillName: name,
    name: `${name} — ${condition}`,
    condition,
    duration,
    stacks: 1,
    triggeredBy: event.skillName,
  });
}

export function reactToSoulbeastDamage(
  context: RangerResolverContext,
  event: RangerResolverEvent,
): void {
  if (!(Number(event.coefficient) > 0)) return;
  const state = soulbeastState.from(context);

  if (
    event.actorType !== "effect" &&
    event.sourceId !== ID.ONE_WOLF_PACK_STRIKE &&
    activeSoulbeastBuff(context, "one-wolf-pack", event.at) &&
    event.at >= state.oneWolfPackReadyAt
  ) {
    state.oneWolfPackReadyAt = event.at + 1;
    enqueueOrdered(context.queue, {
      type: "damage",
      at: event.at + 0.28,
      source: "ranger",
      sourceId: ID.ONE_WOLF_PACK_STRIKE,
      actorType: "effect",
      skillId: ID.ONE_WOLF_PACK,
      skillName: "One Wolf Pack",
      name: "One Wolf Pack",
      coefficient: 0.95,
      hits: 1,
      hitIndex: 1,
      totalHits: 1,
      skillWeapon: event.skillWeapon || "Unequipped",
      weaponStrengthProfileId: event.weaponStrengthProfileId,
      canCrit: true,
      triggeredBy: event.skillName,
    });
  }

  if (
    activeSoulbeastBuff(context, "vulture-stance", event.at) &&
    event.at >= state.vultureStanceReadyAt &&
    event.actorType !== "effect"
  ) {
    state.vultureStanceReadyAt = event.at + 0.25;
    queueCondition(
      context,
      event,
      "Poisoned",
      4,
      ID.VULTURE_STANCE,
      "Vulture Stance",
    );
    queueSoulbeastBuff(
      context,
      event,
      "might",
      4,
      1,
      "Vulture Stance",
      ID.VULTURE_STANCE,
    );
  }

  if (!firstBeastAbilityHit(context, event)) return;
  if (hasTrait(context, TRAIT.LIVE_FAST)) {
    queueSoulbeastBuff(
      context,
      event,
      "fury",
      6,
      1,
      "Live Fast",
      TRAIT.LIVE_FAST,
    );
    queueSoulbeastBuff(
      context,
      event,
      "quickness",
      3,
      1,
      "Live Fast",
      TRAIT.LIVE_FAST,
    );
  }
  if (hasTrait(context, TRAIT.WILTING_STRIKE)) {
    queueCondition(
      context,
      event,
      "Weakness",
      4,
      TRAIT.WILTING_STRIKE,
      "Wilting Strike",
    );
  }
  if (
    hasTrait(context, TRAIT.GO_FOR_THE_EYES) &&
    event.at >= state.goForTheEyesReadyAt
  ) {
    state.goForTheEyesReadyAt = event.at + 12;
    enqueueOrdered(context.queue, {
      type: "blind",
      at: event.at,
      source: "Trait",
      sourceId: TRAIT.GO_FOR_THE_EYES,
      actorType: "effect",
      skillId: TRAIT.GO_FOR_THE_EYES,
      skillName: "Go for the Eyes",
      duration: 5,
      triggeredBy: event.skillName,
    });
  }
  if (
    hasTrait(context, TRAIT.GO_FOR_THE_THROAT) &&
    event.at >= state.goForTheThroatReadyAt
  ) {
    state.goForTheThroatReadyAt = event.at + 10;
    context.recordProc(
      "trait",
      'Lesser "Sic \'Em!"',
      event.at,
      event.skillName,
      "5s, +15% strike damage",
      context.helpers.skillsById?.get(ID.LESSER_SIC_EM)?.icon ||
        context.helpers.skillsById?.get(ID.SIC_EM)?.icon ||
        "",
    );
    queueSoulbeastBuff(
      context,
      event,
      "lesser-sic-em",
      5,
      1,
      'Lesser "Sic \'Em!"',
      ID.LESSER_SIC_EM,
    );
  }
}

export function reactToSoulbeastControl(
  context: RangerResolverContext,
  event: RangerResolverEvent,
): void {
  const state = soulbeastState.from(context);
  if (hasTrait(context, TRAIT.TWICE_AS_VICIOUS)) {
    queueSoulbeastBuff(
      context,
      event,
      "twice-as-vicious",
      10,
      1,
      "Twice as Vicious",
      TRAIT.TWICE_AS_VICIOUS,
    );
  }
  if (
    hasTrait(context, TRAIT.BESTIAL_RAGE) &&
    event.at >= state.bestialRageReadyAt
  ) {
    state.bestialRageReadyAt = event.at + 0.25;
    queueSoulbeastBuff(
      context,
      event,
      "might",
      8,
      5,
      "Bestial Rage",
      TRAIT.BESTIAL_RAGE,
    );
    queueSoulbeastBuff(
      context,
      event,
      "fury",
      3,
      1,
      "Bestial Rage",
      TRAIT.BESTIAL_RAGE,
    );
  }
}

export function reactToSoulbeastCondition(
  context: RangerResolverContext,
  event: RangerResolverEvent,
): void {
  if (
    event.condition !== "Poisoned" ||
    !hasTrait(context, TRAIT.PREDATORS_CUNNING)
  ) {
    return;
  }
  enqueueOrdered(context.queue, {
    type: "damage",
    at: event.at,
    source: "Trait",
    sourceId: TRAIT.PREDATORS_CUNNING,
    actorType: "effect",
    skillId: TRAIT.PREDATORS_CUNNING,
    skillName: "Predator's Cunning",
    name: "Predator's Cunning",
    coefficient: 0.006,
    hits: 1,
    hitIndex: 1,
    totalHits: 1,
    skillWeapon: "Unequipped",
    canCrit: false,
    triggeredBy: event.skillName,
  });
}

export function reactToSoulbeastBuff(
  context: RangerResolverContext,
  event: RangerResolverEvent,
): void {
  const state = soulbeastState.from(context);
  if (
    event.kind !== "quickness" ||
    !hasTrait(context, TRAIT.ESSENCE_OF_SPEED) ||
    event.at < state.essenceOfSpeedReadyAt
  ) {
    return;
  }
  state.essenceOfSpeedReadyAt = event.at + 5;
  enqueueOrdered(context.queue, {
    type: "ranger.boon-extension",
    at: event.at,
    source: "Trait",
    sourceId: TRAIT.ESSENCE_OF_SPEED,
    actorType: "effect",
    skillId: TRAIT.ESSENCE_OF_SPEED,
    skillName: "Essence of Speed",
    duration: 2,
    excludedKind: "quickness",
  });
}

export function reactToRangerWinterBite(
  context: RangerResolverContext,
  event: RangerResolverEvent,
): void {
  const core = professionCoreState(context);
  if (
    !core.winterBiteReady ||
    event.sourceId === ID.WINTERS_BITE ||
    event.actorType === "effect"
  ) {
    return;
  }
  core.winterBiteReady = false;
  queueCondition(
    context,
    event,
    "Weakness",
    10,
    ID.WINTERS_BITE,
    "Winter's Bite",
  );
}
