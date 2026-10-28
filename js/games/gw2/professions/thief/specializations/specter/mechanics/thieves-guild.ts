import { permanentTargetConditionStacks } from '#gw2/platform/combat/state/targets.js';
import { CONDITION } from '#gw2/platform/constants.js';
import type { ConditionEffect } from '#gw2/platform/effects/types.js';
import type { Skill } from '#gw2/platform/skills/types.js';
import type { ThiefRuntime } from '#gw2/professions/thief/core/events.js';
import type { ThiefSummonDefinition } from '#gw2/professions/thief/types.js';

/** The selected elite owns actor identity and stream startup; attack packets live on canonical actor skills. */
export const SPECTER_THIEVES_GUILD_ACTOR: ThiefSummonDefinition = Object.freeze({
  name: 'Scepter Specter',
  displayName: 'Specter',
  variant: 'Specter',
  weapon: 'Scepter',
  weaponStrengthProfileId: 'weapon.scepter',
  attacks: [
    {
      skillId: 67807,
      initialDelay: 1.017
    },
    {
      skillId: 67795,
      initialDelay: 2.8579999999999997
    },
    {
      skillId: 67795,
      initialDelay: 3.857
    },
    {
      skillId: 67807,
      initialDelay: 4.54
    },
    {
      skillId: 67795,
      initialDelay: 4.858
    },
    {
      skillId: 67812,
      initialDelay: 5.0600000000000005
    },
    {
      skillId: 67812,
      initialDelay: 5.42
    },
    {
      skillId: 67795,
      initialDelay: 5.856
    },
    {
      skillId: 67817,
      initialDelay: 6.696
    },
    {
      skillId: 67795,
      initialDelay: 6.855
    },
    {
      skillId: 67817,
      initialDelay: 7.2170000000000005
    },
    {
      skillId: 67817,
      initialDelay: 7.8180000000000005
    },
    {
      skillId: 67807,
      initialDelay: 9.606666666666666
    },
    {
      skillId: 67812,
      initialDelay: 10.126666666666665
    },
    {
      skillId: 67812,
      initialDelay: 10.486666666666666
    },
    {
      skillId: 67817,
      initialDelay: 11.762666666666666
    },
    {
      skillId: 67817,
      initialDelay: 12.283666666666665
    },
    {
      skillId: 67817,
      initialDelay: 12.884666666666666
    },
    {
      skillId: 67807,
      initialDelay: 14.673333333333332
    },
    {
      skillId: 67812,
      initialDelay: 15.193333333333332
    },
    {
      skillId: 67812,
      initialDelay: 15.553333333333333
    },
    {
      skillId: 67817,
      initialDelay: 16.82933333333333
    },
    {
      skillId: 67817,
      initialDelay: 17.35033333333333
    },
    {
      skillId: 67817,
      initialDelay: 17.95133333333333
    },
    {
      skillId: 67818,
      initialDelay: 19.413999999999998
    },
    {
      skillId: 67818,
      initialDelay: 19.936999999999998
    },
    {
      skillId: 67818,
      initialDelay: 20.537
    },
    {
      skillId: 67807,
      initialDelay: 22.258
    },
    {
      skillId: 67812,
      initialDelay: 22.778
    },
    {
      skillId: 67812,
      initialDelay: 23.137999999999998
    },
    {
      skillId: 67817,
      initialDelay: 24.413999999999998
    },
    {
      skillId: 67817,
      initialDelay: 24.935
    },
    {
      skillId: 67817,
      initialDelay: 25.536
    }
  ]
});

/** Well of Sorrow selects by stable effect identity, so removing one candidate never shifts the others. */
export function guildAttackConditions(runtime: ThiefRuntime, skill: Skill): readonly ConditionEffect[] {
  const conditions = (skill.effects || []).filter((effect): effect is ConditionEffect => effect.type === 'condition');

  if (skill.id !== 67795) return conditions;

  const priority = [CONDITION.POISONED, CONDITION.BLEEDING, CONDITION.TORMENT];
  const missing = priority.every((condition) => permanentTargetConditionStacks(runtime.config, condition) > 0)
    ? undefined
    : priority.find((condition) => !runtime.combat.targetHasCondition(condition, runtime.time));
  return conditions.filter((effect) => effect.name === (missing ?? 'Fallback Torment'));
}
