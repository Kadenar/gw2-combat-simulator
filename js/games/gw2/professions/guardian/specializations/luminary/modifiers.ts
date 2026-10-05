import { buffActive } from '#gw2/platform/combat/query/runtime-query.js';
import type { Gw2ModifierContext, Gw2ModifierRule } from '#gw2/platform/combat/modifiers.js';
import { MODIFIER_TARGET } from '#gw2/platform/combat/modifiers.js';
import { gw2EffectExpiresAt } from '#gw2/platform/effects/timing.js';

import { GUARDIAN_SKILL_IDS } from '#gw2/professions/guardian/data/ids.js';
import { luminaryWeaponModifiers } from '#gw2/professions/guardian/specializations/luminary/skills/radiant-forge-skills.js';

/** Applies a stance modifier to its own impact or proc only when an older application was already active. */
function stanceModifierActive(context: Gw2ModifierContext, kind: string, skillId: number, skillName: string): boolean {
  if (!buffActive(context, kind)) return false;
  if (context.event?.skillId !== skillId && context.event?.triggeredBy !== skillName) return true;
  return (context.events || []).some(
    (event) =>
      event.type === 'buff' &&
      event.kind === kind &&
      event.at < context.time &&
      gw2EffectExpiresAt(event.at, event.duration || 0) > context.time
  );
}

export const luminaryModifiers: readonly Gw2ModifierRule[] = Object.freeze([
  {
    id: 'guardian.piercing-stance',
    target: MODIFIER_TARGET.STRIKE_DAMAGE,
    operation: 'damage-additive',
    amount: 0.1,
    // The stance is active before its impact, including the damage it triggers at that timestamp.
    when: (context) => buffActive(context, 'guardian-piercing-stance')
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
  ...luminaryWeaponModifiers
]);
