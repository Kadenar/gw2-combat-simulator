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

// Attribute calculators preserve a source breakdown because the build UI and
// contribution analysis need more than the final numeric value.
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
  // Zero values do not need entries; negative deltas remain valid.
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
  // Derived percentages use the same shape as primary stats so renderers can
  // consume either without branching on attribute kind.
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
  // Data injection keeps this common pipeline reusable in tests and by
  // professions with supplemental gear tables.
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
    // A two-handed weapon occupies both weapon stat budgets: skip Weapon2 and
    // read the main-hand selection from the Weapon2H coefficient table.
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
  // "Converted" food participates in utility/trait conversions; ordinary
  // food buffs are applied later and must not feed another conversion.
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
    // GW2 stat conversions round each declared conversion independently.
    addAttribute(
      utility,
      conversion.to,
      Math.round((conversionPool[conversion.from] || 0) * rate),
    );
  }

  let sigilCriticalChance = 0;
  const selectedSigils = sigilNames || weaponSigilsForSet(build, weaponSet);
  // Duplicate named sigils do not stack by default. Tests and specialized
  // callers may opt out when modeling a rule with different stacking behavior.
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
  // First build primary attributes and their complete source attribution.
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
  // Derived values are percentages. Trait bonuses are added in finalize after
  // profession rules have resolved their active selections.
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
      // Kept only between common calculation and profession finalization.
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
 * Applies already-resolved profession build deltas and rebuilds derived
 * attributes without exposing the common calculator's internal context.
 */
export function finalizeBuildAttributes(
  common,
  {
    activeTraits,
    traitStats = {},
    traitDurations = {},
    traitCriticalChance = 0,
  },
) {
  // Clone before applying profession deltas so a common result can be reused
  // for disabled-trait comparisons without cross-run mutation.
  const attributes = structuredClone(common.attributes);
  for (const [name, amount] of Object.entries(traitStats)) {
    if (!attributes[name]) continue;
    attributes[name].traits += amount;
    attributes[name].final += amount;
  }

  const {
    runeDurations,
    foodDurations,
    sigilDurations,
    sigilCriticalChance,
  } = common.commonContext;
  const precision = attributes.Precision.final;
  const ferocity = attributes.Ferocity.final;
  const concentration = attributes.Concentration.final;
  const expertise = attributes.Expertise.final;
  // Trait stat changes can affect every derived percentage, so recompute them
  // from finalized primaries instead of incrementally patching prior results.
  attributes["Critical Chance"] = derivedAttribute(
    (precision - 895) / 21
      + Number(traitCriticalChance || 0)
      + sigilCriticalChance,
    Number(traitCriticalChance || 0),
    sigilCriticalChance,
  );
  attributes["Critical Damage"] = derivedAttribute(150 + ferocity / 15);
  attributes["Boon Duration"] = derivedAttribute(
    concentration / 15
      + (runeDurations["Boon Duration"] || 0)
      + (traitDurations["Boon Duration"] || 0)
      + (foodDurations["Boon Duration"] || 0)
      + (sigilDurations["Boon Duration"] || 0),
    traitDurations["Boon Duration"] || 0,
    sigilDurations["Boon Duration"] || 0,
    runeDurations["Boon Duration"] || 0,
    foodDurations["Boon Duration"] || 0,
  );
  attributes["Condition Duration"] = derivedAttribute(
    expertise / 15
      + (runeDurations["Condition Duration"] || 0)
      + (traitDurations["Condition Duration"] || 0)
      + (foodDurations["Condition Duration"] || 0)
      + (sigilDurations["Condition Duration"] || 0),
    traitDurations["Condition Duration"] || 0,
    sigilDurations["Condition Duration"] || 0,
    runeDurations["Condition Duration"] || 0,
    foodDurations["Condition Duration"] || 0,
  );
  for (const key of CONDITION_DURATION_ATTRIBUTES) {
    const value =
      (runeDurations[key] || 0)
      + (traitDurations[key] || 0)
      + (foodDurations[key] || 0)
      + (sigilDurations[key] || 0);
    if (!value) {
      // Remove zero-valued provisional entries to keep the public result sparse.
      delete attributes[key];
      continue;
    }
    attributes[key] = derivedAttribute(
      value,
      traitDurations[key] || 0,
      sigilDurations[key] || 0,
      runeDurations[key] || 0,
      foodDurations[key] || 0,
    );
  }

  const { commonContext, ...result } = common;
  // commonContext is an implementation handoff, not part of the public build.
  return { ...result, attributes, activeTraits };
}

/**
 * Builds a profession attribute calculator that assembles the shared common
 * attributes and then applies the profession's own trait/skill rules.
 *
 * Native profession applications construct this wrapper through
 * `defineProfessionApp`; only the `applyBuildAttributeRules` step differs.
 * Rules receive `weaponSet` so calculators that need it can use it; those that
 * do not simply ignore it.
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
