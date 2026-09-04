/**
 * The Evoker familiar-charge economy.
 *
 * Owns charge capacity setup, how much each weapon skill contributes, the
 * deferral queue that protects grants from a charge-resetting familiar cast, and
 * the resource events the charge dial renders. Spending charges belongs to the
 * familiar handlers; this module only accrues and reports them.
 */
import { balanceProfileValueFromContext } from '#gw2/platform/combat/state/balance-profiles.js';
import { hasTrait } from '#gw2/platform/combat/state/traits.js';
import { professionCoreState } from '#gw2/platform/engine/profession/state.js';
import type { Skill } from '#gw2/platform/engine/skills/types.js';
import type { ElementalistCastContext, ElementalistSchedulerContext } from '#gw2/professions/elementalist/types.js';
import {
  CONJURED_WEAPONS,
  EVOKER_NO_CHARGE_SKILLS,
  EVOKER_NO_CHARGE_SPEAR_SKILLS
} from '#gw2/professions/elementalist/specializations/evoker/mechanics/constants.js';
import { evokerState, type EvokerState } from '#gw2/professions/elementalist/specializations/evoker/state.js';
import { EVOKER_BALANCE_PROFILE_IDS as PROFILE } from '#gw2/professions/elementalist/specializations/evoker/profiles.js';

/**
 * Seeds charge capacity from the active balance profile before the first cast,
 * and pins the Core attunement to the selected element when Specialized Elements
 * has disabled attunement swapping.
 */
export function initialize(context: ElementalistSchedulerContext): void {
  const state = evokerState.from(context);
  const core = professionCoreState(context);
  // Specialized Elements keeps the six-charge capacity but accelerates each
  // matching weapon skill to three charges.
  state.maximumCharges = balanceProfileValueFromContext(
    context,
    hasTrait(context, 'Specialized Elements') ? PROFILE.specializedElements : PROFILE.resources,
    'maximumStacks',
    6
  );
  state.charges = Math.min(state.maximumCharges, state.charges);
  // locks the core attunement system to the fixed element so core trait procs key off the right element
  if (hasTrait(context, 'Specialized Elements')) {
    core.primaryAttunement = state.element;
  }
}

/** Publishes the current charge and empowered totals as an absolute reading at the cast's end. */
export function emitResource(context: ElementalistCastContext, skill: Skill, state: EvokerState): void {
  context.emit({
    type: 'resource',
    at: context.effectiveEnd,
    source: skill.name,
    sourceId: skill.id,
    actorType: 'player',
    skillName: skill.name,
    kind: 'evoker-charges',
    value: state.charges,
    maximum: state.maximumCharges,
    empowered: state.empowered
  });
}

/**
 * Charges a single weapon skill is worth: zero for anything outside weapon slots
 * 2-5, conjures, exempt skills, and lesser or completed spear etchings;
 * otherwise the matching-element amount when the skill shares the selected
 * element, and the smaller off-element amount when it does not.
 */
export function weaponSkillChargeGain(context: unknown, skill: Skill, state: Pick<EvokerState, 'element'>): number {
  const slot = /^Weapon_(\d)$/.exec(String(skill.slot || ''));
  if (
    skill.type !== 'Weapon' ||
    !slot ||
    Number(slot[1]) < 2 ||
    Number(slot[1]) > 5 ||
    CONJURED_WEAPONS.has(String(skill.skillWeapon || skill.weapon || '')) ||
    EVOKER_NO_CHARGE_SKILLS.has(skill.id) ||
    (skill.weapon === 'Spear' && EVOKER_NO_CHARGE_SPEAR_SKILLS.has(skill.id))
  ) {
    return 0;
  }

  // Split-attunement skills gain the matching-element amount; Specialized
  // Elements raises that amount from two charges to three.
  const specialized = hasTrait(context, 'Specialized Elements');
  const profile = specialized ? PROFILE.specializedElements : PROFILE.resources;
  return String(skill.attunement || '')
    .split('+')
    .includes(state.element)
    ? balanceProfileValueFromContext(context, profile, 'playerStacks', specialized ? 3 : 2)
    : balanceProfileValueFromContext(context, PROFILE.resources, 'allyStacks', 1);
}

// commits one grant, clamped to capacity, and reports it with a delta so the log shows the change
function applyWeaponSkillChargeGain(
  context: ElementalistCastContext,
  state: EvokerState,
  chargeGain: EvokerState['pendingWeaponChargeGains'][number]
): void {
  const before = state.charges;
  state.charges = Math.min(state.maximumCharges, state.charges + chargeGain.gain);
  if (state.charges === before) return;
  context.emit({
    type: 'resource',
    activationId: chargeGain.activationId,
    at: chargeGain.at,
    source: chargeGain.source,
    sourceId: chargeGain.sourceId,
    actorType: 'player',
    skillName: chargeGain.source,
    kind: 'evoker-charges',
    value: state.charges,
    maximum: state.maximumCharges,
    empowered: state.empowered,
    change: state.charges - before
  });
}

/**
 * Awards a completing weapon skill's charges, queueing the grant instead when a
 * charge-resetting basic familiar is still casting so the charges land after the
 * reset rather than being wiped by it.
 */
export function grantWeaponSkillCharges(context: ElementalistCastContext, skill: Skill, state: EvokerState): void {
  const gain = weaponSkillChargeGain(context, skill, state);
  if (gain <= 0) return;
  const chargeGain = {
    activationId: context.reservationId,
    at: context.effectiveEnd,
    source: skill.name,
    sourceId: skill.id,
    gain
  };
  // defer if a charge-resetting basic familiar is still casting — granting before the reset would lose the charges
  // reservationId check excludes the familiar itself from deferring its own grant
  if (
    state.activeFamiliarCast &&
    state.activeFamiliarCast.resetsCharges &&
    context.reservationId !== state.activeFamiliarCast.reservationId &&
    context.effectiveEnd <= state.activeFamiliarCast.endsAt + context.epsilon
  ) {
    state.pendingWeaponChargeGains.push(chargeGain);
    return;
  }

  applyWeaponSkillChargeGain(context, state, chargeGain);
}

/** Replays every deferred grant once the familiar cast that blocked them has settled. */
export function flushPendingWeaponChargeGains(context: ElementalistCastContext, state: EvokerState): void {
  for (const chargeGain of state.pendingWeaponChargeGains) {
    applyWeaponSkillChargeGain(context, state, chargeGain);
  }

  state.pendingWeaponChargeGains = [];
}
