import { MESMER_SKILL_IDS as ID } from '../../data/ids.js';
import { mesmerMechanicPaletteGroups, mesmerMechanicSkillBarGroups, mesmerResourceViews } from '../../core/ui.js';
import type {
  ProfessionEventLogDescriptor,
  PaletteSkillAvailability,
  ProfessionUiContract,
  SchedulerRecord,
  Skill
} from '../../../../platform/engine/types.js';
import type { MesmerResolverEvent, MesmerUiContext } from '../../types.js';

const CHRONOMANCER_MECHANIC_SKILLS = Object.freeze([
  ID.SPLIT_SECOND,
  ID.REWINDER,
  ID.TIME_SINK,
  ID.DISTORTION,
  ID.CONTINUUM_SPLIT
]);
const CHRONOMANCER_PALETTE_SKILLS = Object.freeze([...CHRONOMANCER_MECHANIC_SKILLS, ID.CONTINUUM_SHIFT]);

function chronomancerEventLogRow(
  _context: SchedulerRecord,
  event: MesmerResolverEvent
): ProfessionEventLogDescriptor | undefined {
  if (event?.type !== 'mesmer.phantasm-resummoned') return undefined;
  return {
    type: event.type,
    description: `PHANTASM RESUMMONED ${event.name} x${event.count} [Chronophantasma]`,
    className: 'phantasm',
    order: 21,
    flags: ['phantasm-clone']
  };
}

/** Keeps Continuum Shift unavailable until the active split has produced a restorable snapshot. */
function chronomancerPaletteSkillAvailability(context: MesmerUiContext, skill: Skill): PaletteSkillAvailability {
  if (skill.id !== ID.CONTINUUM_SHIFT) return { available: true, message: '' };
  const state = (context.professionState || context.state?.profession || {}) as SchedulerRecord;
  const available = Boolean(state.continuumActive);
  return {
    available,
    message: available ? '' : 'Unavailable until Continuum Split is active'
  };
}

export const chronomancerUi: Partial<ProfessionUiContract> & SchedulerRecord = Object.freeze({
  eventLogRow: chronomancerEventLogRow,
  paletteGroups: (context: MesmerUiContext) =>
    mesmerMechanicPaletteGroups(context, CHRONOMANCER_PALETTE_SKILLS, 'clones').map((group) => ({
      ...group,
      includeActionSkills: true
    })),
  skillBarGroups: () => mesmerMechanicSkillBarGroups('Shatters', CHRONOMANCER_MECHANIC_SKILLS),
  resourceViews: (context: MesmerUiContext) =>
    mesmerResourceViews(context, {
      id: 'clones',
      singular: 'clone',
      plural: 'clones',
      maximum: 3
    }),
  paletteSkillAvailability: chronomancerPaletteSkillAvailability
});
