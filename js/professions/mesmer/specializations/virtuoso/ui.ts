import { MESMER_SKILL_IDS as ID } from '../../data/ids.js';
import { mesmerMechanicPaletteGroups, mesmerMechanicSkillBarGroups, mesmerResourceViews } from '../../core/ui.js';
import type { ProfessionUiContract, SchedulerRecord } from '../../../../platform/engine/types.js';
import type { MesmerUiContext } from '../../types.js';

const VIRTUOSO_MECHANIC_SKILLS = Object.freeze([
  ID.BLADESONG_HARMONY,
  ID.BLADESONG_SORROW,
  ID.BLADESONG_DISSONANCE,
  ID.BLADESONG_DISTORTION,
  ID.BLADETURN_REQUIEM
]);

export const virtuosoUi: Partial<ProfessionUiContract> & SchedulerRecord = Object.freeze({
  paletteGroups: (context: MesmerUiContext) => mesmerMechanicPaletteGroups(context, VIRTUOSO_MECHANIC_SKILLS, 'blades'),
  skillBarGroups: () => mesmerMechanicSkillBarGroups('Bladesongs', VIRTUOSO_MECHANIC_SKILLS),
  resourceViews: (context: MesmerUiContext) =>
    mesmerResourceViews(context, {
      id: 'blades',
      singular: 'blade',
      plural: 'blades',
      maximum: 5
    })
});
