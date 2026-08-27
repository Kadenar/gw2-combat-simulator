import { REVENANT_SKILL_IDS as SKILL } from '../../data/ids.js';
import { activeRevenantLegend, revenantUiState } from '../../core/ui.js';
import { HERALD_MECHANICS } from './mechanics.js';
import type {
  PaletteSkillAvailability,
  ProfessionUiContract,
  SchedulerRecord,
  SkillId
} from '../../../../../platform/engine/types.js';
import type { RevenantSkill, RevenantUiContext } from '../../types.js';

const TRUE_NATURE_IDS: readonly SkillId[] = Object.freeze(Object.values(HERALD_MECHANICS.trueNatureConsumeByLegendId));

// Mirror Herald facet and consume-skill flip state in the palette without
// mutating the scheduler's active upkeep windows.
function heraldPaletteAvailability(context: RevenantUiContext, skill: RevenantSkill): PaletteSkillAvailability {
  if (skill.id !== SKILL.FACET_OF_NATURE && !TRUE_NATURE_IDS.includes(skill.id)) {
    return { available: true, message: '' };
  }

  const expected = (HERALD_MECHANICS.trueNatureConsumeByLegendId as Readonly<Record<string, SkillId>>)[
    activeRevenantLegend(context)
  ];
  const consumeActive = expected != null && Boolean(revenantUiState(context).availableFlips?.[expected]);
  if (skill.id === SKILL.FACET_OF_NATURE) {
    return consumeActive
      ? { available: false, message: 'True Nature currently replaces Facet of Nature' }
      : { available: true, message: '' };
  }

  return skill.id === expected && consumeActive
    ? { available: true, message: '' }
    : { available: false, message: 'Activate Facet of Nature first' };
}

export const heraldUi: Partial<ProfessionUiContract> & SchedulerRecord = Object.freeze({
  paletteGroups: (context: RevenantUiContext) => {
    return [
      {
        id: 'revenant-profession-specialization',
        label: 'F',
        // All legend variants declare one family; shared projection selects the
        // active legend's consume only while that flip is armed.
        skillIds: [SKILL.FACET_OF_NATURE, ...TRUE_NATURE_IDS],
        color: '#a84f54',
        resourceAnchor: true
      }
    ];
  },
  paletteSkillAvailability: heraldPaletteAvailability,
  // Herald has no custom resource bar; it reuses the core Energy bar declared in revenantCoreUi.
  resourceViews: () => []
});
