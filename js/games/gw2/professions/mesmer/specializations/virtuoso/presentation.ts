import type { ProfessionAttributePreviewContext } from '#gw2/platform/profession-presentation/attribute-preview.js';
import { createPreviewControls } from '#gw2/professions/shared/attribute-preview.js';
import { MESMER_SKILL_IDS as ID } from '#gw2/professions/mesmer/data/ids.js';
import { mesmerMechanicPaletteGroups, mesmerResourceViews } from '#gw2/professions/mesmer/core/presentation.js';
import type { ProfessionEffectPresentation } from '#gw2/platform/profession-presentation/types.js';
import type { MesmerUiContext, MesmerUiSlice } from '#gw2/professions/mesmer/types.js';

const VIRTUOSO_MECHANIC_SKILLS = Object.freeze([
  ID.BLADESONG_HARMONY,
  ID.BLADESONG_SORROW,
  ID.BLADESONG_DISSONANCE,
  ID.BLADESONG_DISTORTION,
  ID.BLADETURN_REQUIEM
]);

const VIRTUOSO_EFFECT_PRESENTATIONS: readonly ProfessionEffectPresentation[] = Object.freeze([
  {
    id: 'mesmer-deadly-blades',
    kind: 'deadly-blades',
    name: 'Deadly Blades',
    color: '#e38a8a'
  }
]);

export const virtuosoUi: MesmerUiSlice = Object.freeze({
  /** Expose held combat bonuses without changing the saved build or simulation. */
  previewControls(context: ProfessionAttributePreviewContext) {
    const preview = createPreviewControls(context);
    preview.damageBuff('Deadly Blades', 'deadlyBlades', 'deadly-blades');
    return preview.controls;
  },
  // Deadly Blades is binary even when repeated critical hits overlap its duration.
  effectPresentations: () => [...VIRTUOSO_EFFECT_PRESENTATIONS],
  paletteGroups: (context: MesmerUiContext) => mesmerMechanicPaletteGroups(context, VIRTUOSO_MECHANIC_SKILLS, 'blades'),
  resourceViews: (context: MesmerUiContext) =>
    mesmerResourceViews(context, {
      id: 'blades',
      singular: 'blade',
      plural: 'blades'
    })
});
