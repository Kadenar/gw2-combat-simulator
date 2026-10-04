import { thiefProfession } from '#gw2/professions/thief/profession.js';
import { THIEF_SKILL_IDS as ID } from '#gw2/professions/thief/data/ids.js';
import { createProfessionSimulator } from '#tests/helpers/profession-simulation.js';

export const THIEF_TEST_CONFIG = Object.freeze({
  primaryWeapon: 'Dagger',
  secondaryWeapon: 'Dagger',
  selectedTraitIds: [],
  selectedSkillIds: [],
  boons: {},
  target: { armor: 2597, conditions: {} }
});

/** Keep profession loadout defaults local while sharing runtime setup and scheduled probes. */
export const runThief = createProfessionSimulator(thiefProfession, () => ({
  specialization: 'Core',
  ...THIEF_TEST_CONFIG
}));

/** A landed-eligible player strike that resolves through the actual hit reactions. */
export function thiefHit(at, fields = {}) {
  return {
    type: 'damage',
    at,
    source: 'fixture',
    sourceId: ID.DOUBLE_STRIKE,
    skillId: ID.DOUBLE_STRIKE,
    skillName: 'Double Strike',
    actorType: 'player',
    coefficient: 1,
    weaponStrengthProfileId: 'weapon.dagger',
    ...fields
  };
}
