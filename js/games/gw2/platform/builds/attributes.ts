import { BASE_STATS, GEAR_SLOTS, GEAR_STATS, INFUSION_BONUS, JBC_BONUS } from '#gw2/platform/equipment/gear/stats.js';
import { FOOD_DATA } from '#gw2/platform/equipment/consumables/food.js';
import { RUNE_DATA } from '#gw2/platform/equipment/gear/runes.js';
import { SIGIL_DATA } from '#gw2/platform/equipment/sigils/data.js';
import {
  UTILITY_CONVERSION_RATES,
  UTILITY_DATA,
  UTILITY_STAT_DATA
} from '#gw2/platform/equipment/consumables/utilities.js';
import { WEAPON_DATA } from '#gw2/platform/equipment/weapons/data.js';
import {
  conditionDurationPercentFromExpertise,
  criticalChancePercentFromPrecision,
  criticalDamagePercentFromFerocity
} from '#gw2/platform/combat/damage/stat-scaling.js';
import { normalizeWeaponSigils, weaponSigilsForSet } from '#gw2/platform/equipment/sigils/loadout.js';

import type { Skill } from '#gw2/platform/engine/types.js';
import type {
  Gw2ApplyBuildAttributeRules,
  Gw2AttributeBreakdown,
  Gw2AttributeData,
  Gw2AttributeEffect,
  Gw2AttributeMap,
  Gw2Build,
  Gw2CalculateAttributes,
  Gw2CommonAttributeResult,
  Gw2FinalizedAttributeResult,
  Gw2NumericAttributes
} from '#gw2/platform/builds/types.js';

interface CalculateCommonAttributesOptions {
  readonly weaponSet?: number;
  readonly data?: Gw2AttributeData;
  readonly sigilNames?: readonly string[] | null;
  readonly dedupeSigils?: boolean;
}

interface FinalizeBuildAttributesOptions {
  readonly activeTraits: unknown;
  readonly traitStats?: Readonly<Gw2NumericAttributes>;
  readonly traitDurations?: Readonly<Gw2NumericAttributes>;
  readonly traitCriticalChance?: number;
}

// Attribute calculators preserve a source breakdown because the build UI and
// contribution analysis need more than the final numeric value.
export const PRIMARY_ATTRIBUTES = Object.freeze([
  'Power',
  'Precision',
  'Toughness',
  'Vitality',
  'Ferocity',
  'Condition Damage',
  'Expertise',
  'Concentration',
  'Healing Power'
]);

export const CONDITION_DURATION_ATTRIBUTES = Object.freeze([
  'Burning Duration',
  'Bleeding Duration',
  'Torment Duration',
  'Confusion Duration',
  'Poison Duration'
]);

export const BOON_DURATION_ATTRIBUTES = Object.freeze(['Quickness Duration', 'Might Duration', 'Fury Duration']);

export const SPECIFIC_DURATION_ATTRIBUTES = Object.freeze([
  ...CONDITION_DURATION_ATTRIBUTES,
  ...BOON_DURATION_ATTRIBUTES
]);

/** Adds a nonzero numeric contribution to an attribute accumulator. */
export function addAttribute(target: Gw2NumericAttributes, key: string, value: number): void {
  // Zero values do not need entries; negative deltas remain valid.
  if (value) target[key] = (target[key] || 0) + value;
}

/** Merges every numeric contribution from one attribute map into another. */
export function addAttributes(
  target: Gw2NumericAttributes,
  source: Readonly<Gw2NumericAttributes> | null | undefined
): void {
  for (const [key, value] of Object.entries(source || {})) {
    addAttribute(target, key, value);
  }
}

/**
 * Resolves flat attribute effects and conversions in separate phases. Only
 * explicitly eligible flat effects are added to the conversion snapshot, and
 * conversion results never become inputs to later conversions.
 */
export function resolveAttributeEffects(
  commonConversionPool: Readonly<Gw2NumericAttributes>,
  effects: readonly Gw2AttributeEffect[]
): Gw2NumericAttributes {
  const activeEffects = effects.filter((effect) => effect.enabled !== false);
  const traitStats: Gw2NumericAttributes = {};
  const eligibleConversionPool = { ...commonConversionPool };

  for (const effect of activeEffects) {
    if (effect.kind !== 'flat') continue;
    addAttribute(traitStats, effect.to, effect.amount);
    if (effect.feedsConversions) {
      addAttribute(eligibleConversionPool, effect.to, effect.amount);
    }
  }

  for (const effect of activeEffects) {
    if (effect.kind !== 'conversion') continue;
    const inputPool = effect.input === 'common' ? commonConversionPool : eligibleConversionPool;
    const rawAmount = (inputPool[effect.from] ?? 0) * effect.multiplier + (effect.addend ?? 0);
    const amount =
      effect.rounding === 'round'
        ? Math.round(rawAmount)
        : effect.rounding === 'floor'
          ? Math.floor(rawAmount)
          : rawAmount;
    addAttribute(traitStats, effect.to, amount);
  }

  return traitStats;
}

/** Builds a standard attribute breakdown for a derived percentage value. */
export function derivedAttribute(
  final: number,
  traits = 0,
  sigils = 0,
  runeBonus = 0,
  foodBonus = 0
): Gw2AttributeBreakdown {
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
    infusions: 0
  };
}

interface RecomputeDerivedOptions {
  readonly runeDurations: Readonly<Gw2NumericAttributes>;
  readonly foodDurations: Readonly<Gw2NumericAttributes>;
  readonly sigilDurations: Readonly<Gw2NumericAttributes>;
  readonly sigilCriticalChance: number;
  readonly traitCriticalChance?: number;
  readonly traitDurations?: Readonly<Gw2NumericAttributes>;
  readonly specificKeys: readonly string[];
  readonly pruneZeros?: boolean;
}

/**
 * Rebuilds every percentage-derived attribute from the current finalized
 * primaries. Shared by the pre-trait common pass and the finalized pass: trait
 * terms default to zero, and because `x + 0 === x` for finite floats, the
 * common pass produces results identical to the prior inlined block.
 *
 * Derived stats use percent-form scaling helpers so the exact values asserted
 * by the attribute tests do not shift under the fraction form's different
 * evaluation order.
 */
function recomputeDerivedAttributes(
  attributes: Gw2AttributeMap,
  {
    runeDurations,
    foodDurations,
    sigilDurations,
    sigilCriticalChance,
    traitCriticalChance = 0,
    traitDurations = {},
    specificKeys,
    pruneZeros = false
  }: RecomputeDerivedOptions
): void {
  const precision = attributes.Precision.final;
  const ferocity = attributes.Ferocity.final;
  const concentration = attributes.Concentration.final;
  const expertise = attributes.Expertise.final;
  const traitCrit = Number(traitCriticalChance || 0);
  attributes['Critical Chance'] = derivedAttribute(
    criticalChancePercentFromPrecision(precision) + traitCrit + sigilCriticalChance,
    traitCrit,
    sigilCriticalChance
  );
  attributes['Critical Damage'] = derivedAttribute(criticalDamagePercentFromFerocity(ferocity));
  attributes['Boon Duration'] = derivedAttribute(
    concentration / 15 +
      (runeDurations['Boon Duration'] || 0) +
      (traitDurations['Boon Duration'] || 0) +
      (foodDurations['Boon Duration'] || 0) +
      (sigilDurations['Boon Duration'] || 0),
    traitDurations['Boon Duration'] || 0,
    sigilDurations['Boon Duration'] || 0,
    runeDurations['Boon Duration'] || 0,
    foodDurations['Boon Duration'] || 0
  );
  attributes['Condition Duration'] = derivedAttribute(
    conditionDurationPercentFromExpertise(expertise) +
      (runeDurations['Condition Duration'] || 0) +
      (traitDurations['Condition Duration'] || 0) +
      (foodDurations['Condition Duration'] || 0) +
      (sigilDurations['Condition Duration'] || 0),
    traitDurations['Condition Duration'] || 0,
    sigilDurations['Condition Duration'] || 0,
    runeDurations['Condition Duration'] || 0,
    foodDurations['Condition Duration'] || 0
  );
  for (const key of specificKeys) {
    const value =
      (runeDurations[key] || 0) + (traitDurations[key] || 0) + (foodDurations[key] || 0) + (sigilDurations[key] || 0);
    if (!value) {
      // Finalize prunes zero-valued provisional entries to keep the public
      // result sparse; the common pass simply never adds them.
      if (pruneZeros) delete attributes[key];
      continue;
    }

    attributes[key] = derivedAttribute(
      value,
      traitDurations[key] || 0,
      sigilDurations[key] || 0,
      runeDurations[key] || 0,
      foodDurations[key] || 0
    );
  }
}

/** Calculates profession-neutral base, gear, upgrade, consumable, and infusion attributes. */
export function calculateCommonAttributes(
  build: Gw2Build,
  { weaponSet = 1, data = {}, sigilNames = null, dedupeSigils = true }: CalculateCommonAttributesOptions = {}
): Gw2CommonAttributeResult {
  // Data injection keeps this common pipeline reusable in tests and by
  // professions with supplemental gear tables.
  const baseStats: Readonly<Gw2NumericAttributes> = data.BASE_STATS || BASE_STATS;
  const foodData: NonNullable<Gw2AttributeData['FOOD_DATA']> = data.FOOD_DATA || FOOD_DATA;
  const gearSlots = data.GEAR_SLOTS || GEAR_SLOTS;
  const gearStats: NonNullable<Gw2AttributeData['GEAR_STATS']> = data.GEAR_STATS || GEAR_STATS;
  const infusionBonus = data.INFUSION_BONUS || INFUSION_BONUS;
  const jadeBotBonus: Readonly<Gw2NumericAttributes> = data.JBC_BONUS || JBC_BONUS;
  const runeData: NonNullable<Gw2AttributeData['RUNE_DATA']> = data.RUNE_DATA || RUNE_DATA;
  const sigilData: NonNullable<Gw2AttributeData['SIGIL_DATA']> = data.SIGIL_DATA || SIGIL_DATA;
  const utilityRates: Readonly<Gw2NumericAttributes> = data.UTILITY_CONVERSION_RATES || UTILITY_CONVERSION_RATES;
  const utilityData: NonNullable<Gw2AttributeData['UTILITY_DATA']> = data.UTILITY_DATA || UTILITY_DATA;
  const utilityStatData: NonNullable<Gw2AttributeData['UTILITY_STAT_DATA']> =
    data.UTILITY_STAT_DATA || UTILITY_STAT_DATA;
  const weaponData: NonNullable<Gw2AttributeData['WEAPON_DATA']> = data.WEAPON_DATA || WEAPON_DATA;
  const gear: Gw2NumericAttributes = {};
  const runes: Gw2NumericAttributes = {};
  const foodConverted: Gw2NumericAttributes = {};
  const foodBuff: Gw2NumericAttributes = {};
  const foodDurations: Gw2NumericAttributes = {};
  const runeDurations: Gw2NumericAttributes = {};
  const utility: Gw2NumericAttributes = {};
  const sigilDurations: Gw2NumericAttributes = {};
  const infusions: Gw2NumericAttributes = {};

  const selectedWeapons = weaponSet === 2 ? build.alternateWeapons : build.weapons;
  const mainHand = selectedWeapons?.[0] || '';
  const isTwoHanded = weaponData[mainHand]?.wielding === '2h';
  for (const slot of gearSlots) {
    // A two-handed weapon occupies both weapon stat budgets: skip Weapon2 and
    // read the main-hand selection from the Weapon2H coefficient table.
    if (isTwoHanded && slot === 'Weapon2') continue;
    const statSlot = isTwoHanded && slot === 'Weapon1' ? 'Weapon2H' : slot;
    const weaponSlot = slot === 'Weapon1' ? 0 : slot === 'Weapon2' ? 1 : -1;
    const prefix =
      weaponSet === 2 && weaponSlot >= 0
        ? build.alternateWeaponPrefixes?.[weaponSlot] || build.gear?.[slot] || ''
        : build.gear?.[slot] || '';
    addAttributes(gear, gearStats[prefix]?.[statSlot]);
  }

  const rune = runeData[build.rune || ''];
  addAttributes(runes, rune?.stats);
  addAttributes(runeDurations, rune?.durations);
  const food = foodData[build.food || ''];
  addAttributes(food?.isConverted ? foodConverted : foodBuff, food?.stats);
  addAttributes(foodDurations, food?.durations);
  for (const infusion of build.infusions || []) {
    if (infusion?.stat && Number(infusion.count) > 0) {
      addAttribute(infusions, infusion.stat, Number(infusion.count) * infusionBonus);
    }
  }

  const conversionPool: Gw2NumericAttributes = {};
  const conversionPoolNoFood: Gw2NumericAttributes = {};
  // "Converted" food participates in utility/trait conversions; ordinary
  // food buffs are applied later and must not feed another conversion.
  for (const stat of PRIMARY_ATTRIBUTES) {
    conversionPool[stat] =
      (baseStats[stat] || 0) +
      (gear[stat] || 0) +
      (runes[stat] || 0) +
      (foodConverted[stat] || 0) +
      (infusions[stat] || 0) +
      (build.jadeBotCore ? jadeBotBonus[stat] || 0 : 0);
    conversionPoolNoFood[stat] =
      (baseStats[stat] || 0) +
      (gear[stat] || 0) +
      (runes[stat] || 0) +
      (infusions[stat] || 0) +
      (build.jadeBotCore ? jadeBotBonus[stat] || 0 : 0);
  }

  for (const conversion of utilityData[build.utility || ''] || []) {
    // Explicit rates support uniform all-attribute boosts; ordinary utility
    // conversions continue to derive their rate from the source attribute.
    const rate = (conversion.percent ?? utilityRates[conversion.from] ?? 0) / 100;
    // GW2 stat conversions round each declared conversion independently.
    addAttribute(utility, conversion.to, Math.round((conversionPool[conversion.from] || 0) * rate));
  }

  addAttributes(utility, utilityStatData[build.utility || '']);

  let sigilCriticalChance = 0;
  const selectedSigils = sigilNames || weaponSigilsForSet(build, weaponSet);
  // Duplicate named sigils do not stack by default. Tests and specialized
  // callers may opt out when modeling a rule with different stacking behavior.
  const effectiveSigils = dedupeSigils ? new Set(selectedSigils) : selectedSigils;
  for (const name of effectiveSigils) {
    const sigil = sigilData[name];
    if (!sigil) continue;
    if (sigil.conditionDuration) {
      addAttribute(sigilDurations, 'Condition Duration', sigil.conditionDuration);
    }

    if (sigil.bleedingDuration) {
      addAttribute(sigilDurations, 'Bleeding Duration', sigil.bleedingDuration);
    }

    if (sigil.burningDuration) {
      addAttribute(sigilDurations, 'Burning Duration', sigil.burningDuration);
    }

    if (sigil.poisonDuration) {
      addAttribute(sigilDurations, 'Poison Duration', sigil.poisonDuration);
    }

    if (sigil.tormentDuration) {
      addAttribute(sigilDurations, 'Torment Duration', sigil.tormentDuration);
    }

    if (sigil.boonDuration) {
      addAttribute(sigilDurations, 'Boon Duration', sigil.boonDuration);
    }

    sigilCriticalChance += Number(sigil.criticalChance || 0);
  }

  const attributes: Gw2AttributeMap = {};
  // First build primary attributes and their complete source attribution.
  for (const stat of PRIMARY_ATTRIBUTES) {
    const breakdown: Gw2AttributeBreakdown = {
      final: 0,
      base: baseStats[stat] || 0,
      gear: gear[stat] || 0,
      runes: runes[stat] || 0,
      food: (foodConverted[stat] || 0) + (foodBuff[stat] || 0),
      utility: utility[stat] || 0,
      jbc: build.jadeBotCore ? jadeBotBonus[stat] || 0 : 0,
      traits: 0,
      sigils: 0,
      infusions: infusions[stat] || 0
    };
    breakdown.final = Object.values(breakdown).reduce((sum, value) => sum + value, 0);
    attributes[stat] = breakdown;
  }

  // Derived percentages are rebuilt from finalized primaries; trait bonuses are
  // applied later in finalizeBuildAttributes once profession rules resolve.
  recomputeDerivedAttributes(attributes, {
    runeDurations,
    foodDurations,
    sigilDurations,
    sigilCriticalChance,
    specificKeys: SPECIFIC_DURATION_ATTRIBUTES
  });
  return {
    attributes,
    gear: { ...(build.gear || {}) },
    alternateWeaponPrefixes: [
      ...(build.alternateWeaponPrefixes || [build.gear?.Weapon1 || '', build.gear?.Weapon2 || ''])
    ],
    weapons: [...(build.weapons || [])],
    alternateWeapons: [...(build.alternateWeapons || [])],
    runes: build.rune || '',
    weaponSigils: normalizeWeaponSigils(build.weaponSigils),
    relic: build.relic || '',
    food: build.food || '',
    utility: build.utility || '',
    jadeBotCore: Boolean(build.jadeBotCore),
    specializations: [...(build.specializations || [])],
    commonContext: {
      // Kept only between common calculation and profession finalization.
      conversionPool,
      conversionPoolNoFood,
      runeDurations,
      foodDurations,
      sigilDurations,
      sigilCriticalChance
    }
  };
}

/**
 * Applies already-resolved profession build deltas and rebuilds derived
 * attributes without exposing the common calculator's internal context.
 */
export function finalizeBuildAttributes(
  common: Gw2CommonAttributeResult,
  { activeTraits, traitStats = {}, traitDurations = {}, traitCriticalChance = 0 }: FinalizeBuildAttributesOptions
): Gw2FinalizedAttributeResult {
  // Clone before applying profession deltas so a common result can be reused
  // for disabled-trait comparisons without cross-run mutation.
  const attributes = structuredClone(common.attributes);
  for (const [name, amount] of Object.entries(traitStats)) {
    if (!attributes[name]) continue;
    attributes[name].traits += amount;
    attributes[name].final += amount;
  }

  const { runeDurations, foodDurations, sigilDurations, sigilCriticalChance } = common.commonContext;
  // Trait stat changes can affect every derived percentage, so recompute them
  // from finalized primaries instead of incrementally patching prior results.
  recomputeDerivedAttributes(attributes, {
    runeDurations,
    foodDurations,
    sigilDurations,
    sigilCriticalChance,
    traitCriticalChance,
    traitDurations,
    specificKeys: CONDITION_DURATION_ATTRIBUTES,
    pruneZeros: true
  });

  const { commonContext, ...result } = common;
  // commonContext is an implementation handoff, not part of the public build.
  return {
    ...result,
    attributes,
    activeTraits
  };
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
 */
export function createCalculateAttributes(
  applyBuildAttributeRules: Gw2ApplyBuildAttributeRules
): Gw2CalculateAttributes {
  return function calculateAttributes(
    build: Gw2Build,
    selectedSkills: readonly Skill[] = [],
    weaponSet = 1,
    disabledTrait: string | null = null
  ) {
    const common = calculateCommonAttributes(build, { weaponSet });
    return applyBuildAttributeRules(common, {
      build,
      selectedSkills,
      weaponSet,
      disabledTrait
    });
  };
}
