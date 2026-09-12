/**
 * Owns conjured-bundle equip, pickup, and recharge state across casts.
 * Conjure skill fragments live in `skills/conjure-skills.ts`.
 */
import {
  balanceProfileEffectFromContext,
  balanceProfileValue,
  balanceProfileValueFromContext
} from '#gw2/platform/combat/state/balance-profiles.js';
import { hasTrait } from '#gw2/platform/combat/state/traits.js';
import { professionCoreState } from '#gw2/platform/engine/profession/state.js';
import type { Skill } from '#gw2/platform/engine/skills/types.js';
import type {
  ElementalistCastContext as ElementalistLifecycleContext,
  ElementalistResolverContext,
  ElementalistResolverEvent
} from '#gw2/professions/elementalist/types.js';
import { resetAutoattackChains } from '#gw2/platform/skills/autoattack-chains.js';
import { CONJURE_PICKUP_WEAPONS, CONJURE_SKILLS } from '#gw2/professions/elementalist/core/constants.js';
import { ELEMENTALIST_SKILL_IDS as ID } from '#gw2/professions/elementalist/data/ids.js';
import { applyElementalistAura } from '#gw2/professions/elementalist/core/traits/index.js';
import { ELEMENTALIST_CORE_BALANCE_PROFILE_IDS as PROFILE } from '#gw2/professions/elementalist/core/profiles.js';

/**
 * Track equipped and ground-copy conjures as timed flip state so pickup and
 * expiry behavior share one source of truth.
 *
 * Runs at cast completion: conjuring equips the weapon and opens its ground
 * copy's pick-up window, `__drop_bundle` unequips, and `__pickup_*` re-equips a
 * copy whose window is still open. Any of those swaps emits `sigil_swap`.
 */
export function applyConjureState(context: ElementalistLifecycleContext, skill: Skill): void {
  if (context.action?.cancelled === true) return;
  const state = professionCoreState(context);
  const at = context.effectiveEnd;
  const conjuredWeapon = CONJURE_SKILLS[Number(skill.id)];
  let swapped = false;
  if (conjuredWeapon) {
    state.conjureEquipped = conjuredWeapon;
    state.conjurePickups[conjuredWeapon] =
      at + balanceProfileValueFromContext(context, PROFILE.conjurePickups, 'durationMultiplier', 30);
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
  } else if (Number(skill.id) === ID.DROP_BUNDLE) {
    swapped = state.conjureEquipped != null;
    state.conjureEquipped = null;
  } else if (CONJURE_PICKUP_WEAPONS[Number(skill.id)]) {
    const weapon = CONJURE_PICKUP_WEAPONS[Number(skill.id)];
    // Require a real ground copy, preserving pickups begun before its window closes.
    const pickupAction = context.action?.eventOrder == null ? null : context.eventByOrder(context.action.eventOrder);
    const expiresAt = pickupAction?.conjurePickupExpiresAt ?? state.conjurePickups[weapon];
    if (typeof expiresAt === 'number' && Number.isFinite(expiresAt) && expiresAt > context.start) {
      state.conjureEquipped = weapon;
      delete state.conjurePickups[weapon];
      swapped = true;
    }
  }

  if (swapped) {
    // Each equipped copy gets its own lifetime; the separately summoned ground copy is consumed once.
    state.conjureExpiresAt = state.conjureEquipped
      ? at + balanceProfileValueFromContext(context, PROFILE.conjurePickups, 'durationMultiplier', 30)
      : 0;
    resetAutoattackChains(context);
    context.emit({
      type: 'elementalist.conjure',
      at,
      source: skill.name,
      sourceId: skill.id,
      actorType: 'player',
      skillName: skill.name,
      conjureEquipped: state.conjureEquipped,
      conjureExpiresAt: state.conjureExpiresAt
    });
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

/** Keep the resolver's wielded bundle current so its attributes apply to every player skill until drop or expiry. */
export function applyElementalistResolverConjure(
  context: ElementalistResolverContext,
  event: ElementalistResolverEvent
): void {
  const state = professionCoreState(context);
  state.conjureEquipped = typeof event.conjureEquipped === 'string' ? event.conjureEquipped : null;
  state.conjureExpiresAt = Number(event.conjureExpiresAt || 0);
}
