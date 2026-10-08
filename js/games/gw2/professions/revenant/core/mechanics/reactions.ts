import type { Gw2ResolverEvent } from '#gw2/platform/resolver/types.js';
import type { RevenantRuntime } from '#gw2/professions/revenant/core/events.js';
import { consumeBattleScar } from '#gw2/professions/revenant/core/mechanics/battle-scars.js';
import { enchantedDaggers } from '#gw2/professions/revenant/core/skills/legends/assassin.js';
import { exposeDefenses, thrillOfCombat } from '#gw2/professions/revenant/core/traits/devastation/battle-scars.js';
import { viciousReprisal } from '#gw2/professions/revenant/core/traits/retribution/index.js';

/** Landed player strikes interleave trait rewards, Battle Scars, and Enchanted Daggers in their established order. */
export function reactRevenantPlayerStrike(runtime: RevenantRuntime, event: Gw2ResolverEvent): void {
  if (event.actorType !== 'player' || !((event.coefficient || 0) > 0)) return;
  thrillOfCombat(runtime, event);
  consumeBattleScar(runtime, event);
  viciousReprisal(runtime, event);
  exposeDefenses(runtime, event);
  enchantedDaggers(runtime, event);
}
