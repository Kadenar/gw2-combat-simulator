import { hasTrait as hasGw2Trait } from '../../../../platform/gw2/combat/state/traits.js';
import { professionCoreState } from '../../../../platform/engine/profession/state.js';
import type { Skill } from '../../../../platform/engine/types.js';
import type { ElementalistCastContext, ElementalistSchedulerContext } from '../../types.js';
import { CONJURED_WEAPONS, EVOKER_NO_CHARGE_SKILLS, FULL_SPEAR_ETCHINGS } from './constants.js';
import { evokerState, type EvokerState } from './state.js';
import { EVOKER_BALANCE_PROFILE_IDS as PROFILE } from './profiles.js';
import { elementalistBalanceValue } from '../../core/profiles.js';

function hasTrait(context: unknown, trait: string): boolean {
  return hasGw2Trait(context as never, trait);
}

export function initialize(context: ElementalistSchedulerContext): void {
  const state = evokerState.from(context);
  const core = professionCoreState(context);
  // Specialized Elements keeps the six-charge capacity but accelerates each
  // matching weapon skill to three charges.
  state.maximumCharges = elementalistBalanceValue(
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

export function weaponSkillChargeGain(context: unknown, skill: Skill, state: Pick<EvokerState, 'element'>): number {
  const slot = /^Weapon_(\d)$/.exec(String(skill.slot || ''));
  if (
    skill.type !== 'Weapon' ||
    !slot ||
    Number(slot[1]) < 2 ||
    Number(slot[1]) > 5 ||
    CONJURED_WEAPONS.has(String(skill.skillWeapon || skill.weapon || '')) ||
    EVOKER_NO_CHARGE_SKILLS.has(skill.name) ||
    (skill.weapon === 'Spear' && (skill.name.startsWith('Lesser ') || FULL_SPEAR_ETCHINGS.has(skill.name)))
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
    ? elementalistBalanceValue(context, profile, 'playerStacks', specialized ? 3 : 2)
    : elementalistBalanceValue(context, PROFILE.resources, 'allyStacks', 1);
}

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

export function flushPendingWeaponChargeGains(context: ElementalistCastContext, state: EvokerState): void {
  for (const chargeGain of state.pendingWeaponChargeGains) {
    applyWeaponSkillChargeGain(context, state, chargeGain);
  }

  state.pendingWeaponChargeGains = [];
}
