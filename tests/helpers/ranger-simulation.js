import { rangerProfession } from '#gw2/professions/ranger/profession.js';
import { createProfessionSimulator } from '#tests/helpers/profession-simulation.js';

/** Supply fresh Ranger defaults; explicit config sections replace their defaults as a whole. */
export const runRanger = createProfessionSimulator(rangerProfession, () => ({
  specialization: 'Core',
  selectedTraitIds: [],
  boons: {},
  target: { armor: 2597, conditions: {} }
}));
