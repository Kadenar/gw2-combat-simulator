import type {
  ProfessionAttributePreviewContext,
  ProfessionAttributePreviewPreparation
} from '#gw2/platform/profession-presentation/attribute-preview.js';
import { createPreviewControls } from '#gw2/professions/shared/attribute-preview.js';
import { readProfessionCoreState } from '#gw2/platform/profession-definition/state.js';
import type { NecromancerCoreState } from '#gw2/professions/necromancer/core/state.js';
import type { CanonicalCatalog } from '#gw2/platform/skills/types.js';
import { NECROMANCER_SKILL_IDS as ID } from '#gw2/professions/necromancer/data/ids.js';
import {
  necromancerCoreTargetHealthThresholds,
  necromancerSoulShardResourceViews,
  necromancerTransformPaletteGroups
} from '#gw2/professions/necromancer/core/presentation.js';
import type { ProfessionResourceView } from '#gw2/platform/profession-presentation/types.js';
import type { NecromancerSkill, NecromancerUiContext, NecromancerUiSlice } from '#gw2/professions/necromancer/types.js';

/** Captures this UI's catalog so other profession instances cannot change its projections. */
export function bindReaperUi(catalog: Readonly<CanonicalCatalog<NecromancerSkill>>): NecromancerUiSlice {
  return Object.freeze({
    /** Declare this module's conditional inputs without adding simulation settings. */
    previewControls(context: ProfessionAttributePreviewContext) {
      const preview = createPreviewControls(context);
      // Expose held combat bonuses to isolated damage calculations.
      if (preview.has('Cold Shoulder'))
        preview.add({
          key: 'condition:Chilled',
          label: 'Target Chilled',
          group: 'Target conditions',
          kind: 'condition',
          field: 'Chilled',
          scope: ['damage'],
          description: 'Cold Shoulder'
        });
      preview.condition('Vulnerability', 'Decimate Defenses');
      return preview.controls;
    },
    /** Seed only the detached attribute query; combat state and saved builds remain untouched. */
    prepareAttributePreview(context: ProfessionAttributePreviewPreparation) {
      if (context.values.shroud)
        readProfessionCoreState<NecromancerCoreState>(context.professionState).activeShroud = 'reaper';
    },

    // Refresh the weapon row at this profession's transformation boundary.
    timelineWeaponLineTransition: (context: NecromancerUiContext) =>
      context.skill && [ID.REAPERS_SHROUD, ID.EXIT_REAPERS_SHROUD].some((id) => id === context.skill!.id)
        ? (context.weaponLine ?? null)
        : undefined,

    paletteGroups: (context: NecromancerUiContext) =>
      necromancerTransformPaletteGroups(catalog, context, {
        entryId: ID.REAPERS_SHROUD,
        exitId: ID.EXIT_REAPERS_SHROUD,
        shroud: 'reaper',
        stackId: 'reaper-profession'
      }),
    resourceViews: (context: NecromancerUiContext): ProfessionResourceView[] =>
      necromancerSoulShardResourceViews(context),
    // Suppress the default 50% Gravedigger threshold when the core layer already defines its own thresholds.
    targetHealthThresholds: (context: NecromancerUiContext) =>
      necromancerCoreTargetHealthThresholds(context).length ? [] : [0.5]
  });
}
