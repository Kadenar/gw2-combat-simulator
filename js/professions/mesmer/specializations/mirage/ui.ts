import { MESMER_SKILL_IDS as ID } from '../../data/ids.js';
import { mesmerMechanicPaletteGroups, mesmerMechanicSkillBarGroups, mesmerResourceViews } from '../../core/ui.js';
import type { ProfessionUiContract, SchedulerRecord } from '../../../../platform/engine/types.js';
import type { MesmerUiContext } from '../../types.js';

const MIRAGE_MECHANIC_SKILLS = Object.freeze([ID.MIND_WRACK, ID.CRY_OF_FRUSTRATION, ID.DIVERSION, ID.DISTORTION]);

export const mirageUi: Partial<ProfessionUiContract> & SchedulerRecord = Object.freeze({
  paletteGroups: (context: MesmerUiContext) => mesmerMechanicPaletteGroups(context, MIRAGE_MECHANIC_SKILLS),
  skillBarGroups: () => mesmerMechanicSkillBarGroups('Shatters', MIRAGE_MECHANIC_SKILLS),
  resourceViews: (context: MesmerUiContext) =>
    mesmerResourceViews(context, {
      id: 'clones',
      singular: 'clone',
      plural: 'clones',
      maximum: 3
    })
});
