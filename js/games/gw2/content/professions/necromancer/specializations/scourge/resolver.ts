import { isInternalCooldownReady } from '../../../../../../../kernel/core/clock.js';
import { hasTrait } from '../../../../../platform/combat/state/traits.js';
import { NECROMANCER_TRAIT_IDS as TRAIT } from '../../data/ids.js';
import { applyTraitCondition } from '../../core/traits.js';
import type { NecromancerResolverContext, NecromancerResolverEvent } from '../../types.js';
import { balanceProfileEffect, necromancerBalanceProfile } from '../../core/profiles.js';
import { SCOURGE_BALANCE_PROFILE_IDS as PROFILE } from './profiles.js';
import { scourgeState } from './state.js';

function reactToCondition(context: NecromancerResolverContext, event: NecromancerResolverEvent): void {
  // Only Torment triggers Demonic Lore — all other conditions are ignored here
  if (
    event.condition !== 'Torment' ||
    !hasTrait(context, TRAIT.DEMONIC_LORE) ||
    !isInternalCooldownReady(event.at, Number(scourgeState.from(context).demonicLoreReadyAt || 0))
  ) {
    return;
  }

  const profile = necromancerBalanceProfile(context, PROFILE.demonicLore);
  const effect = balanceProfileEffect(profile, 'condition');
  // Advance the ICD before applying the condition so re-entrant Torment events
  // within the same tick cannot double-proc
  scourgeState.from(context).demonicLoreReadyAt = event.at + Number(profile?.cooldown || 3);
  applyTraitCondition(context, event, {
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
