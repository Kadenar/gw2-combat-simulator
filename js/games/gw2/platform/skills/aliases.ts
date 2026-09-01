import type { SkillId } from '#gw2/platform/engine/types.js';

/** Verified external skill IDs that represent an existing canonical simulator skill. */
export const GW2_SKILL_ID_ALIASES: Readonly<Record<number, number>> = Object.freeze({
  // Warrior
  14422: 14353, // Eviscerate
  14425: 14414, // Skull Crack
  14473: 14396, // Kill Shot
  14474: 14396, // Kill Shot
  14475: 14396, // Kill Shot
  42041: 14396, // Kill Shot
  14512: 14387, // Earthshaker
  14520: 14506, // Combustive Shot
  14469: 14544, // Forceful Shot
  14545: 14375, // Arcing Slice
  14549: 14443, // Whirling Strike
  30435: 30185, // Berserk
  69297: 45252, // Breaching Strike
  69433: 45252, // Breaching Strike
  72029: 71932, // Path to Victory
  72911: 73024, // Harrier's Toss
  80252: 80203, // Bloodthirster
  80263: 80203, // Bloodthirster

  // Guardian
  9268: 9118, // Virtue of Courage
  9250: 9120, // Virtue of Resolve
  46170: 9125, // Hammer of Wisdom
  68666: 9154, // Renewed Focus
  44846: 9168, // Sword of Justice
  43565: 9175, // Bow of Truth
  68670: 29965, // Feel My Wrath
  68686: 30273, // Dragon's Maw
  68648: 41780, // Tome of Resolve
  68650: 42259, // Tome of Courage
  68647: 44364, // Tome of Justice
  62532: 62648, // Crashing Courage
  78770: 78358, // Radiant Courage
  78604: 78514, // Radiant Resolve

  // Engineer
  29591: 5865, // Utility Goggles
  29991: 5811, // Personal Battering Ram
  30881: 21659, // A.E.D.

  // Thief
  80278: 40436, // Death's Advance
  76744: 77230, // Canach-Coin Toss

  // Necromancer
  42297: 44946, // Manifest Sand Shade
  46473: 44946, // Manifest Sand Shade
  46474: 44946, // Manifest Sand Shade

  // Revenant
  29082: 27025, // Natural Harmony
  29114: 27356, // Energy Expulsion
  29197: 27715, // Purifying Essence
  46409: 41858, // Legendary Renegade Stance
  76917: 76805, // Beguiling Haze (underwater follow-up)
  77159: 77141 // Beguiling Haze (terrestrial follow-up)
});

/** Canonicalizes reviewed compatibility IDs at input boundaries while leaving every other ID unchanged. */
export function canonicalGw2SkillId(skillId: number): number;
export function canonicalGw2SkillId(skillId: SkillId): SkillId;
export function canonicalGw2SkillId(skillId: SkillId): SkillId {
  return typeof skillId === 'number' ? (GW2_SKILL_ID_ALIASES[skillId] ?? skillId) : skillId;
}
