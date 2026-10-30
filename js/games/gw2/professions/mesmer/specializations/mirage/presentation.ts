import { boonKey } from '#gw2/platform/combat/boons.js';
import { ENDURANCE } from '#gw2/platform/combat/resources/endurance-rules.js';
import { BOON } from '#gw2/platform/constants.js';
import type { ProfessionAttributePreviewContext } from '#gw2/platform/profession-presentation/attribute-preview.js';
import type { ProfessionEffectPresentation } from '#gw2/platform/profession-presentation/types.js';
import {
  mesmerMechanicPaletteGroups,
  mesmerResourceViews,
  mesmerUiState
} from '#gw2/professions/mesmer/core/presentation.js';
import { MESMER_SKILL_IDS as ID } from '#gw2/professions/mesmer/data/ids.js';
import type { MesmerUiContext, MesmerUiSlice } from '#gw2/professions/mesmer/types.js';
import { createPreviewControls } from '#gw2/professions/shared/attribute-preview.js';
import { PROFESSION_STATE_IDS as STATE } from '#gw2/professions/state-ids.js';

const MIRAGE_MECHANIC_SKILLS = Object.freeze([ID.MIND_WRACK, ID.CRY_OF_FRUSTRATION, ID.DIVERSION, ID.DISTORTION]);

/** Publishes Mirage-only timed effects and their chart limits. */
function mirageEffectPresentations(): ProfessionEffectPresentation[] {
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
  /** Expose held combat bonuses without changing the saved build or simulation. */
  previewControls(context: ProfessionAttributePreviewContext) {
    const preview = createPreviewControls(context);
    preview.damageBuff('Phantom Pain', 'phantomPain', 'phantom-pain', true);
    preview.boon(boonKey(BOON.VIGOR), "Nomad's Endurance");
    return preview.controls;
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
      maximum: mesmerUiState(context)[STATE.ENDURANCE]?.maximum ?? context.resources!.endurance!.maximum,
      value: mesmerUiState(context)[STATE.ENDURANCE]?.value ?? ENDURANCE.maximum,
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
