import { engineerProfession } from '#gw2/professions/engineer/profession.js';
import { createProfessionSimulator } from '#tests/helpers/profession-simulation.js';

/** Supply fresh Engineer defaults; explicit config sections replace their defaults as a whole. */
export const runEngineer = createProfessionSimulator(engineerProfession, () => ({
  specialization: 'Core',
  selectedTraitIds: [],
  boons: {},
  target: { armor: 2597, conditions: {} }
}));
