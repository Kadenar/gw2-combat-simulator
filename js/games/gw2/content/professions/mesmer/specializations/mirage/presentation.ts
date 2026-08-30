import { MESMER_SKILL_IDS as ID } from '../../data/ids.js';
import {
  mesmerMechanicPaletteGroups,
  mesmerMechanicSkillBarGroups,
  mesmerResourceViews
} from '../../core/presentation.js';
import type {
  PaletteSkillAvailability,
  ProfessionUiContract,
  SchedulerRecord,
  Skill
} from '../../../../../platform/engine/types.js';
import type { MesmerUiContext } from '../../types.js';

const MIRAGE_MECHANIC_SKILLS = Object.freeze([ID.MIND_WRACK, ID.CRY_OF_FRUSTRATION, ID.DIVERSION, ID.DISTORTION]);

/** Keeps the mirror pickup action disabled until the projected state has a collectible ground mirror. */
function miragePaletteSkillAvailability(context: MesmerUiContext, skill: Skill): PaletteSkillAvailability {
  if (skill.id !== ID.PICK_UP_MIRAGE_MIRROR) return { available: true, message: '' };
  const state = (context.professionState || context.state?.profession || {}) as SchedulerRecord;
  const available = Number(state.availableMirrors || 0) > 0;
  return {
    available,
    message: available ? '' : 'No Mirage Mirror is active on the ground.'
  };
}

export const mirageUi: Partial<ProfessionUiContract> & SchedulerRecord = Object.freeze({
  paletteGroups: (context: MesmerUiContext) => mesmerMechanicPaletteGroups(context, MIRAGE_MECHANIC_SKILLS, 'clones'),
  skillBarGroups: () => mesmerMechanicSkillBarGroups('Shatters', MIRAGE_MECHANIC_SKILLS),
  resourceViews: (context: MesmerUiContext) =>
    mesmerResourceViews(context, {
      id: 'clones',
      singular: 'clone',
      plural: 'clones',
      maximum: 3
    }),
  paletteSkillAvailability: miragePaletteSkillAvailability
});
