import { MODIFIER_TARGET } from '../../../../../../platform/combat/modifiers/rules.js';
import { GUARDIAN_SKILL_IDS } from '../../../data/ids.js';
import {
  guardianTargetDisabled,
  guardianTimedBuffActive,
  latestGuardianTimedBuff
} from '../../../core/traits/modifiers.js';
import { advanceRadiantForgeState, radiantForgeAvailability } from './radiant-forge.js';
import { observeLuminaryScheduledEvent, updateLuminaryTraitCastState } from '../traits/index.js';
import type { Gw2ModifierRule } from '../../../../../../platform/combat/modifiers/types.js';
import type { GuardianSchedulerContext, GuardianSkill } from '../../../types.js';

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
  availability: Object.freeze([
    {
      id: 'guardian.radiant-forge',
      order: 120,
      handler: radiantForgeAvailability
    }
  ])
});

/** Runs Luminary mechanics owned by one completed skill activation. */
export const luminarySkillMechanicHandlers = Object.freeze({
  'guardian.luminary.clear-forge-entry-cooldown': ({
    context,
    skill
  }: {
    context: GuardianSchedulerContext;
    skill: GuardianSkill;
  }): void => {
    context.state.cooldowns.delete(skill.id);
  }
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
  onEventScheduled: Object.freeze([
    {
      id: 'guardian.luminary.traits',
      order: 20,
      handler: observeLuminaryScheduledEvent
    }
  ])
});
