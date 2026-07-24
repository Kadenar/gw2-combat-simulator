// Trait data processing and lookup
// Extracts traits from specialization catalog and provides active trait resolution

import { SPECIALIZATIONS as CATALOG_SPECIALIZATIONS } from './mesmer-catalog.js';

// List of all specialization names
export const SPECIALIZATIONS = CATALOG_SPECIALIZATIONS.map(spec => spec.name);
export const ELITE_SPECS = new Set(
    CATALOG_SPECIALIZATIONS.filter(spec => spec.elite).map(spec => spec.name),
);
export const CORE_SPECS = CATALOG_SPECIALIZATIONS
    .filter(spec => !spec.elite)
    .map(spec => spec.name);

export const DEFAULT_TRAITS = '1-1-1';

const MINOR_TIERS = ['Minor Adept', 'Minor Master', 'Minor Grandmaster'];
const MAJOR_TIERS = ['Major Adept', 'Major Master', 'Major Grandmaster'];

const STAT_ANNOTATIONS = {
    'Malicious Sorcery': { confusionDuration: 25 },
};

export const TRAITS = CATALOG_SPECIALIZATIONS.flatMap(spec => {
    const traits = [];
    spec.minorTraits.forEach((trait, index) => {
        traits.push({
            tier: MINOR_TIERS[index],
            name: trait.name,
            specialization: spec.name,
            position: 0,
            description: trait.description,
            icon: trait.icon,
            ...(STAT_ANNOTATIONS[trait.name] || {}),
        });
    });
    spec.majorTraits.forEach((tier, tierIndex) => {
        tier.forEach((trait, position) => {
            traits.push({
                tier: MAJOR_TIERS[tierIndex],
                name: trait.name,
                specialization: spec.name,
                position: position + 1,
                description: trait.description,
                icon: trait.icon,
                ...(STAT_ANNOTATIONS[trait.name] || {}),
            });
        });
    });
    return traits;
});

// Extracts active traits from specialization selection array
// Each spec has format { name, traits: '1-1-1' } where picks are position in each tier (1-3)
// Returns array of trait objects with names, descriptions, and stat effects
export function getActiveTraits(specializations) {
    const active = [];
    const majorTiers = ['Major Adept', 'Major Master', 'Major Grandmaster'];
    for (const spec of specializations || []) {
        const specTraits = TRAITS.filter(trait => trait.specialization === spec.name);
        const picks = (spec.traits || '').split('-').map(Number);
        active.push(...specTraits.filter(trait => trait.position === 0));
        majorTiers.forEach((tier, index) => {
            const pick = picks[index];
            if (!pick) return;
            const trait = specTraits.find(
                candidate => candidate.tier === tier && candidate.position === pick,
            );
            if (trait) active.push(trait);
        });
    }
    return active;
}
