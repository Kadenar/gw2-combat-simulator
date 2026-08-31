import { balanceProfileEffect, balanceProfileFromContext } from '#gw2/platform/combat/state/balance-profiles.js';
import { isInternalCooldownReady } from '#kernel/core/clock.js';
import { hasTrait } from '#gw2/platform/combat/state/traits.js';
import { NECROMANCER_TRAIT_IDS as TRAIT } from '#gw2/content/professions/necromancer/data/ids.js';
import { applyTraitCondition } from '#gw2/content/professions/necromancer/core/traits/index.js';
import type {
  NecromancerResolverContext,
  NecromancerResolverEvent
} from '#gw2/content/professions/necromancer/types.js';

import { SCOURGE_BALANCE_PROFILE_IDS as PROFILE } from '#gw2/content/professions/necromancer/specializations/scourge/profiles.js';
import { scourgeState } from '#gw2/content/professions/necromancer/specializations/scourge/state.js';

// Convert eligible Torment applications into Demonic Lore burns while enforcing its resolver-owned cooldown.
function reactToCondition(context: NecromancerResolverContext, event: NecromancerResolverEvent): void {
  // Only Torment triggers Demonic Lore — all other conditions are ignored here
  if (
    event.condition !== 'Torment' ||
    !hasTrait(context, TRAIT.DEMONIC_LORE) ||
    !isInternalCooldownReady(event.at, Number(scourgeState.from(context).demonicLoreReadyAt || 0))
  ) {
    return;
  }

  const profile = balanceProfileFromContext(context, PROFILE.demonicLore);
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

/** Exposes Scourge's condition-triggered trait reaction. */
export const scourgeResolverEventReactions = Object.freeze({
  condition: reactToCondition
});
