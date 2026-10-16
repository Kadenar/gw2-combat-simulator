import type { RuntimeCast } from '#gw2/platform/execution/cast-contracts.js';
import { defineTriggerPoint } from '#gw2/platform/profession-definition/trigger-points.js';
import type { Gw2ResolverEvent } from '#gw2/platform/resolver/types.js';
import { WARRIOR_TRAIT_IDS as TRAIT } from '#gw2/professions/warrior/data/ids.js';
import type { WarriorSkill } from '#gw2/professions/warrior/types.js';

/** Completed ammunition rewards use the spend captured before the magazine transaction. */
export const ammunitionCommitted = defineTriggerPoint<{
  readonly cast: RuntimeCast<WarriorSkill>;
  readonly spent: { readonly rounds: number; readonly startedFull: boolean };
}>('warrior.ammunition-committed', [TRAIT.FIERCE_AS_FIRE, TRAIT.LUSH_FOREST]);

/** Explosion Glory extends before cartridge effects inspect the accepted strike. */
export const explosionAccepted = defineTriggerPoint<{ readonly event: Gw2ResolverEvent }>(
  'warrior.explosion-accepted',
  [TRAIT.GUNS_AND_GLORY]
);
