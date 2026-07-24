// Build state management and persistence
// Handles creating default builds, loading from localStorage, and merging with defaults for backwards compatibility

import { GEAR_SLOTS, RELIC_NAMES } from '../data/gear-data.js';
import {
    DEFAULT_WEAPON_SIGILS,
    normalizeWeaponSigils,
} from '../core/weapon-sigils.js';

// LocalStorage key for persisting builds
export const STORAGE_KEY = 'gw2-mesmer-simulator-v2';

export function createDefaultTargetConditions() {
    return {
        Bleeding: 1,
        Burning: true,
        Torment: 1,
        Confusion: 1,
        Poisoned: true,
        Chilled: true,
        Cripple: true,
        Slow: true,
        Weakness: true,
        Vulnerability: 25,
    };
}

// Creates a fresh default build with standard Virtuoso/Dueling/Illusions loadout
// Returns an object with gear set to Berserker's across all slots, Dagger/Sword weapons, and sensible defaults
export function createDefaultBuild() {
    return {
        gear: Object.fromEntries(GEAR_SLOTS.map(slot => [slot, "Berserker's"])),
        weapons: ['Dagger', 'Sword'],
        alternateWeapons: ['Spear', ''],
        rune: 'Scholar',
        weaponSigils: normalizeWeaponSigils(DEFAULT_WEAPON_SIGILS),
        relic: 'Thief',
        food: 'Bowl of Sweet and Spicy Butternut Squash Soup',
        utility: 'Superior Sharpening Stone',
        jadeBotCore: true,
        infusions: [
            { stat: 'Power', count: 18 },
            { stat: 'Precision', count: 0 },
            { stat: 'Condition Damage', count: 0 },
        ],
        specializations: [
            { name: 'Dueling', traits: '1-3-1' },
            { name: 'Illusions', traits: '1-2-1' },
            { name: 'Virtuoso', traits: '3-3-3' },
        ],
        selectedSkills: {
            Heal: 'Twin Blade Restoration',
            Utility1: 'Signet of Domination',
            Utility2: 'Mantra of Pain',
            Utility3: 'Rain of Swords',
            Elite: 'Thousand Cuts',
        },
        assumptions: {
            might: 25,
            fury: true,
            quickness: true,
            alacrity: true,
            regeneration: true,
            vigor: true,
            targetMoving: false,
            targetBoonless: true,
            targetConditions: createDefaultTargetConditions(),
            targetSkillActivationsPerSecond: 0,
        },
        initialResource: 5,
        startingWeaponSet: 1,
        targetHealth: 4000000,
        targetArmor: 2597,
        rotation: [],
    };
}

// Merges a saved build with defaults, handles legacy format conversions and validation
// Converts old 'sigils' format to new weaponSigils format, applies legacy prefix mappings, validates relics
function mergeBuild(saved) {
    const defaults = createDefaultBuild();
    const savedWeaponSigils = Array.isArray(saved?.weaponSigils?.[0])
        ? saved.weaponSigils
        : Array.isArray(saved?.sigils)
            ? [saved.sigils, saved.sigils]
            : defaults.weaponSigils;
    const merged = {
        ...defaults,
        ...(saved || {}),
        gear: { ...defaults.gear, ...(saved?.gear || {}) },
        assumptions: {
            ...defaults.assumptions,
            ...(saved?.assumptions || {}),
            targetConditions:
                saved?.assumptions
                && Object.hasOwn(saved.assumptions, 'targetConditions')
                    ? { ...(saved.assumptions.targetConditions || {}) }
                    : { ...defaults.assumptions.targetConditions },
        },
        selectedSkills: { ...defaults.selectedSkills, ...(saved?.selectedSkills || {}) },
        weapons: Array.isArray(saved?.weapons) ? saved.weapons : defaults.weapons,
        alternateWeapons: Array.isArray(saved?.alternateWeapons)
            ? saved.alternateWeapons
            : defaults.alternateWeapons,
        weaponSigils: normalizeWeaponSigils(savedWeaponSigils),
        infusions: Array.isArray(saved?.infusions) ? saved.infusions : defaults.infusions,
        specializations: Array.isArray(saved?.specializations)
            ? saved.specializations
            : defaults.specializations,
        rotation: Array.isArray(saved?.rotation) ? saved.rotation : [],
    };
    const legacyPrefixes = {
        Berserker: "Berserker's",
        Assassin: "Assassin's",
        Viper: "Viper's",
        Dragon: "Dragon's",
        Ritualist: "Ritualist's",
        Trailblazer: "Trailblazer's",
    };
    for (const slot of GEAR_SLOTS) {
        merged.gear[slot] = legacyPrefixes[merged.gear[slot]] || merged.gear[slot];
    }
    if (!RELIC_NAMES.includes(merged.relic)) {
        merged.relic = defaults.relic;
    }
    if (
        saved?.assumptions?.targetConditions == null
        && saved?.assumptions?.vulnerability != null
    ) {
        merged.assumptions.targetConditions.Vulnerability =
            saved.assumptions.vulnerability;
    }
    delete merged.assumptions.vulnerability;
    delete merged.assumptions.targetHealthAbove50;
    delete merged.sigils;
    return merged;
}

// Loads build from localStorage or returns default if storage is empty/corrupt
// Safely handles JSON parse errors by falling back to default build
export function loadBuild() {
    try {
        return mergeBuild(JSON.parse(localStorage.getItem(STORAGE_KEY) || 'null'));
    } catch {
        return createDefaultBuild();
    }
}

// Persists build to localStorage as JSON string
export function saveBuild(build) {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(build));
}

// Replaces current build with imported one, applies merging and validation
export function replaceBuild(saved) {
    return mergeBuild(saved);
}
