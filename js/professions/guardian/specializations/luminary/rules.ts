import { MODIFIER_TARGET } from '../../../../platform/gw2/modifier-rules.js';
import { GUARDIAN_SKILL_IDS } from '../../data/ids.js';
import { guardianTargetDisabled, guardianTimedBuffActive, latestGuardianTimedBuff } from '../../core/rules.js';
import { advanceRadiantForgeState, clearRadiantForgeEntryCooldown, validateRadiantForgeCast } from './radiant-forge.js';
import { observeLuminaryScheduledEvent, updateLuminaryTraitCastState } from './traits.js';
import type { Gw2ModifierRule } from '../../../../platform/gw2/types.js';

export const luminaryModifierRules: readonly Gw2ModifierRule[] = Object.freeze([
  {
    id: 'guardian.empowered-armaments',
    target: MODIFIER_TARGET.STRIKE_DAMAGE,
    operation: 'damage-additive',
    amount: 0.1,
    when: (context) => guardianTimedBuffActive(context, 'guardian-empowered-armaments')
  },
  {
    id: 'guardian.radiant-armaments',
    target: MODIFIER_TARGET.STRIKE_DAMAGE,
    operation: 'damage-additive',
    amount: 0.07,
    when: (context) => {
      const armament = latestGuardianTimedBuff(context, 'guardian-radiant-armaments');
      // The buff is emitted for every radiant weapon, but the +7% bonus is
      // exclusive to the hammer (Dazzling Hammer). The manual expiry check is
      // necessary because latestGuardianTimedBuff returns the most-recently
      // applied record regardless of whether it has expired.
      return armament?.radiantWeapon === 'hammer' && armament.at + Number(armament.duration || 0) > context.time;
    }
  },
  {
    id: 'guardian.piercing-stance',
    target: MODIFIER_TARGET.STRIKE_DAMAGE,
    operation: 'damage-additive',
    amount: 0.1,
    when: (context) => guardianTimedBuffActive(context, 'guardian-piercing-stance')
  },
  {
    id: 'guardian.daring-advance',
    target: MODIFIER_TARGET.STRIKE_DAMAGE,
    operation: 'multiply',
    factor: 1.15,
    // order: 100 places this after additive stacking; multiplicative modifiers
    // that interact with additive sums must sort after them.
    order: 100,
    when: (context) => guardianTimedBuffActive(context, 'guardian-daring-advance')
  },
  {
    id: 'guardian.shining-spin',
    target: MODIFIER_TARGET.STRIKE_DAMAGE,
    operation: 'multiply',
    factor: 1.2,
    order: 100,
    when: (context) => context.event?.skillId === GUARDIAN_SKILL_IDS.SHINING_SPIN && guardianTargetDisabled(context)
  },
  {
    id: 'guardian.glaring-burst-hammer',
    target: MODIFIER_TARGET.STRIKE_DAMAGE,
    operation: 'damage-additive',
    amount: 0.25,
    order: 100,
    when: (context) =>
      context.event?.skillId === GUARDIAN_SKILL_IDS.GLARING_BURST && context.event?.radiantWeapon === 'hammer'
  },
  {
    id: 'guardian.gleaming-blade',
    target: MODIFIER_TARGET.STRIKE_DAMAGE,
    operation: 'multiply',
    factor: 1.5,
    order: 100,
    when: (context) =>
      context.event?.skillId === GUARDIAN_SKILL_IDS.GLEAMING_BLADE &&
      guardianTimedBuffActive(context, 'guardian-radiant-courage-sword')
  }
]);

export const luminaryAttributeRules = Object.freeze({
  modifierRules: luminaryModifierRules
});

export const luminaryCastRules = Object.freeze({
  validateCast: Object.freeze([
    {
      id: 'guardian.radiant-forge',
      order: 40,
      handler: validateRadiantForgeCast
    }
  ])
});

export const luminarySchedulerHooks = Object.freeze({
  advance: Object.freeze([
    {
      id: 'guardian.radiant-forge',
      order: 20,
      handler: advanceRadiantForgeState
    }
  ]),
  afterCast: Object.freeze([
    {
      id: 'guardian.luminary.traits',
      order: 30,
      handler: updateLuminaryTraitCastState
    }
  ]),
  onCastComplete: Object.freeze([
    {
      // The cooldown is deliberately deleted here rather than in the Enter
      // handler so it only starts counting once the forge is truly active
      // (afterCast fires at effectiveEnd, not at the start of the cast).
      id: 'guardian.radiant-forge',
      order: 10,
      handler: clearRadiantForgeEntryCooldown
    }
  ]),
  onEventScheduled: Object.freeze([
    {
      id: 'guardian.luminary.traits',
      order: 20,
      handler: observeLuminaryScheduledEvent
    }
  ])
});
