import { revenantProfession } from '#gw2/professions/revenant/profession.js';
import { REVENANT_LEGEND_IDS as LEGEND, REVENANT_SKILL_IDS as SKILL } from '#gw2/professions/revenant/data/ids.js';
import { createProfessionSimulator } from '#tests/helpers/profession-simulation.js';

export const REVENANT_TEST_CONFIG = Object.freeze({
  selectedLegends: [LEGEND.ASSASSIN, LEGEND.DEMON],
  startingLegend: LEGEND.ASSASSIN,
  selectedTraitIds: [],
  boons: {},
  target: { armor: 2597, conditions: {} }
});

/** Keep profession loadout defaults local while sharing runtime setup and scheduled probes. */
export const runRevenant = createProfessionSimulator(revenantProfession, () => ({
  specialization: 'Core',
  ...REVENANT_TEST_CONFIG
}));

/** A landed-eligible player strike that resolves through the actual hit reactions. */
export function revenantHit(at, fields = {}) {
  return {
    type: 'damage',
    at,
    source: 'fixture',
    sourceId: SKILL.PHASE_TRAVERSAL,
    skillId: SKILL.PHASE_TRAVERSAL,
    skillName: 'Phase Traversal',
    actorType: 'player',
    coefficient: 1,
    weaponStrengthProfileId: 'weapon.sword',
    ...fields
  };
}
