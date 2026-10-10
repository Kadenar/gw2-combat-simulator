import { revenantStruck, battleScarConsumed } from '#gw2/professions/revenant/core/mechanics/boundaries.js';
import type { Gw2ResolverEvent } from '#gw2/platform/resolver/types.js';
import type { RevenantRuntime } from '#gw2/professions/revenant/core/events.js';
import { consumeBattleScar } from '#gw2/professions/revenant/core/mechanics/battle-scars.js';
import { enchantedDaggers } from '#gw2/professions/revenant/core/skills/legends/assassin.js';

/** Landed player strikes interleave trait rewards, Battle Scars, and Enchanted Daggers in their established order. */
export function reactRevenantPlayerStrike(runtime: RevenantRuntime, event: Gw2ResolverEvent): void {
  if (event.actorType !== 'player' || !((event.coefficient || 0) > 0)) return;
  runtime.fireTrigger(revenantStruck, { cause: event });
  consumeBattleScar(runtime, event);
  runtime.fireTrigger(battleScarConsumed, { cause: event });
  enchantedDaggers(runtime, event);
}
