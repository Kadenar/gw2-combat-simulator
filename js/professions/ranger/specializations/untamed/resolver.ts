import { enqueueOrdered } from "../../../../platform/engine/event-queue.js";
import { hasTrait } from "../../../../platform/gw2/trait-state.js";
import {
  RANGER_SKILL_IDS as ID,
  RANGER_TRAIT_IDS as TRAIT,
} from "../../data/ids.js";
import type {
  RangerResolverContext,
  RangerResolverEvent,
} from "../../types.js";
import { untamedState } from "./state.js";

const AMBUSH_SKILL_IDS = new Set<number>([ID.RELENTLESS_WHIRL, ID.DEFT_STRIKE]);

export function handleUntamedState(
  context: RangerResolverContext,
  event: RangerResolverEvent,
): void {
  // Sync the resolver's independent copy of rangerUnleashed from the scheduler-emitted event.
  untamedState.from(context).rangerUnleashed = event.rangerUnleashed === true;
}

export const untamedEventHandlers = Object.freeze({
  "ranger.untamed-state": handleUntamedState,
});

// Floating-point guard: prevents a cooldown check from failing due to sub-nanosecond rounding.
function epsilon(context: RangerResolverContext): number {
  return Number(context.epsilon || 1e-9);
}

function isPetStrike(event: RangerResolverEvent): boolean {
  return event.source === "ranger-pet";
}

function isPlayerStrike(event: RangerResolverEvent): boolean {
  return event.actorType === "player" && !isPetStrike(event);
}

function queueTraitBuff(
  context: RangerResolverContext,
  event: RangerResolverEvent,
  kind: string,
  duration: number,
  stacks: number,
  sourceId: number,
  name: string,
  party = false,
): void {
  enqueueOrdered(context.queue, {
    type: "buff",
    at: event.at,
    source: "Trait",
    sourceId,
    actorType: "effect",
    skillId: sourceId,
    skillName: name,
    name: `${name} - ${kind}`,
    kind,
    duration,
    stacks,
    ...(party ? { recipients: "party", maximumRecipients: 5 } : {}),
    triggeredBy: event.skillName,
  });
}

function queueTraitCondition(
  context: RangerResolverContext,
  event: RangerResolverEvent,
  condition: string,
  duration: number,
  stacks: number,
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
    name: `${name} - ${condition}`,
    condition,
    duration,
    stacks,
    triggeredBy: event.skillName,
  });
}

function triggerFerociousSymbiosis(
  context: RangerResolverContext,
  event: RangerResolverEvent,
): void {
  if (!hasTrait(context, TRAIT.FEROCIOUS_SYMBIOSIS)) return;
  const state = untamedState.from(context);
  if (isPlayerStrike(event)) {
    if (event.at + epsilon(context) < state.ferociousSymbiosisPetReadyAt)
      return;
    // A player hit builds Pet stacks (cross-buff: player hits power the pet).
    state.ferociousSymbiosisPetStacks =
      event.at < state.ferociousSymbiosisPetUntil
        ? Math.min(5, state.ferociousSymbiosisPetStacks + 1)
        : 1;
    state.ferociousSymbiosisPetUntil = event.at + 5;
    state.ferociousSymbiosisPetReadyAt = event.at + 0.5;
  } else if (isPetStrike(event)) {
    if (event.at + epsilon(context) < state.ferociousSymbiosisPlayerReadyAt)
      return;
    // A pet hit builds Player stacks (cross-buff: pet hits power the player).
    state.ferociousSymbiosisPlayerStacks =
      event.at < state.ferociousSymbiosisPlayerUntil
        ? Math.min(5, state.ferociousSymbiosisPlayerStacks + 1)
        : 1;
    state.ferociousSymbiosisPlayerUntil = event.at + 5;
    state.ferociousSymbiosisPlayerReadyAt = event.at + 0.5;
  }
}

function triggerLetLoose(
  context: RangerResolverContext,
  event: RangerResolverEvent,
): void {
  if (
    !hasTrait(context, TRAIT.LET_LOOSE) ||
    // Let Loose only procs on the two ambush skills (Relentless Whirl, Deft Strike).
    !AMBUSH_SKILL_IDS.has(Number(event.skillId)) ||
    // activationId is absent on synthetic events; guard prevents double-counting.
    !event.activationId
  ) {
    return;
  }
  const activations = untamedState.from(context).letLooseActivations;
  // Each ambush activation grants boons exactly once even if the skill hits multiple times.
  if (activations[event.activationId]) return;
  activations[event.activationId] = true;
  queueTraitBuff(
    context,
    event,
    "quickness",
    5,
    1,
    TRAIT.LET_LOOSE,
    "Let Loose",
    true,
  );
  queueTraitBuff(
    context,
    event,
    "might",
    10,
    5,
    TRAIT.LET_LOOSE,
    "Let Loose",
    true,
  );
}

function triggerBlindingOutburst(
  context: RangerResolverContext,
  event: RangerResolverEvent,
): void {
  if (
    event.skillId !== ID.VENOMOUS_OUTBURST ||
    !hasTrait(context, TRAIT.BLINDING_OUTBURST)
  ) {
    return;
  }
  queueTraitCondition(
    context,
    event,
    "Blindness",
    2,
    1,
    TRAIT.BLINDING_OUTBURST,
    "Blinding Outburst",
  );
}

export function reactToUntamedDamage(
  context: RangerResolverContext,
  event: RangerResolverEvent,
): void {
  if (
    // Only hitting strikes (coefficient > 0) advance trait state; misses and barrier hits are excluded.
    !(Number(event.coefficient) > 0) ||
    (!isPlayerStrike(event) && !isPetStrike(event))
  ) {
    return;
  }
  triggerBlindingOutburst(context, event);
  triggerFerociousSymbiosis(context, event);
  // Let Loose is player-only; pet hits cannot trigger it.
  if (isPlayerStrike(event)) triggerLetLoose(context, event);
}

export function reactToUntamedControl(
  context: RangerResolverContext,
  event: RangerResolverEvent,
): void {
  if (!isPlayerStrike(event) && !isPetStrike(event)) return;
  const state = untamedState.from(context);
  if (
    hasTrait(context, TRAIT.DEBILITATING_BLOWS) &&
    event.at + epsilon(context) >= state.debilitatingBlowsReadyAt
  ) {
    state.debilitatingBlowsReadyAt = event.at + 1;
    // Unleash state determines which condition is applied: Poisoned when Ranger unleashed, Slow otherwise.
    if (state.rangerUnleashed) {
      queueTraitCondition(
        context,
        event,
        "Poisoned",
        5,
        2,
        TRAIT.DEBILITATING_BLOWS,
        "Debilitating Blows",
      );
    } else {
      queueTraitCondition(
        context,
        event,
        "Slow",
        2,
        2,
        TRAIT.DEBILITATING_BLOWS,
        "Debilitating Blows",
      );
    }
  }
  if (
    hasTrait(context, TRAIT.ENHANCING_IMPACT) &&
    event.at + epsilon(context) >= state.enhancingImpactReadyAt
  ) {
    state.enhancingImpactReadyAt = event.at + 1;
    // Unleash state determines the boon: Quickness when Ranger unleashed, Stability otherwise.
    queueTraitBuff(
      context,
      event,
      state.rangerUnleashed ? "quickness" : "stability",
      3,
      1,
      TRAIT.ENHANCING_IMPACT,
      "Enhancing Impact",
    );
  }
}
