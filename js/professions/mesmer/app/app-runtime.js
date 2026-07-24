// Runtime orchestration layer that bridges UI state to simulation engine
// Handles attribute calculation, simulation execution, and config transformation

import { calculateAttributes } from '../core/calc-attributes.js';
import {
    aggregateSigilSet,
    weaponSigilsForSet,
} from '../../../platform/gw2/weapon-sigils.js';
import { mesmerProfession } from '../definition.js';
import { mesmerResourceDefinition as getResourceDefinition } from '../ui.js';
import {
    calculateContributionComparisons,
} from '../../../app/app-runtime.js';

const { simulateSequence } = mesmerProfession.simulation;

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
    const attr = name => attributeData.attributes[name]?.final || 0;
    const assumptions = app.build.assumptions;
    const targetSkillActivationsPerSecond = Math.max(
        0,
        Number(assumptions.targetSkillActivationsPerSecond) || 0,
    );
    const specialization = eliteSpecialization(app.build);
    const targetConditions = { ...(assumptions.targetConditions || {}) };
    if (disabled?.type === 'Target' && disabled.name === 'Vulnerability') {
        delete targetConditions.Vulnerability;
    }
    const sigilSets = [1, 2]
        .map(setNumber => weaponSigilsForSet(app.build, setNumber))
        .map(names => disabled?.type === 'Sigil'
            ? names.filter(name => name !== disabled.name)
            : names)
        .map(aggregateSigilSet);
    const displayedConditionDuration =
        attributeData.attributes['Condition Duration'] || {};
    const genericConditionDurationBonus = Math.max(
        0,
        Number(displayedConditionDuration.final || 0)
            - attr('Expertise') / 15
            - Number(displayedConditionDuration.sigils || 0),
    );
    const conditionDurationBonuses = Object.fromEntries(
        ['Bleeding', 'Burning', 'Confusion', 'Poison', 'Torment']
            .map(name => {
                const duration = attributeData.attributes[`${name} Duration`] || {};
                let bonus =
                    Number(duration.final || 0)
                    - Number(duration.sigils || 0);
                // Malicious Sorcery is resolved from the active trait at runtime.
                // Keep it out of the static equipment/consumable bonus.
                if (
                    name === 'Confusion'
                    && attributeData.activeTraits
                        .some(trait => trait.name === 'Malicious Sorcery')
                ) {
                    bonus -= 25;
                }
                return [name === 'Poison' ? 'Poisoned' : name, Math.max(0, bonus)];
            })
            .filter(([, bonus]) => bonus > 0),
    );
    // Clones only exist in combat, so clone specs never start with resource.
    // Blade/note specs keep their configured opener count.
    const startsWithClones = getResourceDefinition(specialization).singular === 'clone';
    return {
        specialization,
        selectedTraits: attributeData.activeTraits.map(trait => trait.name),
        selectedTraitIds: attributeData.activeTraits
            .map(trait => trait.id)
            .filter(id => id != null),
        selectedSkills: Object.values(app.build.selectedSkills),
        primaryWeapon: app.build.weapons[0],
        secondaryWeapon: app.build.weapons[1],
        weaponSet2Primary: app.build.alternateWeapons[0],
        weaponSet2Secondary: app.build.alternateWeapons[1],
        startingWeaponSet: app.build.startingWeaponSet === 2 ? 2 : 1,
        initialResource: startsWithClones ? 0 : app.build.initialResource,
        stats: {
            power: attr('Power'),
            precision: attr('Precision'),
            ferocity: attr('Ferocity'),
            conditionDamage: attr('Condition Damage'),
            expertise: attr('Expertise'),
            concentration: attr('Concentration'),
            vitality: attr('Vitality'),
            criticalChanceBonus: 0,
            conditionDurationBonus: genericConditionDurationBonus,
            conditionDurationBonuses,
        },
        sigilSets,
        relic: disabled?.type === 'Relic' ? '' : app.build.relic,
        boons: {
            might: disabled?.type === 'Boon' && disabled.name === 'Might'
                ? 0
                : assumptions.might,
            fury: disabled?.type === 'Boon' && disabled.name === 'Fury'
                ? false
                : assumptions.fury,
            quickness: assumptions.quickness,
            alacrity: assumptions.alacrity,
            regeneration: assumptions.regeneration,
            vigor: assumptions.vigor,
        },
        target: {
            armor: app.build.targetArmor,
            health: Math.max(0, Number(app.build.targetHealth) || 0),
            conditions: targetConditions,
            moving: assumptions.targetMoving,
            boonless: assumptions.targetBoonless,
            nearby: true,
            activatingSkills: targetSkillActivationsPerSecond > 0,
            confusionActivationsPerSecond: targetSkillActivationsPerSecond,
        },
    };
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
