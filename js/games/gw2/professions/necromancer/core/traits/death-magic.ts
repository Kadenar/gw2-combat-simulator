import {
  requireBalanceProfileFromContext,
  balanceProfileNumber
} from '#gw2/platform/engine/skills/balance-profiles.js';
/** Owns imperative Core Necromancer Death Magic trait behavior for ordered dispatcher calls. */

import { hasTrait } from '#gw2/platform/combat/state/traits.js';
import { professionCoreState } from '#gw2/platform/engine/profession/state.js';

import { NECROMANCER_TRAIT_IDS as TRAIT } from '#gw2/professions/necromancer/data/ids.js';
import { addCarapace } from '#gw2/professions/necromancer/core/mechanics/state-helpers.js';
import type { NecromancerResolverContext, NecromancerResolverEvent } from '#gw2/professions/necromancer/types.js';

export function applyCorruptorsFervor(context: NecromancerResolverContext, event: NecromancerResolverEvent): void {
  if (event.actorType === 'summon' || !hasTrait(context, TRAIT.CORRUPTERS_FERVOR)) return;
  addCarapace(
    professionCoreState(context),
    balanceProfileNumber(requireBalanceProfileFromContext(context, TRAIT.CORRUPTERS_FERVOR), 'resourceGain'),
    event.at,
    balanceProfileNumber(requireBalanceProfileFromContext(context, TRAIT.CORRUPTERS_FERVOR), 'duration')
  );
}
