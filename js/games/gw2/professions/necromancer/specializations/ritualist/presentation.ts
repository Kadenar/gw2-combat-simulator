import type { ProfessionAttributePreviewPreparation } from '#gw2/platform/profession-presentation/attribute-preview.js';
import { readProfessionCoreState } from '#gw2/platform/engine/profession/state.js';
import type { NecromancerCoreState } from '#gw2/professions/necromancer/core/state.js';
import { NECROMANCER_SKILL_IDS as ID } from '#gw2/professions/necromancer/data/ids.js';
import {
  necromancerTransformPaletteGroups,
  necromancerSoulShardResourceViews
} from '#gw2/professions/necromancer/core/presentation.js';
import type { ProfessionEventLogDescriptor } from '#gw2/platform/profession-presentation/types.js';
import type { CanonicalCatalog, SkillId } from '#gw2/platform/engine/skills/types.js';
import type { NecromancerSkill, NecromancerUiContext, NecromancerUiSlice } from '#gw2/professions/necromancer/types.js';
import type { SimulationEvent } from '#gw2/platform/engine/events/events.js';
import type { Skill } from '#gw2/platform/engine/skills/types.js';
import type {
  SkillDamagePreviewContext,
  SkillDamageProbeSetup
} from '#gw2/platform/profession-presentation/skill-damage.js';

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
    /** Summon the existing spirit set before measuring an Innervate activation. */
    skillDamageProbe(context: SkillDamagePreviewContext, skill: Skill): SkillDamageProbeSetup | null {
      // Discover the player's weapon-spell charges even when no allied strike schedule is configured.
      if (skill.id === ID.NIGHTMARE_WEAPON || skill.id === ID.SPLINTER_WEAPON) return { procFollowUpSetup: [] };
      const spirit = Object.entries(INNERVATE_BY_SPIRIT).find(([, id]) => id === skill.id)?.[0];
      const summon = spirit && context.catalog.skills.find((entry) => entry.name.toLowerCase() === spirit);
      return summon
        ? {
            initialResource: 100,
            setup: [
              ...(summon.shroud ? [{ type: 'cast' as const, skillId: ID.RITUALISTS_SHROUD }] : []),
              { type: 'cast', skillId: summon.id }
            ]
          }
        : null;
    },
    /** Seed only the detached attribute query; combat state and saved builds remain untouched. */
    prepareAttributePreview(context: ProfessionAttributePreviewPreparation) {
      if (context.values.shroud)
        readProfessionCoreState<NecromancerCoreState>(context.professionState).activeShroud = 'ritualist';
    },

    // Refresh the weapon row at this profession's transformation boundary.
    timelineWeaponLineTransition: (context: NecromancerUiContext) =>
      context.skill && [ID.RITUALISTS_SHROUD, ID.EXIT_RITUALISTS_SHROUD].some((id) => id === context.skill!.id)
        ? (context.weaponLine ?? null)
        : undefined,

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
