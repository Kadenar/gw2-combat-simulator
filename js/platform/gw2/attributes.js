import {
  BASE_STATS,
  FOOD_DATA,
  GEAR_SLOTS,
  GEAR_STATS,
  INFUSION_BONUS,
  JBC_BONUS,
  RUNE_DATA,
  SIGIL_DATA,
  UTILITY_CONVERSION_RATES,
  UTILITY_DATA,
  WEAPON_DATA,
} from "./gear-data.js";
import {
  normalizeWeaponSigils,
  weaponSigilsForSet,
} from "./weapon-sigils.js";

export const PRIMARY_ATTRIBUTES = Object.freeze([
  "Power",
  "Precision",
  "Toughness",
  "Vitality",
  "Ferocity",
  "Condition Damage",
  "Expertise",
  "Concentration",
  "Healing Power",
]);

export const CONDITION_DURATION_ATTRIBUTES = Object.freeze([
  "Burning Duration",
  "Bleeding Duration",
  "Torment Duration",
  "Confusion Duration",
  "Poison Duration",
]);

export const BOON_DURATION_ATTRIBUTES = Object.freeze([
  "Quickness Duration",
  "Might Duration",
  "Fury Duration",
]);

export const SPECIFIC_DURATION_ATTRIBUTES = Object.freeze([
  ...CONDITION_DURATION_ATTRIBUTES,
  ...BOON_DURATION_ATTRIBUTES,
]);

export function addAttribute(target, key, value) {
  if (value) target[key] = (target[key] || 0) + value;
}

export function addAttributes(target, source) {
  for (const [key, value] of Object.entries(source || {})) {
    addAttribute(target, key, value);
  }
}

export function derivedAttribute(
  final,
  traits = 0,
  sigils = 0,
  runeBonus = 0,
  foodBonus = 0,
) {
  return {
    final,
    base: 0,
    gear: 0,
    runes: runeBonus,
    food: foodBonus,
    utility: 0,
    jbc: 0,
    traits,
    sigils,
    infusions: 0,
  };
}

export function calculateCommonAttributes(
  build,
  {
    weaponSet = 1,
    data = {},
    sigilNames = null,
    dedupeSigils = true,
  } = {},
) {
  const baseStats = data.BASE_STATS || BASE_STATS;
  const foodData = data.FOOD_DATA || FOOD_DATA;
  const gearSlots = data.GEAR_SLOTS || GEAR_SLOTS;
  const gearStats = data.GEAR_STATS || GEAR_STATS;
  const infusionBonus = data.INFUSION_BONUS || INFUSION_BONUS;
  const jadeBotBonus = data.JBC_BONUS || JBC_BONUS;
  const runeData = data.RUNE_DATA || RUNE_DATA;
  const sigilData = data.SIGIL_DATA || SIGIL_DATA;
  const utilityRates =
    data.UTILITY_CONVERSION_RATES || UTILITY_CONVERSION_RATES;
  const utilityData = data.UTILITY_DATA || UTILITY_DATA;
  const weaponData = data.WEAPON_DATA || WEAPON_DATA;
  const gear = {};
  const runes = {};
  const foodConverted = {};
  const foodBuff = {};
  const foodDurations = {};
  const runeDurations = {};
  const utility = {};
  const sigilDurations = {};
  const infusions = {};

  const selectedWeapons = weaponSet === 2
    ? build.alternateWeapons
    : build.weapons;
  const mainHand = selectedWeapons?.[0] || "";
  const isTwoHanded = weaponData[mainHand]?.wielding === "2h";
  for (const slot of gearSlots) {
    if (isTwoHanded && slot === "Weapon2") continue;
    const statSlot = isTwoHanded && slot === "Weapon1" ? "Weapon2H" : slot;
    addAttributes(gear, gearStats[build.gear?.[slot]]?.[statSlot]);
  }
  const rune = runeData[build.rune];
  addAttributes(runes, rune?.stats);
  addAttributes(runeDurations, rune?.durations);
  const food = foodData[build.food];
  addAttributes(food?.isConverted ? foodConverted : foodBuff, food?.stats);
  addAttributes(foodDurations, food?.durations);

  const conversionPool = {};
  const conversionPoolNoFood = {};
  for (const stat of PRIMARY_ATTRIBUTES) {
    conversionPool[stat] =
      (baseStats[stat] || 0)
      + (gear[stat] || 0)
      + (runes[stat] || 0)
      + (foodConverted[stat] || 0)
      + (build.jadeBotCore ? jadeBotBonus[stat] || 0 : 0);
    conversionPoolNoFood[stat] =
      (baseStats[stat] || 0)
      + (gear[stat] || 0)
      + (runes[stat] || 0)
      + (build.jadeBotCore ? jadeBotBonus[stat] || 0 : 0);
  }
  for (const conversion of utilityData[build.utility] || []) {
    const rate = (utilityRates[conversion.from] || 0) / 100;
    addAttribute(
      utility,
      conversion.to,
      Math.round((conversionPool[conversion.from] || 0) * rate),
    );
  }

  let sigilCriticalChance = 0;
  const selectedSigils = sigilNames || weaponSigilsForSet(build, weaponSet);
  const effectiveSigils = dedupeSigils
    ? new Set(selectedSigils)
    : selectedSigils;
  for (const name of effectiveSigils) {
    const sigil = sigilData[name];
    if (!sigil) continue;
    if (sigil.conditionDuration) {
      addAttribute(sigilDurations, "Condition Duration", sigil.conditionDuration);
    }
    if (sigil.bleedingDuration) {
      addAttribute(sigilDurations, "Bleeding Duration", sigil.bleedingDuration);
    }
    if (sigil.burningDuration) {
      addAttribute(sigilDurations, "Burning Duration", sigil.burningDuration);
    }
    if (sigil.poisonDuration) {
      addAttribute(sigilDurations, "Poison Duration", sigil.poisonDuration);
    }
    if (sigil.tormentDuration) {
      addAttribute(sigilDurations, "Torment Duration", sigil.tormentDuration);
    }
    if (sigil.boonDuration) {
      addAttribute(sigilDurations, "Boon Duration", sigil.boonDuration);
    }
    sigilCriticalChance += Number(sigil.criticalChance || 0);
  }
  for (const infusion of build.infusions || []) {
    if (infusion?.stat && Number(infusion.count) > 0) {
      addAttribute(infusions, infusion.stat, Number(infusion.count) * infusionBonus);
    }
  }

  const attributes = {};
  for (const stat of PRIMARY_ATTRIBUTES) {
    const breakdown = {
      base: baseStats[stat] || 0,
      gear: gear[stat] || 0,
      runes: runes[stat] || 0,
      food: (foodConverted[stat] || 0) + (foodBuff[stat] || 0),
      utility: utility[stat] || 0,
      jbc: build.jadeBotCore ? jadeBotBonus[stat] || 0 : 0,
      traits: 0,
      sigils: 0,
      infusions: infusions[stat] || 0,
    };
    breakdown.final = Object.values(breakdown)
      .reduce((sum, value) => sum + value, 0);
    attributes[stat] = breakdown;
  }
  const precision = attributes.Precision.final;
  const ferocity = attributes.Ferocity.final;
  const concentration = attributes.Concentration.final;
  const expertise = attributes.Expertise.final;
  attributes["Critical Chance"] = derivedAttribute(
    (precision - 895) / 21 + sigilCriticalChance,
    0,
    sigilCriticalChance,
  );
  attributes["Critical Damage"] = derivedAttribute(150 + ferocity / 15);
  attributes["Boon Duration"] = derivedAttribute(
    concentration / 15
      + (runeDurations["Boon Duration"] || 0)
      + (foodDurations["Boon Duration"] || 0)
      + (sigilDurations["Boon Duration"] || 0),
    0,
    sigilDurations["Boon Duration"] || 0,
    runeDurations["Boon Duration"] || 0,
    foodDurations["Boon Duration"] || 0,
  );
  attributes["Condition Duration"] = derivedAttribute(
    expertise / 15
      + (runeDurations["Condition Duration"] || 0)
      + (foodDurations["Condition Duration"] || 0)
      + (sigilDurations["Condition Duration"] || 0),
    0,
    sigilDurations["Condition Duration"] || 0,
    runeDurations["Condition Duration"] || 0,
    foodDurations["Condition Duration"] || 0,
  );
  for (const key of SPECIFIC_DURATION_ATTRIBUTES) {
    const value =
      (runeDurations[key] || 0)
      + (foodDurations[key] || 0)
      + (sigilDurations[key] || 0);
    if (value) {
      attributes[key] = derivedAttribute(
        value,
        0,
        sigilDurations[key] || 0,
        runeDurations[key] || 0,
        foodDurations[key] || 0,
      );
    }
  }
  return {
    attributes,
    gear: { ...(build.gear || {}) },
    weapons: [...(build.weapons || [])],
    alternateWeapons: [...(build.alternateWeapons || [])],
    runes: build.rune || "",
    weaponSigils: normalizeWeaponSigils(build.weaponSigils),
    relic: build.relic || "",
    food: build.food || "",
    utility: build.utility || "",
    jadeBotCore: Boolean(build.jadeBotCore),
    specializations: [...(build.specializations || [])],
    commonContext: {
      conversionPool,
      conversionPoolNoFood,
      runeDurations,
      foodDurations,
      sigilDurations,
      sigilCriticalChance,
    },
  };
}

/**
 * Builds a profession attribute calculator that assembles the shared common
 * attributes and then applies the profession's own trait/skill rules.
 *
 * Every profession's `calculateAttributes` is this same wrapper; only the
 * `applyBuildAttributeRules` step differs. Rules receive `weaponSet` so
 * calculators that need it can use it; those that do not simply ignore it.
 *
 * @param {Function} applyBuildAttributeRules - `(common, context) => attributeData`
 * @returns {Function} `(build, selectedSkills?, weaponSet?, disabledTrait?)`
 */
export function createCalculateAttributes(applyBuildAttributeRules) {
  return function calculateAttributes(
    build,
    selectedSkills = [],
    weaponSet = 1,
    disabledTrait = null,
  ) {
    const common = calculateCommonAttributes(build, { weaponSet });
    return applyBuildAttributeRules(common, {
      build,
      selectedSkills,
      weaponSet,
      disabledTrait,
    });
  };
}
