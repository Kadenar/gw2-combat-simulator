import type {
  SkillDamagePreviewContext,
  SkillDamageProbeSetup
} from '#gw2/platform/profession-presentation/skill-damage.js';
import type { Skill as PreviewSkill } from '#gw2/platform/engine/skills/types.js';
import type { ProfessionEffectPresentation } from '#gw2/platform/profession-presentation/types.js';
import {
  mesmerMechanicPaletteGroups,
  mesmerResourceViews,
  mesmerUiState
} from '#gw2/professions/mesmer/core/presentation.js';
import { MESMER_SKILL_IDS as ID } from '#gw2/professions/mesmer/data/ids.js';
import type { MesmerUiContext, MesmerUiSlice } from '#gw2/professions/mesmer/types.js';

const MIRAGE_MECHANIC_SKILLS = Object.freeze([ID.MIND_WRACK, ID.CRY_OF_FRUSTRATION, ID.DIVERSION, ID.DISTORTION]);

/** Publishes Mirage-only timed effects and their chart limits. */
function mirageEffectPresentations(_context: MesmerUiContext): ProfessionEffectPresentation[] {
  return [
    {
      id: 'mesmer-phantom-pain',
      kind: 'phantom-pain',
      name: 'Phantom Pain',
      color: '#df79bd'
    },
    {
      id: 'mesmer-mirage-cloak',
      kind: 'mirage-cloak',
      name: 'Mirage Cloak',
      color: '#d6b46b'
    }
  ];
}

export const mirageUi: MesmerUiSlice = Object.freeze({
  /** Prepare legal preview casts with the same catalog metadata and transitions used by the runtime. */
  skillDamageProbe(context: SkillDamagePreviewContext, skill: PreviewSkill): SkillDamageProbeSetup | null {
    // Crystal Sands creates the mirror at its impact; collection must wait for that real scheduled grant.
    if (skill.id === ID.PICK_UP_MIRAGE_MIRROR)
      return {
        setup: [
          { type: 'cast', skillId: ID.CRYSTAL_SANDS },
          {
            type: 'wait',
            durationMs:
              context.catalog.skillsById
                .get(ID.CRYSTAL_SANDS)
                ?.tasks?.find((task) => task.type === 'mesmer.mirage.create-mirror')?.atMs ?? 0
          }
        ]
      };
    if (!skill.ambush) return null;
    return { setup: [{ type: 'cast', skillId: ID.DODGE_MIRAGE_CLOAK }] };
  },

  effectPresentations: mirageEffectPresentations,
  // Mirage's dodge and mirror precede shared actions, preserving the shell's order for everything else.
  paletteActionSkills: (_context, skills) => {
    const order = (id: number | string) => (id === ID.DODGE_MIRAGE_CLOAK ? 0 : id === ID.PICK_UP_MIRAGE_MIRROR ? 1 : 2);
    return [...skills].sort((left, right) => order(left.id) - order(right.id));
  },
  paletteGroups: (context: MesmerUiContext) => mesmerMechanicPaletteGroups(context, MIRAGE_MECHANIC_SKILLS, 'clones'),
  resourceViews: (context: MesmerUiContext) => [
    ...mesmerResourceViews(context, {
      id: 'clones',
      singular: 'clone',
      plural: 'clones'
    }),
    // Reuse the shared endurance bar under Dodge while keeping clone pips above the shatters.
    {
      id: 'endurance',
      singular: 'endurance',
      plural: 'endurance',
      maximum: context.resources!.endurance!.maximum,
      value: mesmerUiState(context).endurance ?? 100,
      canStart: false,
      step: 1,
      displayMode: 'bar',
      pipStyle: 'endurance',
      shortLabel: 'End',
      statusLabel: 'Current',
      paletteSkillId: ID.DODGE_MIRAGE_CLOAK
    }
  ]
});
