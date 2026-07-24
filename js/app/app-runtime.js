// Runtime orchestration layer that bridges UI state to simulation engine
// Handles attribute calculation, simulation execution, and config transformation

import { calcAttributes } from '../core/calc-attributes.js';
import {
    aggregateSigilSet,
    weaponSigilsForSet,
} from '../core/weapon-sigils.js';
import { getResourceDefinition, simulateSequence } from '../sim/sim-engine.js';

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
    app.attributeData = calcAttributes(
        app.build,
        selected,
        app.attributeWeaponSet || 1,
    );
}

// Transforms UI build into simulation engine config format
// Aggregates sigils, resolves elite spec, handles clone vs blade/note resource initialization
export function simulationConfig(app) {
    const attr = name => app.attributeData.attributes[name]?.final || 0;
    const assumptions = app.build.assumptions;
    const targetSkillActivationsPerSecond = Math.max(
        0,
        Number(assumptions.targetSkillActivationsPerSecond) || 0,
    );
    const specialization = eliteSpecialization(app.build);
    const targetConditions = { ...(assumptions.targetConditions || {}) };
    const sigilSets = [1, 2]
        .map(setNumber => weaponSigilsForSet(app.build, setNumber))
        .map(aggregateSigilSet);
    const displayedConditionDuration =
        app.attributeData.attributes['Condition Duration'] || {};
    const genericConditionDurationBonus = Math.max(
        0,
        Number(displayedConditionDuration.final || 0)
            - attr('Expertise') / 15
            - Number(displayedConditionDuration.sigils || 0),
    );
    const conditionDurationBonuses = Object.fromEntries(
        ['Bleeding', 'Burning', 'Confusion', 'Poison', 'Torment']
            .map(name => {
                const duration = app.attributeData.attributes[`${name} Duration`] || {};
                let bonus =
                    Number(duration.final || 0)
                    - Number(duration.sigils || 0);
                // Malicious Sorcery is resolved from the active trait at runtime.
                // Keep it out of the static equipment/consumable bonus.
                if (
                    name === 'Confusion'
                    && app.attributeData.activeTraits
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
        selectedTraits: app.attributeData.activeTraits.map(trait => trait.name),
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
        relic: app.build.relic,
        boons: {
            might: assumptions.might,
            fury: assumptions.fury,
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

// Executes the rotation simulator with current build config
// Stores results in app.results for display in rotation builder and damage breakdown
export function runSimulation(app) {
    app.results = simulateSequence(app.build.rotation, simulationConfig(app));
    return app.results;
}
