// Runtime orchestration layer that bridges UI state to simulation engine
// Handles attribute calculation, simulation execution, and config transformation

import { calculateAttributes } from '../core/calc-attributes.js';
import { simulateGw2 } from '../../../platform/gw2/simulate.js';
import {
    createGw2SimulationConfig,
} from '../../../app/gw2-simulation-config.js';
import { mesmerProfession } from '../definition.js';
import { mesmerResourceDefinition as getResourceDefinition } from '../ui.js';
import {
    calculateContributionComparisons,
} from '../../../app/app-runtime.js';
import { FOOD_DATA } from '../../../platform/gw2/gear-data.js';

const simulateSequence = (rotation, config) => simulateGw2({
    profession: mesmerProfession,
    rotation,
    config,
    mode: 'sequence',
});

// Determines which elite specialization is active (Chronomancer, Mirage, Virtuoso, Troubadour)
// Returns 'Core' if no elite spec is selected
export function eliteSpecialization(build) {
    const elite = new Set(['Chronomancer', 'Mirage', 'Virtuoso', 'Troubadour']);
    return build.specializations.find(spec => elite.has(spec.name))?.name || 'Core';
}

// Recalculates all character attributes from build (gear, runes, food, traits, sigils)
// Stores result in app.attributeData for display and simulation
export function recalculate(app) {
    const selected = Object.values(app.build.selectedSkills)
        .map(name => app.skillByName.get(name))
        .filter(Boolean);
    app.attributeData = calculateAttributes(
        app.build,
        selected,
        app.attributeWeaponSet || 1,
    );
}

function selectedSkills(app) {
    return Object.values(app.build.selectedSkills)
        .map(name => app.skillByName.get(name))
        .filter(Boolean);
}

function attributesWithModifierDisabled(app, disabled) {
    if (!disabled || (disabled.type !== 'Trait' && disabled.type !== 'Boon')) {
        return app.attributeData;
    }
    let build = app.build;
    if (disabled.type === 'Boon') {
        const key = disabled.name.toLowerCase();
        build = {
            ...app.build,
            assumptions: {
                ...app.build.assumptions,
                [key]: key === 'might' ? 0 : false,
            },
        };
    }
    return calculateAttributes(
        build,
        selectedSkills(app),
        app.attributeWeaponSet || 1,
        disabled.type === 'Trait' ? disabled.name : null,
    );
}

// Transforms UI build into simulation engine config format
// Aggregates sigils, resolves elite spec, handles clone vs blade/note resource initialization
export function simulationConfig(app, disabled = null) {
    const attributeData = attributesWithModifierDisabled(app, disabled);
    const specialization = eliteSpecialization(app.build);
    const startsWithClones = getResourceDefinition(specialization).singular === 'clone';
    const activeTraits = attributeData.activeTraits || [];
    const hasMaliciousSorcery = activeTraits
        .some(trait => trait.name === 'Malicious Sorcery');
    return createGw2SimulationConfig({
        app,
        attributeData,
        specialization,
        disabled,
        selectedTraits: activeTraits.map(trait => trait.name),
        selectedTraitIds: activeTraits
            .map(trait => trait.id)
            .filter(id => id != null),
        initialResource: startsWithClones ? 0 : app.build.initialResource,
        // This trait is resolved at hit time, not as an equipment bonus.
        adjustConditionDurationBonus(name, bonus) {
            return name === 'Confusion' && hasMaliciousSorcery
                ? bonus - 25
                : bonus;
        },
    });
}

export function modifierCandidates(app) {
    const candidates = [];
    const assumptions = app.build.assumptions;
    if (Number(assumptions.might) > 0) {
        candidates.push({ id: 'Boon:Might', type: 'Boon', name: 'Might', label: 'Might' });
    }
    if (assumptions.fury) {
        candidates.push({ id: 'Boon:Fury', type: 'Boon', name: 'Fury', label: 'Fury' });
    }
    if (Number(assumptions.targetConditions?.Vulnerability) > 0) {
        candidates.push({
            id: 'Target:Vulnerability',
            type: 'Target',
            name: 'Vulnerability',
            label: 'Vulnerability',
        });
    }
    for (const name of new Set((app.build.weaponSigils || []).flat())) {
        if (name) {
            candidates.push({
                id: `Sigil:${name}`,
                type: 'Sigil',
                name,
                label: `Sigil of ${name}`,
            });
        }
    }
    if (app.build.relic) {
        candidates.push({
            id: `Relic:${app.build.relic}`,
            type: 'Relic',
            name: app.build.relic,
            label: `Relic of ${app.build.relic}`,
        });
    }
    if (FOOD_DATA[app.build.food]?.proc) {
        candidates.push({
            id: `Food:${app.build.food}`,
            type: 'Food',
            name: app.build.food,
            label: `Food: ${FOOD_DATA[app.build.food].proc.name}`,
        });
    }
    for (const trait of app.attributeData.activeTraits || []) {
        candidates.push({
            id: `Trait:${trait.name}`,
            type: 'Trait',
            name: trait.name,
            label: trait.name,
        });
    }
    return candidates;
}

export function modifierContributionRequest(app) {
    const baseConfig = simulationConfig(app);
    // Use an infinite target for contribution passes so every comparison uses
    // the same rotation window. Eagle is HP-gated and must retain target HP.
    if (app.build.relic !== 'Eagle') {
        baseConfig.target = { ...baseConfig.target, health: 0 };
    }
    const comparisons = modifierCandidates(app).map(modifier => {
        const config = simulationConfig(app, modifier);
        if (app.build.relic !== 'Eagle') {
            config.target = { ...config.target, health: 0 };
        }
        return { modifier, config };
    });
    return {
        professionId: mesmerProfession.id,
        rotation: app.build.rotation,
        baseConfig,
        comparisons,
    };
}

export function calculateModifierContributions({
    rotation,
    baseConfig,
    comparisons,
}) {
    return calculateContributionComparisons(
        { rotation, baseConfig, comparisons },
        simulateSequence,
    );
}

export function computeModifierContributions(app) {
    return calculateModifierContributions(modifierContributionRequest(app));
}

// Executes the rotation simulator with current build config
// Stores results in app.results for display in rotation builder and damage breakdown
export function runSimulation(app) {
    app.results = simulateSequence(app.build.rotation, simulationConfig(app));
    return app.results;
}
