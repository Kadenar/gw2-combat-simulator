// Compatibility surface. New composition uses the Mesmer profession contract.
import { mesmerProfession } from "../professions/mesmer/definition.js";
import { mesmerResourceDefinition } from "../professions/mesmer/ui.js";

export const createDefaultConfig =
  mesmerProfession.simulation.createDefaultConfig;
export const simulateRotation =
  mesmerProfession.simulation.simulateRotation;
export const simulateSequence =
  mesmerProfession.simulation.simulateSequence;

export function getResourceDefinition(specialization) {
  return mesmerResourceDefinition(specialization);
}

export function skillById(id) {
  return mesmerProfession.catalog.skillsById.get(Number(id));
}

export function availableSkills(config) {
  return mesmerProfession.simulation
    .simulateSequence([], config)
    ? mesmerProfession.catalog.skills.filter(skill => {
        if (skill.environment && skill.environment !== "Terrestrial") return false;
        if (
          skill.specialization
          && skill.type !== "Weapon"
          && skill.specialization !== config.specialization
        ) return false;
        return true;
      })
    : [];
}

export function calculatedAttributes(config) {
  const merged = {
    ...createDefaultConfig(),
    ...(config || {}),
    stats: {
      ...createDefaultConfig().stats,
      ...(config?.stats || {}),
    },
    boons: {
      ...createDefaultConfig().boons,
      ...(config?.boons || {}),
    },
  };
  const might = 30 * Number(merged.boons.might || 0);
  return {
    power: Number(merged.stats.power || 0) + might,
    precision: Number(merged.stats.precision || 0),
    ferocity: Number(merged.stats.ferocity || 0),
    conditionDamage: Number(merged.stats.conditionDamage || 0) + might,
    expertise: Number(merged.stats.expertise || 0),
    conditionDurationBonus: Number(merged.stats.conditionDurationBonus || 0),
    conditionDurationBonuses: {
      ...(merged.stats.conditionDurationBonuses || {}),
    },
  };
}
