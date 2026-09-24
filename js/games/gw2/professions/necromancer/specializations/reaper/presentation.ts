import type { CanonicalCatalog } from '#gw2/platform/engine/skills/types.js';
import { NECROMANCER_SKILL_IDS as ID } from '#gw2/professions/necromancer/data/ids.js';
import {
  necromancerCoreTargetHealthThresholds,
  necromancerSoulShardResourceViews,
  necromancerTransformPaletteGroups
} from '#gw2/professions/necromancer/core/presentation.js';
import type { ProfessionResourceView } from '#gw2/platform/profession-presentation/types.js';
import type { NecromancerUiContext, NecromancerUiSlice } from '#gw2/professions/necromancer/types.js';

/** Captures this UI's catalog so other profession instances cannot change its projections. */
export function bindReaperUi(catalog: Readonly<CanonicalCatalog>): NecromancerUiSlice {
  return Object.freeze({
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
