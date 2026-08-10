// Shared equipment, upgrade, and consumable data is owned by platform/gw2.
// Elementalist keeps only its profession-specific weapon and relic options.
import {
  FOOD_DATA,
  FOOD_GROUPS as SHARED_FOOD_GROUPS,
  RUNE_DATA,
  SIGIL_GROUPS as SHARED_SIGIL_GROUPS,
  SIGIL_NAMES as SHARED_SIGIL_NAMES,
  WEAPON_DATA as SHARED_WEAPON_DATA,
} from "../../../platform/gw2/gear-data.js";

export {
  BASE_STATS,
  effectiveSlotToGearSlot,
  FOOD_DATA,
  GEAR_SLOTS,
  GEAR_STATS,
  getActiveGearSlots,
  INFUSION_BONUS,
  INFUSION_STATS,
  JBC_BONUS,
  PREFIXES,
  PREFIX_GROUPS,
  RUNE_DATA,
  RUNE_GROUPS,
  SIGIL_DATA,
  UTILITY_CONVERSION_RATES,
  UTILITY_DATA,
  UTILITY_NAMES,
  WEAPON_SLOTS,
} from "../../../platform/gw2/gear-data.js";

const sortNames = (values: readonly string[]): string[] =>
  [...values].sort((left, right) => left.localeCompare(right));

// The legacy engine does not consume the shared day/night simulation setting.
const DAY_NIGHT_FOODS = new Set(["Ghost Pepper Popper"]);
const DAY_NIGHT_SIGILS = new Set(["Night"]);

// Keep derived display lists local so an older cached copy of the shared module
// remains compatible while a GitHub Pages deployment propagates.
export const FOOD_NAMES = Object.freeze(
  sortNames(
    Object.keys(FOOD_DATA).filter((name) => !DAY_NIGHT_FOODS.has(name)),
  ),
);
export const FOOD_GROUPS = Object.freeze(
  SHARED_FOOD_GROUPS.map((group) => ({
    ...group,
    items: group.items.filter((name) => !DAY_NIGHT_FOODS.has(name)),
  })).filter((group) => group.items.length > 0),
);
export const RUNE_NAMES = Object.freeze(sortNames(Object.keys(RUNE_DATA)));
export const SIGIL_NAMES = Object.freeze(
  SHARED_SIGIL_NAMES.filter((name) => !DAY_NIGHT_SIGILS.has(name)),
);
export const SIGIL_GROUPS = Object.freeze(
  SHARED_SIGIL_GROUPS.map((group) => ({
    ...group,
    items: group.items.filter((name) => !DAY_NIGHT_SIGILS.has(name)),
  })).filter((group) => group.items.length > 0),
);

export const WEAPON_DATA = Object.freeze({
  Pistol: { ...SHARED_WEAPON_DATA.Pistol, wielding: "mh" },
  Sword: { ...SHARED_WEAPON_DATA.Sword, wielding: "mh" },
  Scepter: { ...SHARED_WEAPON_DATA.Scepter, wielding: "mh" },
  Dagger: { ...SHARED_WEAPON_DATA.Dagger, wielding: "mh+oh" },
  Focus: { ...SHARED_WEAPON_DATA.Focus, wielding: "oh" },
  Warhorn: { ...SHARED_WEAPON_DATA.Warhorn, wielding: "oh" },
  Staff: { ...SHARED_WEAPON_DATA.Staff, wielding: "2h" },
  Hammer: { ...SHARED_WEAPON_DATA.Hammer, wielding: "2h" },
  Spear: { ...SHARED_WEAPON_DATA.Spear, wielding: "2h" },
  Unequipped: SHARED_WEAPON_DATA.Unequipped,
  "Profession mechanic": SHARED_WEAPON_DATA["Profession mechanic"],
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
  Shackles: {
    trigger: "Immobilize an enemy (5s tether, 3.0 strike on expiry)",
    cooldown: 10,
    icon: "https://render.guildwars2.com/file/7946A50DBDC2E45E004AAA801904015C50CC22B3/3745069.png",
  },
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
