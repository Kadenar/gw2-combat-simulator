import { MESMER_SKILL_IDS as ID } from '#gw2/professions/mesmer/data/ids.js';
import { balanceProfileValueFromContext } from '#gw2/platform/combat/state/balance-profiles.js';
import {
  mesmerMechanicPaletteGroups,
  mesmerMechanicSkillBarGroups,
  mesmerResourceViews
} from '#gw2/professions/mesmer/core/presentation.js';
import { MIRAGE_BALANCE_PROFILE_IDS as PROFILE } from '#gw2/professions/mesmer/specializations/mirage/profiles.js';
import type {
  PaletteSkillAvailability,
  ProfessionEffectPresentation,
  ProfessionUiContract,
  SchedulerRecord,
  Skill
} from '#gw2/platform/engine/types.js';
import type { MesmerUiContext } from '#gw2/professions/mesmer/types.js';

const MIRAGE_MECHANIC_SKILLS = Object.freeze([ID.MIND_WRACK, ID.CRY_OF_FRUSTRATION, ID.DIVERSION, ID.DISTORTION]);

/** Publishes Mirage-only timed effects and their chart limits. */
function mirageEffectPresentations(context: SchedulerRecord): ProfessionEffectPresentation[] {
  return [
    {
      id: 'mesmer-phantom-pain',
      kind: 'phantom-pain',
      name: 'Phantom Pain',
      color: '#df79bd',
      maximumStacks: balanceProfileValueFromContext(context, PROFILE.phantomPain, 'maximumStacks', 4)
    },
    {
      id: 'mesmer-mirage-cloak',
      kind: 'mirage-cloak',
      name: 'Mirage Cloak',
      color: '#d6b46b',
      maximumStacks: 1
    }
  ];
}

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
  effectPresentations: mirageEffectPresentations,
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
