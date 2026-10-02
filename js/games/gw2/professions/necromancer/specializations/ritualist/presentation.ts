import { NECROMANCER_SKILL_IDS as ID } from '#gw2/professions/necromancer/data/ids.js';
import {
  necromancerTransformPaletteGroups,
  necromancerSoulShardResourceViews
} from '#gw2/professions/necromancer/core/presentation.js';
import type { ProfessionEventLogDescriptor } from '#gw2/platform/profession-presentation/types.js';
import type { CanonicalCatalog, SkillId } from '#gw2/platform/engine/skills/types.js';
import type { NecromancerSkill, NecromancerUiContext, NecromancerUiSlice } from '#gw2/professions/necromancer/types.js';
import type { SimulationEvent } from '#gw2/platform/engine/events/events.js';

// Suppress resolver-only Ritualist packets while leaving ordinary events to the shared renderer.
function ritualistEventLogRow(
  _context: NecromancerUiContext,
  event: SimulationEvent
): ProfessionEventLogDescriptor | null | undefined {
  // Return null (suppress row) for internal bookkeeping events; undefined defers to the default renderer
  return event.type === 'necromancer.painful-bond' ? null : undefined;
}

const INNERVATE_BY_SPIRIT: Readonly<Record<string, SkillId>> = Object.freeze({
  anguish: ID.INNERVATE_ANGUISH,
  wanderlust: ID.INNERVATE_WANDERLUST,
  preservation: ID.INNERVATE_PRESERVATION
});

/** Captures this UI's catalog so other profession instances cannot change its projections. */
export function bindRitualistUi(catalog: Readonly<CanonicalCatalog<NecromancerSkill>>): NecromancerUiSlice {
  return Object.freeze({
    eventLogRow: ritualistEventLogRow,
    paletteGroups: (context: NecromancerUiContext) =>
      necromancerTransformPaletteGroups(catalog, context, {
        entryId: ID.RITUALISTS_SHROUD,
        exitId: ID.EXIT_RITUALISTS_SHROUD,
        shroud: 'ritualist',
        professionSkillIds: Object.values(INNERVATE_BY_SPIRIT),
        stackId: 'ritualist-profession'
      }),
    resourceViews: (context: NecromancerUiContext) => necromancerSoulShardResourceViews(context)
  });
}
