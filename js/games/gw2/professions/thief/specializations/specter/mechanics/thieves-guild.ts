import type { ThiefSummonCondition, ThiefSummonDefinition, ThiefSummonStrike } from '#gw2/professions/thief/types.js';

const SKILL = Object.freeze({
  WELL_OF_SORROW: 67795,
  SHADOW_BOLT: 67807,
  DOUBLE_BOLT: 67812,
  TRIPLE_BOLT: 67817,
  TRIPLE_THREAT: 67818
});

const THIEVES_GUILD_CAST_TIME = 1.5;
const TRIPLE_THREAT_READY_AT = 16 - THIEVES_GUILD_CAST_TIME;
const ACTIVE_LIFETIME = 24 - THIEVES_GUILD_CAST_TIME;
const AUTO_CHAIN_START = 5.235 - THIEVES_GUILD_CAST_TIME;
const AUTO_CHAIN_DURATION = (20.435 - 5.235) / 3;
const TORMENT: readonly ThiefSummonCondition[] = Object.freeze([{ condition: 'Torment', stacks: 1, duration: 2 }]);

function packet(
  name: string,
  skillId: number,
  coefficientPerHit: number,
  initialDelay: number,
  conditions: readonly ThiefSummonCondition[] = TORMENT
): ThiefSummonStrike {
  return { name, skillId, coefficientPerHit, hits: 1, initialDelay, conditions };
}

function specterAttackPattern(): readonly ThiefSummonStrike[] {
  const attacks: ThiefSummonStrike[] = [
    packet('Shadow Bolt', SKILL.SHADOW_BOLT, 0.33, 2.517 - THIEVES_GUILD_CAST_TIME),
    packet('Well of Sorrow', SKILL.WELL_OF_SORROW, 0.33, 4.358 - THIEVES_GUILD_CAST_TIME, [
      { condition: 'Poisoned', stacks: 1, duration: 3 }
    ]),
    packet('Well of Sorrow', SKILL.WELL_OF_SORROW, 0.33, 5.357 - THIEVES_GUILD_CAST_TIME, [
      { condition: 'Torment', stacks: 2, duration: 4 }
    ]),
    packet('Well of Sorrow', SKILL.WELL_OF_SORROW, 0.33, 6.358 - THIEVES_GUILD_CAST_TIME, [
      { condition: 'Torment', stacks: 1, duration: 4 }
    ]),
    packet('Well of Sorrow', SKILL.WELL_OF_SORROW, 0.33, 7.356 - THIEVES_GUILD_CAST_TIME, [
      { condition: 'Torment', stacks: 1, duration: 4 }
    ]),
    packet('Well of Sorrow', SKILL.WELL_OF_SORROW, 0.33, 8.355 - THIEVES_GUILD_CAST_TIME, [
      { condition: 'Poisoned', stacks: 1, duration: 3 }
    ])
  ];
  let nextActionAt = AUTO_CHAIN_START;
  let tripleThreatUsed = false;

  // The summon checks Triple Threat's 16-second initial cooldown only between complete autoattack chains.
  while (nextActionAt < ACTIVE_LIFETIME) {
    if (!tripleThreatUsed && nextActionAt >= TRIPLE_THREAT_READY_AT) {
      for (const impactOffset of [0.479, 1.002, 1.602]) {
        attacks.push(packet('Triple Threat', SKILL.TRIPLE_THREAT, 0.45, nextActionAt + impactOffset));
      }

      tripleThreatUsed = true;
      nextActionAt += 2.518;
      continue;
    }

    attacks.push(packet('Shadow Bolt', SKILL.SHADOW_BOLT, 0.33, nextActionAt + 0.805));
    for (const impactOffset of [1.325, 1.685]) {
      attacks.push(packet('Double Bolt', SKILL.DOUBLE_BOLT, 0.375, nextActionAt + impactOffset));
    }

    for (const impactOffset of [2.961, 3.482, 4.083]) {
      attacks.push(packet('Triple Bolt', SKILL.TRIPLE_BOLT, 0.45, nextActionAt + impactOffset));
    }

    nextActionAt += AUTO_CHAIN_DURATION;
  }

  return Object.freeze(attacks.sort((left, right) => left.initialDelay - right.initialDelay));
}

// Specter owns the scepter-wielding third summon selected by Thieves Guild.
export const SPECTER_THIEVES_GUILD_SUMMON: ThiefSummonDefinition = Object.freeze({
  name: 'Scepter Specter',
  displayName: 'Specter',
  variant: 'Specter',
  weapon: 'Scepter',
  weaponStrengthProfileId: 'weapon.scepter',
  attacks: specterAttackPattern()
});
