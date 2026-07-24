// Comprehensive attribute calculation system
// Aggregates stats from gear, runes, food, utility, infusions, traits, sigils
// Computes derived attributes (Crit Chance, Critical Damage, Boon/Condition Duration)
// Tracks breakdown by source for tooltips

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
} from '../data/gear-data.js';
import { getActiveTraits } from '../data/traits-data.js';
import {
    normalizeWeaponSigils,
    weaponSigilsForSet,
} from './weapon-sigils.js';

// Primary stats that are tracked separately
const PRIMARY_STATS = [
    'Power', 'Precision', 'Toughness', 'Vitality', 'Ferocity',
    'Condition Damage', 'Expertise', 'Concentration', 'Healing Power',
];

const DURATION_KEYS = [
    'Burning Duration', 'Bleeding Duration', 'Torment Duration',
    'Confusion Duration', 'Poison Duration',
];

function add(target, key, value) {
    if (value) target[key] = (target[key] || 0) + value;
}

// Helper to merge multiple stat objects
function addObject(target, source) {
    for (const [key, value] of Object.entries(source || {})) add(target, key, value);
}

// Main attribute calculation pipeline
// Stages: 1) Gear stats, 2) Rune stats, 3) Food/utility conversions, 4) Trait bonuses, 5) Sigil effects
// Returns full breakdown with derived attributes and per-source tracking
export function calcAttributes(
    build,
    selectedSkills = [],
    weaponSet = 1,
    disabledTrait = null,
) {
    const gear = {};
    const runes = {};
    const foodConverted = {};
    const foodBuff = {};
    const foodDurations = {};
    const runeDurations = {};
    const traitStats = {};
    const traitDurations = {};
    const utility = {};
    const sigilDurations = {};
    const infusions = {};

    const mainHand = build.weapons?.[0] || '';
    const isTwoHanded = WEAPON_DATA[mainHand]?.wielding === '2h';
    for (const slot of GEAR_SLOTS) {
        if (isTwoHanded && slot === 'Weapon2') continue;
        const statSlot = isTwoHanded && slot === 'Weapon1' ? 'Weapon2H' : slot;
        const prefix = build.gear?.[slot];
        addObject(gear, GEAR_STATS[prefix]?.[statSlot]);
    }

    const rune = RUNE_DATA[build.rune];
    addObject(runes, rune?.stats);
    addObject(runeDurations, rune?.durations);

    const food = FOOD_DATA[build.food];
    addObject(food?.isConverted ? foodConverted : foodBuff, food?.stats);
    addObject(foodDurations, food?.durations);

    const conversionPool = {};
    for (const stat of PRIMARY_STATS) {
        conversionPool[stat] =
            (BASE_STATS[stat] || 0) +
            (gear[stat] || 0) +
            (runes[stat] || 0) +
            (foodConverted[stat] || 0) +
            (build.jadeBotCore ? (JBC_BONUS[stat] || 0) : 0);
    }

    for (const conversion of UTILITY_DATA[build.utility] || []) {
        const rate = (UTILITY_CONVERSION_RATES[conversion.from] || 0) / 100;
        add(utility, conversion.to, Math.round((conversionPool[conversion.from] || 0) * rate));
    }

    const activeTraits = getActiveTraits(build.specializations || [])
        .filter(trait => trait.name !== disabledTrait);
    const hasTrait = name => activeTraits.some(trait => trait.name === name);
    const assumptions = build.assumptions || {};

    if (hasTrait('Quiet Intensity')) {
        add(traitStats, 'Ferocity', Math.round((conversionPool.Vitality || 0) * 0.10));
    }
    if (hasTrait('Chaotic Persistence') && assumptions.regeneration !== false) {
        add(traitStats, 'Expertise', 100);
        add(traitStats, 'Concentration', 250);
    }
    if (hasTrait('Sharpening Sorrow') && assumptions.fury !== false) {
        add(traitStats, 'Expertise', 150);
    }
    if (selectedSkills.some(skill => skill.name === 'Signet of Domination')) {
        add(traitStats, 'Condition Damage', 180);
    }
    if (selectedSkills.some(skill => skill.name === 'Signet of Midnight')) {
        add(traitStats, 'Expertise', 180);
    }

    let traitCriticalChance = 0;
    for (const trait of activeTraits) {
        if (trait.conditionDamage) add(traitStats, 'Condition Damage', trait.conditionDamage);
        if (trait.ferocity) add(traitStats, 'Ferocity', trait.ferocity);
        if (trait.concentration) add(traitStats, 'Concentration', trait.concentration);
        if (trait.vitality) add(traitStats, 'Vitality', trait.vitality);
        if (trait.confusionDuration) add(traitDurations, 'Confusion Duration', trait.confusionDuration);
        if (trait.criticalChance) traitCriticalChance += trait.criticalChance;
    }
    if (hasTrait('Quiet Intensity') && assumptions.fury !== false) traitCriticalChance += 15;
    if (hasTrait('Flow of Time') && assumptions.alacrity !== false) traitCriticalChance += 15;

    let sigilCriticalChance = 0;
    for (const sigilName of new Set(weaponSigilsForSet(build, weaponSet))) {
        const sigil = SIGIL_DATA[sigilName];
        if (!sigil) continue;
        if (sigil.conditionDuration) add(sigilDurations, 'Condition Duration', sigil.conditionDuration);
        if (sigil.bleedingDuration) add(sigilDurations, 'Bleeding Duration', sigil.bleedingDuration);
        if (sigil.burningDuration) add(sigilDurations, 'Burning Duration', sigil.burningDuration);
        if (sigil.poisonDuration) add(sigilDurations, 'Poison Duration', sigil.poisonDuration);
        if (sigil.tormentDuration) add(sigilDurations, 'Torment Duration', sigil.tormentDuration);
        if (sigil.boonDuration) add(sigilDurations, 'Boon Duration', sigil.boonDuration);
        if (sigil.criticalChance) sigilCriticalChance += sigil.criticalChance;
    }

    for (const infusion of build.infusions || []) {
        if (infusion?.stat && infusion.count > 0) {
            add(infusions, infusion.stat, infusion.count * INFUSION_BONUS);
        }
    }

    const attributes = {};
    for (const stat of PRIMARY_STATS) {
        const breakdown = {
            base: BASE_STATS[stat] || 0,
            gear: gear[stat] || 0,
            runes: runes[stat] || 0,
            food: (foodConverted[stat] || 0) + (foodBuff[stat] || 0),
            utility: utility[stat] || 0,
            jbc: build.jadeBotCore ? (JBC_BONUS[stat] || 0) : 0,
            traits: traitStats[stat] || 0,
            sigils: 0,
            infusions: infusions[stat] || 0,
        };
        breakdown.final = Object.entries(breakdown)
            .filter(([key]) => key !== 'final')
            .reduce((sum, [, value]) => sum + value, 0);
        attributes[stat] = breakdown;
    }

    const precision = attributes.Precision.final;
    const ferocity = attributes.Ferocity.final;
    const concentration = attributes.Concentration.final;
    const expertise = attributes.Expertise.final;
    const derived = (
        final,
        traits = 0,
        sigils = 0,
        runeBonus = 0,
        foodBonus = 0,
    ) => ({
        final, base: 0, gear: 0, runes: runeBonus, food: foodBonus, utility: 0,
        jbc: 0, traits, sigils, infusions: 0,
    });

    attributes['Critical Chance'] = derived(
        (precision - 895) / 21 + traitCriticalChance + sigilCriticalChance,
        traitCriticalChance,
        sigilCriticalChance,
    );
    attributes['Critical Damage'] = derived(150 + ferocity / 15);
    attributes['Boon Duration'] = derived(
        concentration / 15 +
        (runeDurations['Boon Duration'] || 0) +
        (traitDurations['Boon Duration'] || 0) +
        (foodDurations['Boon Duration'] || 0) +
        (sigilDurations['Boon Duration'] || 0),
        traitDurations['Boon Duration'] || 0,
        sigilDurations['Boon Duration'] || 0,
        runeDurations['Boon Duration'] || 0,
        foodDurations['Boon Duration'] || 0,
    );
    attributes['Condition Duration'] = derived(
        expertise / 15 +
        (runeDurations['Condition Duration'] || 0) +
        (traitDurations['Condition Duration'] || 0) +
        (foodDurations['Condition Duration'] || 0) +
        (sigilDurations['Condition Duration'] || 0),
        traitDurations['Condition Duration'] || 0,
        sigilDurations['Condition Duration'] || 0,
        runeDurations['Condition Duration'] || 0,
        foodDurations['Condition Duration'] || 0,
    );

    for (const key of DURATION_KEYS) {
        const value =
            (runeDurations[key] || 0) +
            (traitDurations[key] || 0) +
            (foodDurations[key] || 0) +
            (sigilDurations[key] || 0);
        if (value) {
            attributes[key] = derived(
                value,
                traitDurations[key] || 0,
                sigilDurations[key] || 0,
                runeDurations[key] || 0,
                foodDurations[key] || 0,
            );
        }
    }

    return {
        attributes,
        activeTraits,
        gear: { ...(build.gear || {}) },
        weapons: [...(build.weapons || [])],
        alternateWeapons: [...(build.alternateWeapons || [])],
        runes: build.rune || '',
        weaponSigils: normalizeWeaponSigils(build.weaponSigils),
        relic: build.relic || '',
        food: build.food || '',
        utility: build.utility || '',
        jadeBotCore: Boolean(build.jadeBotCore),
        specializations: [...(build.specializations || [])],
    };
}
