import { enqueueOrdered } from "../../../../platform/engine/event-queue.js";
import { hasTrait } from "../../../../platform/gw2/trait-state.js";
import { ENGINEER_TRAIT_IDS as TRAIT } from "../../data/ids.js";
import {
  activeBoonStacks,
  procState,
  queueBuff,
  recordTrait,
} from "../../core/resolver.js";
import { SCRAPPER_MASS_MOMENTUM } from "./mechanics.js";
import type {
  EngineerResolverContext,
  EngineerResolverEvent,
} from "../../types.js";

function scheduleMassMomentumPulse(
  context: EngineerResolverContext,
  at: number,
): void {
  const state = procState(context);
  const scheduledAt = Number(state.massMomentumPulseAt || 0);
  if (scheduledAt > 0 && scheduledAt <= at + 1e-9) return;
  state.massMomentumPulseAt = at;
  enqueueOrdered(context.queue, {
    type: "engineer.mass-momentum-pulse",
    at,
    source: "Trait",
    sourceId: TRAIT.MASS_MOMENTUM,
    actorType: "effect",
  });
}

function triggerMassMomentum(
  context: EngineerResolverContext,
  event: EngineerResolverEvent,
): void {
  if (
    !hasTrait(context, TRAIT.MASS_MOMENTUM)
    || activeBoonStacks(context, "stability", 1, event.at) === 0
  ) return;
  const state = procState(context);
  if (Number(state.massMomentum || 0) <= event.at) {
    state.massMomentum = event.at + SCRAPPER_MASS_MOMENTUM.pulseInterval;
    queueBuff(context, event, {
      name: "Mass Momentum",
      kind: "might",
      stacks: 1,
      duration: SCRAPPER_MASS_MOMENTUM.boonDuration,
      sourceId: TRAIT.MASS_MOMENTUM,
      actorType: "effect",
    });
    recordTrait(context, "Mass Momentum", event);
  }
  scheduleMassMomentumPulse(
    context,
    Math.max(
      event.at + SCRAPPER_MASS_MOMENTUM.pulseInterval,
      Number(state.massMomentum || 0),
    ),
  );
}

function handleMassMomentumPulse(
  context: EngineerResolverContext,
  event: EngineerResolverEvent,
): void {
  const state = procState(context);
  if (
    Math.abs(Number(state.massMomentumPulseAt || 0) - event.at) <= 1e-9
  ) {
    state.massMomentumPulseAt = 0;
  }
  triggerMassMomentum(context, event);
}

function reactToScrapperDamage(
  context: EngineerResolverContext,
  event: EngineerResolverEvent,
): void {
  if (Number(event.coefficient) > 0) triggerMassMomentum(context, event);
}

function reactToScrapperBuff(
  context: EngineerResolverContext,
  event: EngineerResolverEvent,
): void {
  const kind = String(event.kind || "").toLowerCase();
  if (
    kind === "might"
    && hasTrait(context, TRAIT.APPLIED_FORCE)
    && activeBoonStacks(context, "might", 25, event.at) >= 10
  ) {
    const state = procState(context);
    if (Number(state.appliedForce || 0) <= event.at) {
      state.appliedForce = event.at + 10;
      queueBuff(context, event, {
        name: "Applied Force",
        kind: "stability",
        stacks: 1,
        duration: 3,
        sourceId: TRAIT.APPLIED_FORCE,
        actorType: "effect",
      });
      recordTrait(context, "Applied Force", event);
    }
  }
  if (kind === "stability") triggerMassMomentum(context, event);
}

export const scrapperResolverEventHandlers = Object.freeze({
  "engineer.mass-momentum-pulse": handleMassMomentumPulse,
});

export const scrapperResolverEventReactions = Object.freeze({
  damage: reactToScrapperDamage,
  buff: reactToScrapperBuff,
});
