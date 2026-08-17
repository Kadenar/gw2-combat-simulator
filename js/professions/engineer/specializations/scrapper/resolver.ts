import { enqueueOrdered } from "../../../../platform/engine/event-queue.js";
import { hasTrait } from "../../../../platform/gw2/trait-state.js";
import { ENGINEER_TRAIT_IDS as TRAIT } from "../../data/ids.js";
import {
  activeBoonStacks,
  procState,
  queueBuff,
  recordTrait,
} from "../../core/shared.js";
import {
  SCRAPPER_KINETIC_ACCELERATORS,
  SCRAPPER_MASS_MOMENTUM,
} from "./mechanics.js";
import { scrapperState } from "./state.js";
import type {
  EngineerResolverContext,
  EngineerResolverEvent,
} from "../../types.js";

// Deduplicates pulse events: if one is already scheduled at or before `at`, skip.
// massMomentumPulseAt tracks the timestamp of the outstanding pulse so stale ones are ignored.
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

// Grants 1 might if stability is active and the 1s ICD has elapsed, then reschedules the pulse.
function triggerMassMomentum(
  context: EngineerResolverContext,
  event: EngineerResolverEvent,
): void {
  if (
    !hasTrait(context, TRAIT.MASS_MOMENTUM) ||
    activeBoonStacks(context, "stability", 1, event.at) === 0
  )
    return;
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

// Clears the stale pulse sentinel, then re-checks stability to keep the loop alive.
function handleMassMomentumPulse(
  context: EngineerResolverContext,
  event: EngineerResolverEvent,
): void {
  const state = procState(context);
  if (Math.abs(Number(state.massMomentumPulseAt || 0) - event.at) <= 1e-9) {
    state.massMomentumPulseAt = 0;
  }
  triggerMassMomentum(context, event);
}

// Only real damage hits (coefficient > 0) trigger the pulse; 0-coeff events are skipped.
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
  // Applied Force (GM trait): reaching 10+ might stacks triggers 3s stability on a 10s ICD.
  if (
    kind === "might" &&
    hasTrait(context, TRAIT.APPLIED_FORCE) &&
    activeBoonStacks(context, "might", 25, event.at) >= 10
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
  // Any new stability buff (including the one Applied Force just queued) kicks the pulse loop.
  if (kind === "stability") triggerMassMomentum(context, event);
}

function reactToScrapperCombo(
  context: EngineerResolverContext,
  event: EngineerResolverEvent,
): void {
  if (
    !hasTrait(context, TRAIT.KINETIC_ACCELERATORS) ||
    !["Blast", "Leap", "Whirl"].includes(String(event.finisherType))
  ) {
    return;
  }
  const state = scrapperState.from(context);
  if (event.finisherType === "Whirl") {
    if (state.kineticAcceleratorsWhirlReadyAt > event.at + 1e-9) return;
    state.kineticAcceleratorsWhirlReadyAt =
      event.at + SCRAPPER_KINETIC_ACCELERATORS.whirlInternalCooldown;
  }
  // Boons are emitted by the scheduler's resolved-combo prediction so they
  // remain visible in the canonical result timeline. Resolver confirmation
  // owns only proc attribution and its independent whirl ICD state.
  recordTrait(context, "Kinetic Accelerators", event);
}

export const scrapperResolverEventHandlers = Object.freeze({
  "engineer.mass-momentum-pulse": handleMassMomentumPulse,
});

export const scrapperResolverEventReactions = Object.freeze({
  damage: reactToScrapperDamage,
  buff: reactToScrapperBuff,
  combo: reactToScrapperCombo,
});
