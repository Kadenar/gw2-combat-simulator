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
import {
  guardianBalanceProfile,
  guardianBalanceProfileEffect,
} from "../../core/profiles.js";
import { WILLBENDER_BALANCE_PROFILE_IDS as PROFILE } from "./profiles.js";

function recordLethalTempo(
  context: GuardianResolverContext,
  at: number,
  sourceSkill: string | undefined,
): void {
  const state = willbenderState.from(context);
  const tyrantsMomentum = hasTrait(
    context,
    GUARDIAN_TRAIT_IDS.TYRANTS_MOMENTUM,
  );
  const lethalTempo = guardianBalanceProfile(context, PROFILE.lethalTempo);
  const stacks = gainLethalTempo(
    state,
    at,
    tyrantsMomentum,
    Number(lethalTempo?.maximumStacks || 5),
    Number(
      guardianBalanceProfileEffect(
        guardianBalanceProfile(
          context,
          tyrantsMomentum ? PROFILE.tyrantsMomentum : PROFILE.lethalTempo,
        ),
        "buff",
      )?.duration || (tyrantsMomentum ? 4 : 6),
    ),
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
  if (state.flameVirtue !== virtue) state.flameGeneration += 1; // different virtue = new flame run, so pulse tasks keyed on the old generation are ignored
  state.flameVirtue = virtue;
  // Resolver state is seeded from scratch, so hit counts from the scheduler phase
  // may be stale if the virtue window already lapsed by the time this event arrives.
  if (state[`${virtue}Until`] <= event.at + Number(context.epsilon ?? 1e-9)) {
    state.virtueHitCounts[virtue] = 0;
  }
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
  // Burning is enqueued into the resolver's condition queue rather than emitted
  // directly so it respects the condition-application ordering alongside other burns.
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
    icon: context.helpers.skillsById?.get(ID.RUSHING_JUSTICE)?.icon || "", // WILLBENDER_JUSTICE has no icon; Rushing Justice shares the same visual in-game

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
