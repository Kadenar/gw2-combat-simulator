import { claimActivation } from '#gw2/platform/combat/procs/activation-claims.js';
import type { RuntimeCast } from '#gw2/platform/execution/cast-contracts.js';
import type { Gw2ResolverEvent } from '#gw2/platform/resolver/types.js';
import type { RevenantRuntime } from '#gw2/professions/revenant/core/events.js';
import { invokeTorment, reactAbyssalChill } from '#gw2/professions/revenant/core/traits/corruption/behavior.js';
import {
  completeBattleScarred,
  reactDanceOfDeath
} from '#gw2/professions/revenant/core/traits/devastation/battle-scars.js';
import { completeNotoriety } from '#gw2/professions/revenant/core/traits/devastation/cast-rewards.js';
import {
  invokeInvokersRage,
  invokeSongOfTheMists,
  invokeSpiritBoon
} from '#gw2/professions/revenant/core/traits/invocation/behavior.js';
import { completeSereneRejuvenation } from '#gw2/professions/revenant/core/traits/salvation/index.js';
import type { RevenantSkill } from '#gw2/professions/revenant/types.js';

/** Committed casts grant completion rewards even when shortened; cancelled reservations grant nothing. */
export function completeRevenantCastTraits(runtime: RevenantRuntime, cast: RuntimeCast<RevenantSkill>): void {
  // A skill action may grant pre-transition rewards before the common completion observer.
  if (!claimActivation(runtime.profession.core.activationClaims, 'revenant.cast-traits', cast.id)) return;
  completeBattleScarred(runtime, cast);

  completeNotoriety(runtime, cast);

  // Grant only the boon belonging to the committed Centaur skill; toggling off the shield grants nothing.
  completeSereneRejuvenation(runtime, cast);
}

/** Core owns invocation traits for every legend; Entity inherits the paired legend's package. */
export function applyRevenantInvocationTraits(runtime: RevenantRuntime): void {
  if (!runtime.combatStartedAt()) return;
  // Every in-combat invocation grants Fury; Invoker's Rage no longer has an internal cooldown.
  invokeInvokersRage(runtime);
  invokeSpiritBoon(runtime);
  invokeSongOfTheMists(runtime);

  invokeTorment(runtime);
}

/** Accepted Chilled and Vulnerability applications drive Abyssal Chill and Dance of Death. */
export function reactRevenantConditionTraits(runtime: RevenantRuntime, event: Gw2ResolverEvent): void {
  reactAbyssalChill(runtime, event);

  reactDanceOfDeath(runtime, event);
}
