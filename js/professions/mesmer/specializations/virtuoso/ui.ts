import { MESMER_SKILL_IDS as ID } from '../../data/ids.js';
import { mesmerMechanicPaletteGroups, mesmerMechanicSkillBarGroups, mesmerResourceViews } from '../../core/ui.js';
import type {
  PaletteSkillAvailability,
  ProfessionUiContract,
  SchedulerRecord,
  Skill
} from '../../../../platform/engine/types.js';
import type { MesmerUiContext } from '../../types.js';

const VIRTUOSO_MECHANIC_SKILLS = Object.freeze([
  ID.BLADESONG_HARMONY,
  ID.BLADESONG_SORROW,
  ID.BLADESONG_DISSONANCE,
  ID.BLADESONG_DISTORTION,
  ID.BLADETURN_REQUIEM
]);

/** Disables bladesongs in the application palette until at least one blade is stocked. */
function virtuosoPaletteSkillAvailability(context: MesmerUiContext, skill: Skill): PaletteSkillAvailability {
  if (!VIRTUOSO_MECHANIC_SKILLS.some((skillId) => skillId === Number(skill.id))) {
    return { available: true, message: '' };
  }
  const state = (context.professionState || context.state?.profession || {}) as SchedulerRecord;
  const available = Number(state.resource ?? Infinity) >= 1;
  return {
    available,
    message: available ? '' : 'Requires at least 1 blade'
  };
}

export const virtuosoUi: Partial<ProfessionUiContract> & SchedulerRecord = Object.freeze({
  paletteGroups: (context: MesmerUiContext) => mesmerMechanicPaletteGroups(context, VIRTUOSO_MECHANIC_SKILLS, 'blades'),
  skillBarGroups: () => mesmerMechanicSkillBarGroups('Bladesongs', VIRTUOSO_MECHANIC_SKILLS),
  resourceViews: (context: MesmerUiContext) =>
    mesmerResourceViews(context, {
      id: 'blades',
      singular: 'blade',
      plural: 'blades',
      maximum: 5
    }),
  paletteSkillAvailability: virtuosoPaletteSkillAvailability
});
