import {
  balanceProfileEffectFromContext,
  balanceProfileValue,
  balanceProfileValueFromContext
} from '#gw2/platform/combat/state/balance-profiles.js';
import { hasTrait } from '#gw2/platform/combat/state/traits.js';
import { professionCoreState } from '#gw2/platform/engine/profession/state.js';
import type { Skill } from '#gw2/platform/engine/types.js';
import type { ElementalistCastContext as ElementalistLifecycleContext } from '#gw2/content/professions/elementalist/types.js';
import { CONJURE_SKILLS } from '#gw2/content/professions/elementalist/core/constants.js';
import { applyElementalistAura } from '#gw2/content/professions/elementalist/core/traits/index.js';
import { ELEMENTALIST_CORE_BALANCE_PROFILE_IDS as PROFILE } from '#gw2/content/professions/elementalist/core/profiles.js';

/**
 * Track equipped and ground-copy conjures as timed flip state so pickup and
 * expiry behavior share one source of truth.
 *
 * Runs at cast completion: conjuring equips the weapon and opens its ground
 * copy's pick-up window, `__drop_bundle` unequips, and `__pickup_*` re-equips a
 * copy whose window is still open. Any of those swaps emits `sigil_swap`.
 */
export function applyConjureState(context: ElementalistLifecycleContext, skill: Skill): void {
  const state = professionCoreState(context);
  const at = context.effectiveEnd;
  const conjuredWeapon = CONJURE_SKILLS[Number(skill.id)];
  let swapped = false;
  if (conjuredWeapon) {
    state.conjureEquipped = conjuredWeapon;
    state.conjurePickups[conjuredWeapon] =
      at + balanceProfileValueFromContext(context, PROFILE.conjurePickups, 'durationMultiplier', 35);
    swapped = true;
    if (hasTrait(context, 'Conjurer')) {
      applyElementalistAura(context, {
        at,
        aura: 'Fire Aura',
        duration: balanceProfileValue(
          balanceProfileEffectFromContext(context, PROFILE.conjurer, 'buff', 0, 'Conjurer'),
          'duration',
          4
        ),
        skillName: 'Conjurer',
        sourceId: skill.id
      });
    }
  } else if (skill.name === '__drop_bundle') {
    swapped = state.conjureEquipped != null;
    state.conjureEquipped = null;
  } else if (skill.name.startsWith('__pickup_')) {
    const weapon = skill.name.slice('__pickup_'.length);
    // A ground copy can only be reclaimed while its pick-up window is still open.
    if (Number(state.conjurePickups[weapon] || 0) >= context.start) {
      state.conjureEquipped = weapon;
      delete state.conjurePickups[weapon];
      swapped = true;
    }
  }

  if (swapped) {
    context.emit({
      type: 'sigil_swap',
      at,
      source: skill.name,
      sourceId: skill.id,
      actorType: 'player',
      skillName: skill.name
    });
  }
}
