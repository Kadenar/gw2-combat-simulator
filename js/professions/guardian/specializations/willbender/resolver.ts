import { enqueueOrdered } from "../../../../platform/engine/event-queue.js";
import { professionCoreState } from "../../../../platform/engine/profession.js";
import { hasTrait } from "../../../../platform/gw2/trait-state.js";
import {
  GUARDIAN_SKILL_IDS as ID,
  GUARDIAN_TRAIT_IDS,
} from "../../data/ids.js";
import { guardianTraitIcon } from "../../core/traits.js";
import type {
  GuardianResolverContext,
  GuardianResolverEvent,
} from "../../types.js";
import { gainLethalTempo } from "./mechanics.js";
import { willbenderState } from "./state.js";

function recordLethalTempo(
  context: GuardianResolverContext,
  at: number,
  sourceSkill: string | undefined,
): void {
  const state = willbenderState.from(context);
  const stacks = gainLethalTempo(
    state,
    at,
    hasTrait(context, GUARDIAN_TRAIT_IDS.TYRANTS_MOMENTUM),
  );
  context.recordProc(
    "trait",
    "Lethal Tempo",
    at,
    sourceSkill,
    `${stacks}/5 stacks`,
    guardianTraitIcon(GUARDIAN_TRAIT_IDS.LETHAL_TEMPO),
  );
}

function handleWillbenderVirtueActivation(
  context: GuardianResolverContext,
  event: GuardianResolverEvent,
): void {
  const virtue = event.virtue;
  if (!virtue) return;
  const state = willbenderState.from(context);
  if (state.flameVirtue !== virtue) state.flameGeneration += 1;
  state.flameVirtue = virtue;
  state.virtueHitCounts[virtue] = 0;
  const until = event.at + Number(event.duration || 0);
  if (virtue === "justice") state.justiceUntil = until;
  if (virtue === "resolve") state.resolveUntil = until;
  if (virtue === "courage") state.courageUntil = until;
  recordLethalTempo(context, event.at, event.skillName);
}

function handleWillbenderVirtueTrigger(
  context: GuardianResolverContext,
  event: GuardianResolverEvent,
): void {
  const virtue = event.virtue;
  if (!virtue) return;
  const state = willbenderState.from(context);
  state.triggeredVirtueEffects += 1;
  recordLethalTempo(context, event.at, event.sourceSkill as string | undefined);
  if (virtue !== "justice") return;
  const active = event.justiceActive !== false;
  const core = professionCoreState(context);
  core.justiceBurns += 1;
  if (active) core.justiceActiveBurns += 1;
  else core.justicePassiveBurns += 1;
  enqueueOrdered(context.queue, {
    type: "condition",
    at: event.at,
    priority: 5,
    source: "guardian",
    sourceId: "guardian.justice-passive",
    actorType: "player",
    skillId: ID.WILLBENDER_JUSTICE,
    skillName: "Justice",
    name: `Justice — ${active ? "Active" : "Passive"} Burning`,
    icon: context.helpers.skillsById?.get(ID.RUSHING_JUSTICE)?.icon || "",
    condition: "Burning",
    stacks: 1,
    duration: Number(event.burningDuration || 2),
    triggeredBy: event.sourceSkill,
  });
}

export const willbenderEventHandlers = Object.freeze({
  "guardian.willbender-virtue-activated": handleWillbenderVirtueActivation,
  "guardian.willbender-virtue-triggered": handleWillbenderVirtueTrigger,
});
