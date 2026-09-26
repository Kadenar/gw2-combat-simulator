import { MODIFIER_TARGET } from '#gw2/platform/combat/modifiers.js';
import { gw2EffectExpiresAt } from '#gw2/platform/skills/timing.js';
import { GUARDIAN_SKILL_IDS } from '#gw2/professions/guardian/data/ids.js';
import {
  guardianTargetDisabled,
  guardianTimedBuffActive,
  latestGuardianTimedBuff
} from '#gw2/professions/guardian/core/modifiers.js';
import type { Gw2ModifierContext, Gw2ModifierRule } from '#gw2/platform/combat/modifiers.js';

/** Applies a stance modifier to its own impact or proc only when an older application was already active. */
function stanceModifierActive(context: Gw2ModifierContext, kind: string, skillId: number, skillName: string): boolean {
  if (!guardianTimedBuffActive(context, kind)) return false;
  if (context.event?.skillId !== skillId && context.event?.triggeredBy !== skillName) return true;
  return (context.events || []).some(
    (event) =>
      event.type === 'buff' &&
      event.kind === kind &&
      event.at < context.time &&
      gw2EffectExpiresAt(event.at, Number(event.duration || 0)) > context.time
  );
}

export const luminaryModifiers: readonly Gw2ModifierRule[] = Object.freeze([
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
      // exclusive to the hammer (Dazzling Hammer). The shared effect-clock expiry check is
      // necessary because latestGuardianTimedBuff returns the most-recently
      // applied record regardless of whether it has expired.
      return (
        armament?.metadata?.radiantWeapon === 'hammer' &&
        gw2EffectExpiresAt(armament.at, Number(armament.duration || 0)) > context.time
      );
    }
  },
  {
    id: 'guardian.piercing-stance',
    target: MODIFIER_TARGET.STRIKE_DAMAGE,
    operation: 'damage-additive',
    amount: 0.1,
    // The stance is active before its impact, including the damage it triggers at that timestamp.
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
    when: (context) =>
      stanceModifierActive(context, 'guardian-daring-advance', GUARDIAN_SKILL_IDS.DARING_ADVANCE, 'Daring Advance')
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
    // Glaring Burst's hammer variant scales its packet after shared additive damage bonuses.
    operation: 'multiply',
    factor: 1.25,
    order: 100,
    when: (context) =>
      context.event?.skillId === GUARDIAN_SKILL_IDS.GLARING_BURST && context.event?.metadata?.radiantWeapon === 'hammer'
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
