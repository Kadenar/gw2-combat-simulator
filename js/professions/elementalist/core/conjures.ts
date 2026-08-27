import { hasTrait } from '../../../platform/gw2/combat/state/traits.js';
import { professionCoreState } from '../../../platform/engine/profession/state.js';
import type { Skill } from '../../../platform/engine/types.js';
import type { ElementalistCastContext as ElementalistLifecycleContext } from '../types.js';
import { CONJURE_SKILLS } from './constants.js';
import { applyElementalistAura } from './mechanics.js';
import {
  ELEMENTALIST_CORE_BALANCE_PROFILE_IDS as PROFILE,
  elementalistBalanceValue,
  elementalistEffectValue
} from './profiles.js';

// Track equipped and ground-copy conjures as timed flip state so pickup and
// expiry behavior share one source of truth.
export function applyConjureState(context: ElementalistLifecycleContext, skill: Skill): void {
  const state = professionCoreState(context);
  const at = context.effectiveEnd;
  const conjuredWeapon = CONJURE_SKILLS[Number(skill.id)];
  let swapped = false;
  if (conjuredWeapon) {
    state.conjureEquipped = conjuredWeapon;
    state.conjurePickups[conjuredWeapon] =
      at + elementalistBalanceValue(context, PROFILE.conjurePickups, 'durationMultiplier', 35);
    swapped = true;
    if (hasTrait(context, 'Conjurer')) {
      applyElementalistAura(context, {
        at,
        aura: 'Fire Aura',
        duration: elementalistEffectValue(context, PROFILE.conjurer, 'buff', 'duration', 4, 'Conjurer'),
        skillName: 'Conjurer',
        sourceId: skill.id
      });
    }
  } else if (skill.name === '__drop_bundle') {
    swapped = state.conjureEquipped != null;
    state.conjureEquipped = null;
  } else if (skill.name.startsWith('__pickup_')) {
    const weapon = skill.name.slice('__pickup_'.length);
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
