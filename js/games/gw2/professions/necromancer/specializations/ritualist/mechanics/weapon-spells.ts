/** Resolve weapon-spell grants and their on-hit effects for combat and skill previews. */
import { ACTOR, CONDITION } from '#gw2/platform/constants.js';
import { requireSkillAction } from '#gw2/platform/effects/actions.js';
import type { BuffEffect } from '#gw2/platform/effects/types.js';
import { effectNumber, requireEffect } from '#gw2/platform/skills/balance-profiles.js';
import type { Skill, SkillId } from '#gw2/platform/skills/types.js';
import { NECROMANCER_SKILL_IDS as ID } from '#gw2/professions/necromancer/data/ids.js';

const grantKinds = new Map<SkillId, string>([
  [ID.NIGHTMARE_WEAPON, 'nightmare-weapon'],
  [ID.SPLINTER_WEAPON, 'splinter-weapon'],
  [ID.RESILIENT_WEAPON, 'resilient-weapon']
]);

/** Each spell grants its own buff. Wielder's Boon gives each eligible ally the caster's count. */
export function weaponSpellGrant(skill: Skill, wieldersBoon: boolean) {
  const kind = grantKinds.get(skill.id);

  if (!kind) return;

  const effect = skill.effects?.find((effect): effect is BuffEffect => effect.type === 'buff' && effect.kind === kind);

  if (!effect) return;

  const personal = effect.stacks ?? 0;
  return { effect, personal, allied: wieldersBoon ? personal : (effect.allyStacks ?? 0) };
}

/** Nightmare's siphon and Vulnerability can survive a balance patch independently. */
export function weaponSpellChargeEffects(skill: Skill) {
  if (skill.id === ID.RESILIENT_WEAPON) return [];

  const triggered = requireSkillAction(skill, 'triggered');
  const strike = requireEffect(skill, 'strike', 'Strike', triggered);
  const actorType = ACTOR.EFFECT;

  if (skill.id === ID.SPLINTER_WEAPON)
    return strike
      ? [{ type: 'strike' as const, actorType, coefficient: effectNumber(skill, strike, 'coefficient') }]
      : [];

  const vulnerability = requireEffect(skill, 'condition', CONDITION.VULNERABILITY, triggered);
  const effects = [];

  if (strike)
    effects.push({
      type: 'strike' as const,
      actorType,
      coefficient: 0,
      flatStrikeBase: effectNumber(skill, strike, 'flatStrikeBase'),
      flatStrikePowerCoeff: effectNumber(skill, strike, 'flatStrikePowerCoeff'),
      canCrit: false,
      damageKind: 'life-steal'
    });

  if (vulnerability)
    effects.push({
      type: 'condition' as const,
      actorType,
      condition: String(vulnerability.condition),
      stacks: effectNumber(skill, vulnerability, 'stacks'),
      duration: effectNumber(skill, vulnerability, 'duration')
    });

  return effects;
}
