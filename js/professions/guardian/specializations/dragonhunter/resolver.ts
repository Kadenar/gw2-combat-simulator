import { enqueueOrdered } from "../../../../platform/engine/event-queue.js";
import { professionCoreState } from "../../../../platform/engine/profession.js";
import { isGw2PlayerActorEvent } from "../../../../platform/gw2/event-ownership.js";
import {
  GUARDIAN_SKILL_IDS as ID,
  GUARDIAN_TRAIT_IDS,
} from "../../data/ids.js";
import { guardianTraitIcon, hasGuardianTrait } from "../../core/traits.js";
import { reactToJusticeHitWithOptions } from "../../core/virtues.js";
import type { Gw2ConditionResolution } from "../../../../platform/gw2/types.js";
import type {
  GuardianResolverContext,
  GuardianResolverEvent,
} from "../../types.js";
import { dragonhunterState } from "./state.js";

interface ConditionDependencies {
  readonly applyCondition?: Gw2ConditionResolution["applyCondition"];
}

function handleTetherApplied(
  context: GuardianResolverContext,
  event: GuardianResolverEvent,
): void {
  dragonhunterState.from(context).tetherUntil = Number(
    event.tetherUntil || event.at,
  );
}

function handleTetherBroken(
  context: GuardianResolverContext,
  event: GuardianResolverEvent,
): void {
  dragonhunterState.from(context).tetherUntil = event.at;
}

function handleJusticePulse(
  context: GuardianResolverContext,
  event: GuardianResolverEvent,
): void {
  if (
    dragonhunterState.from(context).tetherUntil <
    event.at - Number(context.epsilon || 0.0001)
  ) {
    return;
  }
  enqueueOrdered(context.queue, {
    type: "condition",
    at: event.at,
    source: "guardian",
    sourceId: ID.SPEAR_OF_JUSTICE,
    actorType: "player",
    skillId: ID.SPEAR_OF_JUSTICE,
    skillName: "Spear of Justice",
    name: "Spear of Justice — Active Burning",
    condition: "Burning",
    stacks: 1,
    duration: 2,
    applicationIndex: event.applicationIndex,
    totalApplications: event.totalApplications,
  });
}

export function reactToDragonhunterJusticeHit(
  context: GuardianResolverContext,
  event: GuardianResolverEvent,
  dependencies: ConditionDependencies & { readonly hitContext?: object } = {},
): void {
  const core = professionCoreState(context);
  const passiveBefore = Number(core.justicePassiveBurns || 0);
  reactToJusticeHitWithOptions(context, event, dependencies, {
    retainsPassive: false,
    skillId: ID.SPEAR_OF_JUSTICE,
    skillName: "Spear of Justice",
  });

  if (
    Number(core.justicePassiveBurns || 0) > passiveBefore &&
    typeof dependencies.applyCondition === "function"
  ) {
    dependencies.applyCondition(context, {
      type: "condition",
      at: event.at,
      source: "guardian",
      sourceId: ID.SPEAR_OF_JUSTICE,
      actorType: "player",
      skillId: ID.SPEAR_OF_JUSTICE,
      skillName: "Spear of Justice",
      name: "Spear of Justice — Passive Crippled",
      condition: "Crippled",
      stacks: 1,
      duration: 1.5,
    });
  }

  if (
    !hasGuardianTrait(context, GUARDIAN_TRAIT_IDS.BIG_GAME_HUNTER) ||
    dragonhunterState.from(context).tetherUntil <= event.at ||
    !isGw2PlayerActorEvent(event) ||
    !(Number(event.coefficient || 0) > 0)
  ) {
    return;
  }
  enqueueOrdered(context.queue, {
    type: "buff",
    at: event.at,
    priority: 5,
    source: "guardian",
    sourceId: GUARDIAN_TRAIT_IDS.BIG_GAME_HUNTER,
    actorType: "effect",
    skillId: GUARDIAN_TRAIT_IDS.BIG_GAME_HUNTER,
    skillName: "Big Game Hunter",
    kind: "target-vulnerability",
    stacks: 1,
    duration: 10,
    triggeredBy: event.skillName,
  });
}

export function reactToDragonhunterControl(
  context: GuardianResolverContext,
  event: GuardianResolverEvent,
  { applyCondition }: ConditionDependencies = {},
): void {
  const state = dragonhunterState.from(context);
  if (
    hasGuardianTrait(context, GUARDIAN_TRAIT_IDS.DULLED_SENSES) &&
    typeof applyCondition === "function"
  ) {
    applyCondition(context, {
      type: "condition",
      at: event.at,
      source: "guardian",
      sourceId: GUARDIAN_TRAIT_IDS.DULLED_SENSES,
      actorType: "effect",
      skillId: GUARDIAN_TRAIT_IDS.DULLED_SENSES,
      skillName: "Dulled Senses",
      name: "Dulled Senses — Crippled",
      condition: "Crippled",
      stacks: 1,
      duration: 4,
    });
  }
  if (
    !hasGuardianTrait(context, GUARDIAN_TRAIT_IDS.HEAVY_LIGHT) ||
    event.at < state.heavyLightReadyAt - Number(context.epsilon || 0.0001)
  ) {
    return;
  }
  state.heavyLightReadyAt = event.at + 1;
  enqueueOrdered(context.queue, {
    type: "buff",
    at: event.at,
    priority: 5,
    source: "guardian",
    sourceId: GUARDIAN_TRAIT_IDS.HEAVY_LIGHT,
    actorType: "player",
    skillId: GUARDIAN_TRAIT_IDS.HEAVY_LIGHT,
    skillName: "Heavy Light",
    kind: "stability",
    stacks: 1,
    duration: 6,
  });
  context.recordProc(
    "trait",
    "Heavy Light",
    event.at,
    event.skillName,
    "Stability",
    guardianTraitIcon(GUARDIAN_TRAIT_IDS.HEAVY_LIGHT),
  );
}

export const dragonhunterEventHandlers = Object.freeze({
  "guardian.dragonhunter-tethered": handleTetherApplied,
  "guardian.dragonhunter-tether-broken": handleTetherBroken,
  "guardian.dragonhunter-justice-pulse": handleJusticePulse,
});

export const dragonhunterEventReactions = Object.freeze({
  damage: Object.freeze([
    {
      id: "guardian.dragonhunter.justice",
      order: 20,
      handler: reactToDragonhunterJusticeHit,
    },
  ]),
  control: Object.freeze([
    {
      id: "guardian.dragonhunter.control",
      order: 20,
      handler: reactToDragonhunterControl,
    },
  ]),
});
