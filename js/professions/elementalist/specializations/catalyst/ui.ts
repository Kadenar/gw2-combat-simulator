import type {
  PaletteSkillAvailability,
  ProfessionResourceView,
  ProfessionUiContract,
  SchedulerRecord,
  Skill
} from '../../../../platform/engine/types.js';
import { ELEMENTALIST_JADE_SPHERE_SKILL_IDS } from '../../data/ids.js';
import { CATALYST_MAXIMUM_ENERGY, type CatalystState } from './state.js';

const CATALYST_SPHERE_COST = 10;
const CATALYST_SPHERE_SKILL_IDS = Object.freeze(Object.values(ELEMENTALIST_JADE_SPHERE_SKILL_IDS));

function uiState(context: SchedulerRecord): Partial<CatalystState> {
  return (context.professionState as Partial<CatalystState> | undefined) || {};
}

function catalystPaletteAvailability(context: SchedulerRecord, skill: Skill): PaletteSkillAvailability {
  if (skill.skillFamily !== 'Jade Sphere') {
    return { available: true, message: '' };
  }

  const state = uiState(context);
  const build = context.build as SchedulerRecord | undefined;
  const energy = Number(state.energy ?? build?.initialCatalystEnergy ?? CATALYST_MAXIMUM_ENERGY);
  const available = energy >= CATALYST_SPHERE_COST;
  return {
    available,
    message: available ? '' : `Requires ${CATALYST_SPHERE_COST} Energy; currently ${energy}`
  };
}

export const catalystUi: Partial<ProfessionUiContract> & SchedulerRecord = Object.freeze({
  skillBarGroups: () => [
    {
      id: 'elementalist-catalyst-spheres',
      label: 'Jade Sphere',
      skillIds: CATALYST_SPHERE_SKILL_IDS,
      color: '#44ddaa',
      className: 'elementalist-catalyst-spheres'
    }
  ],
  paletteGroups: () => [
    {
      id: 'elementalist-catalyst-spheres',
      label: 'F5',
      skillIds: CATALYST_SPHERE_SKILL_IDS,
      color: '#44ddaa',
      className: 'compact-resource-palette elementalist-catalyst-spheres',
      resourceAnchor: true
    }
  ],
  paletteSkillAvailability: catalystPaletteAvailability,
  resourceViews: (context: SchedulerRecord): ProfessionResourceView[] => {
    const state = uiState(context);
    const build = context.build as SchedulerRecord | undefined;
    return [
      {
        id: 'catalyst-energy',
        singular: 'energy',
        plural: 'energy',
        maximum: CATALYST_MAXIMUM_ENERGY,
        value: Number(state.energy ?? build?.initialCatalystEnergy ?? CATALYST_MAXIMUM_ENERGY),
        startMaximum: CATALYST_MAXIMUM_ENERGY,
        startValue: Number(build?.initialCatalystEnergy ?? CATALYST_MAXIMUM_ENERGY),
        canStart: true,
        buildKey: 'initialCatalystEnergy',
        step: 1,
        displayMode: 'bar',
        pipStyle: 'compact-profession-resource-catalyst-energy',
        shortLabel: 'Energy',
        statusLabel: 'Catalyst'
      }
    ];
  }
});
