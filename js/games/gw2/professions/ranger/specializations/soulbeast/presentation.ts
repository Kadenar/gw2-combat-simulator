import type {
  ProfessionAttributePreviewContext,
  ProfessionAttributePreviewPreparation
} from '#gw2/platform/profession-presentation/attribute-preview.js';
import { createAttributePreviewControls } from '#gw2/professions/shared/attribute-preview.js';
import { readProfessionSpecializationState } from '#gw2/platform/engine/profession/state.js';
import type { SoulbeastState } from '#gw2/professions/ranger/specializations/soulbeast/state.js';
import { RANGER_SKILL_IDS as ID } from '#gw2/professions/ranger/data/ids.js';
import { rangerPetPaletteGroup, rangerUiState, activeRangerUiPet } from '#gw2/professions/ranger/core/presentation.js';
import type { CanonicalCatalog, SkillId } from '#gw2/platform/engine/skills/types.js';
import type { ProfessionPaletteGroup, RotationStateSnapshotItem } from '#gw2/platform/profession-presentation/types.js';
import type { SimulationEvent } from '#gw2/platform/engine/events/events.js';
import type { RangerSkill, RangerUiContext, RangerUiSlice } from '#gw2/professions/ranger/types.js';

const BEASTMODE_TOGGLE_IDS = new Set<SkillId>([ID.BEASTMODE, ID.LEAVE_BEASTMODE]);
const SOULBEAST_HIDDEN_EVENT_TYPES = new Set(['ranger.shared-stance-hit']);

function beastmodeActive(context: RangerUiContext): boolean {
  // Treat missing state as active: initial state starts in Beastmode, so undefined means merged.
  return rangerUiState(context).beastmodeActive !== false;
}

function paletteGroups(
  catalog: Readonly<CanonicalCatalog<RangerSkill>>,
  context: RangerUiContext
): ProfessionPaletteGroup[] {
  const active = beastmodeActive(context);
  const groups: ProfessionPaletteGroup[] = [
    {
      id: 'ranger-soulbeast-profession',
      label: 'Beastmode',
      // Declare both toggle sides and let the shared projector choose one.
      skillIds: [ID.BEASTMODE, ID.LEAVE_BEASTMODE, ...(active ? activeRangerUiPet(context).beastmodeSkillIds : [])],
      color: '#b78b42',
      resourceAnchor: true
    }
  ];
  // Pet palette is only meaningful when unmerged — in Beastmode the pet's skills are subsumed into beast skills.
  if (!active) groups.push(rangerPetPaletteGroup(catalog, context));
  return groups;
}

/** Shows One Wolf Pack only while its extra-strike window remains active. */
function soulbeastStateSnapshot(context: RangerUiContext): RotationStateSnapshotItem[] {
  const remaining = (rangerUiState(context).oneWolfPackUntil || 0) - Math.max(0, context.atSeconds || 0);
  return remaining > 0
    ? [
        {
          id: 'soulbeast-one-wolf-pack',
          label: 'One Wolf Pack',
          value: `${remaining.toFixed(1)}s`,
          title: 'Time remaining in One Wolf Pack'
        }
      ]
    : [];
}

/** Captures this UI's catalog so other profession instances cannot change its projections. */
export function bindSoulbeastUi(catalog: Readonly<CanonicalCatalog<RangerSkill>>): RangerUiSlice {
  return Object.freeze({
    /** Declare this module's conditional inputs without adding simulation settings. */
    attributePreviewControls(context: ProfessionAttributePreviewContext) {
      const preview = createAttributePreviewControls(context);
      preview.add({
        key: 'beastmode',
        label: 'Beastmode',
        kind: 'special',
        group: 'Other buffs',
        description: 'Pet archetype and merged trait attributes'
      });
      return preview.controls;
    },
    /** Seed only the detached attribute query; combat state and saved builds remain untouched. */
    prepareAttributePreview(context: ProfessionAttributePreviewPreparation) {
      readProfessionSpecializationState<SoulbeastState>(context.professionState, 'Soulbeast')!.beastmodeActive =
        Boolean(context.values.beastmode);
    },

    // Tile identity follows the active bar even when the visible skill cannot currently be cast.
    paletteOverride: (context, skill) => {
      if (BEASTMODE_TOGGLE_IDS.has(skill.id))
        return { tileActive: (skill.id === ID.LEAVE_BEASTMODE) === beastmodeActive(context) };
    },
    paletteGroups: (context: RangerUiContext) => paletteGroups(catalog, context),
    rotationStateSnapshot: soulbeastStateSnapshot,
    // Return null (suppress) for internal bookkeeping events that have no meaningful display to the user.
    eventLogRow: (_context: RangerUiContext, event: SimulationEvent) =>
      SOULBEAST_HIDDEN_EVENT_TYPES.has(event.type) ? null : undefined
  });
}
