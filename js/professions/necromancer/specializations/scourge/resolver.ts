import { professionCoreState } from '../../../../platform/engine/profession.js';
import { isInternalCooldownReady } from '../../../../platform/engine/clock.js';
import { hasTrait } from '../../../../platform/gw2/trait-state.js';
import { NECROMANCER_TRAIT_IDS as TRAIT } from '../../data/ids.js';
import { applyTraitCondition } from '../../core/traits.js';
import type {
  NecromancerResolverContext,
  NecromancerResolverEvent,
  NecromancerResolverReactionDetails
} from '../../types.js';
import { balanceProfileEffect, necromancerBalanceProfile } from '../../core/profiles.js';
import { SCOURGE_BALANCE_PROFILE_IDS as PROFILE } from './profiles.js';

function reactToCondition(
  context: NecromancerResolverContext,
  event: NecromancerResolverEvent,
  details: NecromancerResolverReactionDetails = {}
): void {
  // Only Torment triggers Demonic Lore — all other conditions are ignored here
  if (
    event.condition !== 'Torment' ||
    !hasTrait(context, TRAIT.DEMONIC_LORE) ||
    !isInternalCooldownReady(event.at, Number(professionCoreState(context).demonicLoreReadyAt || 0))
  ) {
    return;
  }
  const profile = necromancerBalanceProfile(context, PROFILE.demonicLore);
  const effect = balanceProfileEffect(profile, 'condition');
  // Advance the ICD before applying the condition so re-entrant Torment events
  // within the same tick cannot double-proc
  professionCoreState(context).demonicLoreReadyAt = event.at + Number(profile?.cooldown || 3);
  applyTraitCondition(details, context, event, {
    name: 'Demonic Lore',
    traitId: TRAIT.DEMONIC_LORE,
    condition: String(effect?.condition || 'Burning'),
    stacks: Number(effect?.stacks || 1),
    duration: Number(effect?.duration || 1)
  });
}

export const scourgeResolverEventReactions = Object.freeze({
  condition: reactToCondition
});
