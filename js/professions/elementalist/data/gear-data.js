// Shared equipment, upgrade, and consumable data is owned by platform/gw2.
// Elementalist keeps only its profession-specific weapon and relic options.
export {
  BASE_STATS,
  effectiveSlotToGearSlot,
  FOOD_DATA,
  FOOD_GROUPS,
  FOOD_NAMES,
  GEAR_SLOTS,
  GEAR_STATS,
  getActiveGearSlots,
  INFUSION_BONUS,
  INFUSION_STATS,
  JBC_BONUS,
  PREFIXES,
  RUNE_DATA,
  RUNE_GROUPS,
  RUNE_NAMES,
  SIGIL_DATA,
  SIGIL_NAMES,
  UTILITY_CONVERSION_RATES,
  UTILITY_DATA,
  UTILITY_NAMES,
  WEAPON_SLOTS,
} from "../../../platform/gw2/gear-data.js";

const sortNames = values => [...values].sort((left, right) =>
  left.localeCompare(right));

export const WEAPON_DATA = Object.freeze({
  Pistol: { wielding: "mh", weaponStrength: 1000 },
  Sword: { wielding: "mh", weaponStrength: 1000 },
  Scepter: { wielding: "mh", weaponStrength: 1000 },
  Dagger: { wielding: "mh+oh", weaponStrength: 1000 },
  Focus: { wielding: "oh", weaponStrength: 900 },
  Warhorn: { wielding: "oh", weaponStrength: 900 },
  Staff: { wielding: "2h", weaponStrength: 1100 },
  Hammer: { wielding: "2h", weaponStrength: 1100 },
  Spear: { wielding: "2h", weaponStrength: 1000 },
  Unequipped: { wielding: "-", weaponStrength: 690.5 },
  "Profession mechanic": { wielding: "-", weaponStrength: 1100 },
});

export const RELIC_DATA = Object.freeze({
  Akeem: {
    trigger: "CC enemy with 5+ Torment/Confusion stacks",
    cooldown: 10,
  },
  Fireworks: { trigger: "Use weapon skill (CD ≥20s)", cooldown: 0 },
  Mistburn: { trigger: "At least 10 Might stacks", cooldown: 0 },
  "Mist Stranger": {
    trigger: "Extra flat damage on every hit",
    cooldown: 0,
  },
  "Mount Balrior": { trigger: "Use elite skill", cooldown: 30 },
  Nourys: {
    trigger: "Gain 1 stack every 3s in combat (10 stacks → 5s damage buff)",
    cooldown: 0,
  },
  Peitha: { trigger: "Shadowstep or deception skill", cooldown: 4 },
  Aristocracy: {
    trigger: "Apply weakness or vulnerability",
    cooldown: 1,
  },
  Blightbringer: {
    trigger: "6th poison application on enemy",
    cooldown: 8,
  },
  Brawler: { trigger: "Gain protection or resolution", cooldown: 8 },
  Claw: { trigger: "CC enemy", cooldown: 0 },
  Dragonhunter: { trigger: "Use trap skill", cooldown: 0 },
  Eagle: { trigger: "Enemy below 50% HP", cooldown: 0 },
  Fractal: {
    trigger: "Apply bleeding on enemy with 6+ bleed stacks",
    cooldown: 20,
  },
  Krait: { trigger: "Use elite skill", cooldown: 30 },
  Thorns: {
    trigger: "Gain Condition Damage when struck by enemies",
    cooldown: 5,
  },
  Thief: {
    trigger: "Use weapon skill with CD or resource cost",
    cooldown: 0,
  },
  Weaver: { trigger: "Use stance skill", cooldown: 0 },
  Fire: { trigger: "Use healing skill (grants Fire Aura 4s)", cooldown: 20 },
  Bloodstone: {
    trigger: "Blast finisher combo (4 stacks → explosion)",
    cooldown: 0,
  },
  Steamshrieker: {
    trigger: "Combo water field with Leap or Blast finisher",
    cooldown: 0,
  },
});

export const RELIC_NAMES = Object.freeze(sortNames(Object.keys(RELIC_DATA)));
