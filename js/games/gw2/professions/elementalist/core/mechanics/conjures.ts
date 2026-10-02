import type { RuntimeCast } from '#gw2/platform/simulation/runtime-state.js';
import { applyConjurerAura } from '#gw2/professions/elementalist/core/traits/behavior.js';
/**
 * Owns conjured-bundle equip, pickup, and recharge state across casts.
 * Conjure skill fragments live in `skills/conjure-skills.ts`.
 */
import { professionCoreState } from '#gw2/platform/engine/profession/state.js';
import {
  balanceProfileNumber,
  requireBalanceProfileFromContext
} from '#gw2/platform/engine/skills/balance-profiles.js';
import type { Skill } from '#gw2/platform/engine/skills/types.js';
import { resetAutoattackChains } from '#gw2/platform/skills/autoattack-chain-controller.js';
import { CONJURE_PICKUP_WEAPONS, CONJURE_SKILLS } from '#gw2/professions/elementalist/core/constants.js';
import { ELEMENTALIST_CORE_BALANCE_PROFILE_IDS as PROFILE } from '#gw2/professions/elementalist/core/profiles.js';
import { applyElementalistAura } from '#gw2/professions/elementalist/core/traits/dispatch.js';
import type { ElementalistSkill, ElementalistRuntime } from '#gw2/professions/elementalist/types.js';

/** A conjure creates independent equipped and one-use ground copies before its trait and swap events. */
export function equipConjure(context: ElementalistRuntime, cast: RuntimeCast<ElementalistSkill>, skill: Skill): void {
  const state = professionCoreState(context);
  const weapon = CONJURE_SKILLS[Number(skill.id)];
  state.conjureEquipped = weapon;
  state.conjurePickups[weapon] =
    cast.effectiveEnd +
    balanceProfileNumber(requireBalanceProfileFromContext(context, PROFILE.conjurePickups), 'durationMultiplier');
  applyConjurerAura(context, cast, skill, applyElementalistAura);
  finishConjureSwap(context, cast, skill);
}

/** Dropping reports a swap only when a real equipped bundle was removed. */
export function dropConjure(context: ElementalistRuntime, cast: RuntimeCast<ElementalistSkill>, skill: Skill): void {
  const state = professionCoreState(context);
  if (!state.conjureEquipped) return;
  state.conjureEquipped = null;
  finishConjureSwap(context, cast, skill);
}

/** A successful pickup consumes the ground copy captured at acceptance, even if its deadline passed during the cast. */
export function pickUpConjure(context: ElementalistRuntime, cast: RuntimeCast<ElementalistSkill>, skill: Skill): void {
  const expiresAt = pickupWindows.get(cast);
  if (typeof expiresAt !== 'number' || !Number.isFinite(expiresAt) || expiresAt <= cast.start) return;
  const state = professionCoreState(context);
  const weapon = CONJURE_PICKUP_WEAPONS[Number(skill.id)];
  state.conjureEquipped = weapon;
  delete state.conjurePickups[weapon];
  finishConjureSwap(context, cast, skill);
}

/** All real bundle swaps share lifetime scheduling, chain reset, and one sigil-swap notification. */
function finishConjureSwap(context: ElementalistRuntime, cast: RuntimeCast<ElementalistSkill>, skill: Skill): void {
  const state = professionCoreState(context);
  const at = cast.effectiveEnd;
  state.conjureExpiresAt = state.conjureEquipped
    ? at + balanceProfileNumber(requireBalanceProfileFromContext(context, PROFILE.conjurePickups), 'durationMultiplier')
    : 0;
  context.schedule('elementalist.expire-state', state.conjureExpiresAt || at, null);
  for (const deadline of Object.values(state.conjurePickups))
    context.schedule('elementalist.expire-state', deadline, null);
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

const pickupWindows = new WeakMap<RuntimeCast<ElementalistSkill>, number>();
/** A pickup accepted before ground expiry retains that copy through its animation. */
export function captureConjurePickup(runtime: ElementalistRuntime, cast: RuntimeCast<ElementalistSkill>): void {
  const weapon = CONJURE_PICKUP_WEAPONS[Number(cast.skill.id)];
  if (weapon) pickupWindows.set(cast, runtime.profession.core.conjurePickups[weapon]);
}
