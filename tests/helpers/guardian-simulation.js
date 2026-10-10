import { baseAttributeInputs } from '#gw2/platform/builds/attribute-inputs.js';
import { guardianProfession } from '#gw2/professions/guardian/profession.js';
import { createProfessionSimulator } from '#tests/helpers/profession-simulation.js';

/** Supply fresh Guardian defaults; explicit config sections replace their defaults as a whole. */
export const runGuardian = createProfessionSimulator(guardianProfession, () => ({
  specialization: 'Core',
  primaryWeapon: 'Scepter',
  selectedTraitIds: [],
  attributeInputs: baseAttributeInputs({ power: 2000, precision: 1000, conditionDamage: 1000 }),
  target: { armor: 2597 }
}));
