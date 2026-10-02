import type { RevenantSkill } from '#gw2/professions/revenant/types.js';
import type { Gw2ResolverEvent } from '#gw2/platform/resolver/types.js';
import type { RuntimeCast } from '#gw2/platform/simulation/runtime-state.js';
import type { RevenantRuntime } from '#gw2/professions/revenant/core/events.js';
import { consumeBattleScar } from '#gw2/professions/revenant/core/mechanics/battle-scars.js';
import { enchantedDaggers } from '#gw2/professions/revenant/core/mechanics/enchanted-daggers.js';
import {
  completeBattleScarred,
  completeNotoriety,
  completeSereneRejuvenation,
  exposeDefenses,
  invokeInvokersRage,
  invokeSongOfTheMists,
  invokeSpiritBoon,
  invokeTorment,
  reactAbyssalChill,
  reactDanceOfDeath,
  thrillOfCombat,
  viciousReprisal
} from '#gw2/professions/revenant/core/traits/behavior.js';

// A skill action may need pre-transition traits; the common observer must not grant them twice.
const completedCastTraits = new WeakSet<RuntimeCast<RevenantSkill>>();

/** Committed casts grant completion rewards even when shortened; cancelled reservations grant nothing. */
export function completeRevenantCastTraits(runtime: RevenantRuntime, cast: RuntimeCast<RevenantSkill>): void {
  if (completedCastTraits.has(cast)) return;
  completedCastTraits.add(cast);
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

/** Landed player strikes drive Core on-hit traits in their established order. */
export function reactRevenantPlayerStrike(runtime: RevenantRuntime, event: Gw2ResolverEvent): void {
  if (event.actorType !== 'player' || !((event.coefficient || 0) > 0)) return;
  thrillOfCombat(runtime, event);
  consumeBattleScar(runtime, event);
  viciousReprisal(runtime, event);
  exposeDefenses(runtime, event);
  enchantedDaggers(runtime, event);
}
