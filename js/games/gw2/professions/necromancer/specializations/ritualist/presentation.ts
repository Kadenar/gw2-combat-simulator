import { NECROMANCER_SKILL_IDS as ID } from '#gw2/professions/necromancer/data/ids.js';
import {
  necromancerTransformPaletteGroups,
  necromancerSoulShardResourceViews,
  necromancerUiState
} from '#gw2/professions/necromancer/core/presentation.js';
import type {
  PaletteSkillAvailability,
  ProfessionEventLogDescriptor
} from '#gw2/platform/profession-presentation/types.js';
import type { CanonicalCatalog, SkillId } from '#gw2/platform/engine/skills/types.js';
import type {
  NecromancerSimulationEvent,
  NecromancerSkill,
  NecromancerUiContext,
  NecromancerUiSlice
} from '#gw2/professions/necromancer/types.js';

const RITUALIST_PACKET_EVENTS = new Set<string>([
  'necromancer.painful-bond',
  'necromancer.painful-bond-pulse',
  'necromancer.spirit-attack',
  'necromancer.weapon-spell',
  'necromancer.weapon-spell-ally-trigger'
]);

// Suppress resolver-only Ritualist packets while leaving ordinary events to the shared renderer.
function ritualistEventLogRow(
  _context: NecromancerUiContext,
  event: NecromancerSimulationEvent
): ProfessionEventLogDescriptor | null | undefined {
  // Return null (suppress row) for internal bookkeeping events; undefined defers to the default renderer
  return RITUALIST_PACKET_EVENTS.has(event?.type) ? null : undefined;
}

const INNERVATE_BY_SPIRIT: Readonly<Record<string, SkillId>> = Object.freeze({
  anguish: ID.INNERVATE_ANGUISH,
  wanderlust: ID.INNERVATE_WANDERLUST,
  preservation: ID.INNERVATE_PRESERVATION
});

// Keep each Innervate palette entry synchronized with its owning spirit's lifetime.
function ritualistPaletteAvailability(
  context: NecromancerUiContext,
  skill: NecromancerSkill
): PaletteSkillAvailability {
  // Innervate skills are only castable while the corresponding spirit is alive; gate them in the palette
  const spirit = Object.entries(INNERVATE_BY_SPIRIT).find(([, id]) => id === skill.id)?.[0];
  if (!spirit) return { available: true, message: '' };
  const available = Boolean(necromancerUiState(context).activeSpirits?.[spirit]);
  return {
    available,
    message: available ? '' : `Requires the active ${spirit} spirit`
  };
}

/** Captures this UI's catalog so other profession instances cannot change its projections. */
export function bindRitualistUi(catalog: Readonly<CanonicalCatalog>): NecromancerUiSlice {
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
    resourceViews: (context: NecromancerUiContext) => necromancerSoulShardResourceViews(context),
    paletteSkillAvailability: ritualistPaletteAvailability
  });
}
