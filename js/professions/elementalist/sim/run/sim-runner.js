import { calcAttributes } from '../../core/calc-attributes.js';
import { SimulationEngine } from '../../simulation.js?v=49';
import { WEAPON_DATA, SIGIL_DATA, RELIC_DATA } from '../../data/gear-data.js';
import { cloneRotationItems } from '../../app/app-state.js';

export function getSelectedSkillList(selectedSkills = {}) {
    return Object.values(selectedSkills).filter(Boolean);
}

export function calcBuildAttributes(build, selectedSkills) {
    return calcAttributes(build, getSelectedSkillList(selectedSkills));
}

export function createSimulationEngine(data, attributes, { hitboxSize, glyphBoonedElementals, thornsBossAuraOnly } = {}) {
    return new SimulationEngine({
        skills: data.skills,
        skillHits: data.skillHits,
        weapons: WEAPON_DATA,
        attributes,
        sigils: SIGIL_DATA,
        relics: RELIC_DATA,
        activeTraits: attributes.activeTraits,
        hitboxSize,
        glyphBoonedElementals,
        thornsBossAuraOnly,
    });
}

export function rebuildSimulation({ data, build, selectedSkills, rotation = [], hitboxSize, glyphBoonedElementals, thornsBossAuraOnly }) {
    const attributes = calcBuildAttributes(build, selectedSkills);
    const sim = createSimulationEngine(data, attributes, { hitboxSize, glyphBoonedElementals, thornsBossAuraOnly });
    sim.rotation = cloneRotationItems(rotation);
    return { attributes, sim };
}

export function runSimulationContributions({
    sim,
    activeAttunement,
    secondaryAttunement,
    evokerElement,
    startEvokerCharges = 6,
    startEvokerEmpowered = 0,
    permaBoons,
    permaField = '',
    targetHP = 0,
    startPistolBullets = null,
}) {
    sim.permaField = permaField || '';
    sim.computeContributions(
        activeAttunement,
        secondaryAttunement,
        evokerElement,
        permaBoons,
        targetHP,
        startPistolBullets,
        startEvokerCharges,
        startEvokerEmpowered,
    );
    return sim.results;
}
