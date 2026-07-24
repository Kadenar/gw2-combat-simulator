// Weapon sigil management and aggregation
// Normalizes sigil selections, enforces no-duplicates constraint per weapon set, aggregates effects

import { SIGIL_DATA, SIGIL_NAMES } from '../data/gear-data.js';

// Default sigils for each weapon set: Force in first slot, Accuracy in second
export const DEFAULT_WEAPON_SIGILS = Object.freeze([
    Object.freeze(['Force', 'Accuracy']),
    Object.freeze(['Force', 'Accuracy']),
]);

// Validates sigil selections: no duplicates per set, falls back to default if invalid
export function normalizeWeaponSigils(value, fallback = DEFAULT_WEAPON_SIGILS) {
    return [0, 1].map(setIndex => {
        const normalized = [0, 1].map(slotIndex => {
            const selected = value?.[setIndex]?.[slotIndex];
            if (SIGIL_NAMES.includes(selected)) return selected;
            return fallback?.[setIndex]?.[slotIndex]
                || DEFAULT_WEAPON_SIGILS[setIndex][slotIndex];
        });
        if (normalized[0] === normalized[1]) {
            normalized[1] = [
                fallback?.[setIndex]?.[1],
                ...DEFAULT_WEAPON_SIGILS[setIndex],
                ...SIGIL_NAMES,
            ].find(name => SIGIL_NAMES.includes(name) && name !== normalized[0]);
        }
        return normalized;
    });
}

// Retrieves sigil names for a specific weapon set, with fallback to defaults
export function weaponSigilsForSet(build, setNumber = 1) {
    const setIndex = setNumber - 1;
    return [0, 1].map(slotIndex => {
        const selected = build?.weaponSigils?.[setIndex]?.[slotIndex];
        return SIGIL_NAMES.includes(selected)
            ? selected
            : DEFAULT_WEAPON_SIGILS[setIndex]?.[slotIndex];
    });
}

// Updates a specific sigil in a weapon set, swaps with other slot if duplicate
export function setWeaponSigil(build, setIndex, slotIndex, name) {
    if (
        ![0, 1].includes(setIndex)
        || ![0, 1].includes(slotIndex)
        || !SIGIL_NAMES.includes(name)
    ) return;
    build.weaponSigils = normalizeWeaponSigils(build.weaponSigils);
    const sigils = build.weaponSigils[setIndex];
    const otherSlot = slotIndex === 0 ? 1 : 0;
    const previous = sigils[slotIndex];
    if (sigils[otherSlot] === name) sigils[otherSlot] = previous;
    sigils[slotIndex] = name;
}

// Combines multiple sigil effects into aggregate bonuses
// Multiplies strike/condition damage, sums crit/duration bonuses, tracks per-condition duration bonuses
export function aggregateSigilSet(sigilNames) {
    const effects = {
        names: [...new Set(sigilNames || [])],
        criticalChanceBonus: 0,
        strike: 1,
        condition: 1,
        conditionDurationBonus: 0,
        conditionDurationBonuses: {},
        boonDurationBonus: 0,
    };
    const durationFields = {
        bleedingDuration: 'Bleeding',
        burningDuration: 'Burning',
        poisonDuration: 'Poisoned',
        tormentDuration: 'Torment',
    };

    for (const name of new Set(sigilNames || [])) {
        const sigil = SIGIL_DATA[name];
        if (!sigil) continue;
        effects.criticalChanceBonus += Number(sigil.criticalChance || 0);
        effects.strike *= 1 + Number(sigil.strikeDamageA || 0) / 100;
        effects.condition *= 1 + Number(sigil.conditionDamageA || 0) / 100;
        effects.conditionDurationBonus += Number(sigil.conditionDuration || 0);
        effects.boonDurationBonus += Number(sigil.boonDuration || 0);
        for (const [field, condition] of Object.entries(durationFields)) {
            const bonus = Number(sigil[field] || 0);
            if (bonus) {
                effects.conditionDurationBonuses[condition] =
                    (effects.conditionDurationBonuses[condition] || 0) + bonus;
            }
        }
    }
    return effects;
}
