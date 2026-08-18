import { hasTrait as hasGw2Trait } from '../../../../platform/gw2/trait-state.js';
import type { SchedulerRecord, Skill } from '../../../../platform/engine/types.js';
import type { ElementalistCastContext, ElementalistSchedulerContext } from '../../types.js';
import { elementalistCoreState } from '../../core/state.js';
import { CONJURED_WEAPONS, EVOKER_NO_CHARGE_SKILLS, FULL_SPEAR_ETCHINGS } from './constants.js';
import { evokerState, type EvokerState } from './state.js';
import { EVOKER_BALANCE_PROFILE_IDS as PROFILE } from './profiles.js';
import { elementalistBalanceValue } from '../../core/profiles.js';

function hasTrait(context: unknown, trait: string): boolean {
  return hasGw2Trait(context as never, trait);
}

export function initialize(context: ElementalistSchedulerContext): void {
  const state = evokerState.from(context);
  const core = elementalistCoreState(context as unknown as SchedulerRecord);
  // evoker-specific ICD for the evocation passive; set here because this value differs from core elementalist defaults
  core.attunementTraitProcCooldownSeconds = elementalistBalanceValue(context, PROFILE.evocation, 'internalCooldown', 5);
  state.maximumCharges = elementalistBalanceValue(
    context,
    hasTrait(context, 'Specialized Elements') ? PROFILE.specializedElements : PROFILE.resources,
    'maximumStacks',
    hasTrait(context, 'Specialized Elements') ? 4 : 6
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

export function weaponSkillChargeGain(context: unknown, skill: Skill, state: EvokerState): number {
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
  // split-attunement skills (e.g. "Fire+Air") gain the higher playerStacks count when one of them matches the active element
  return String(skill.attunement || '')
    .split('+')
    .includes(state.element)
    ? elementalistBalanceValue(context, PROFILE.resources, 'playerStacks', 2)
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
