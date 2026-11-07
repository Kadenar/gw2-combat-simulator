import { readProfessionSpecializationState } from '#gw2/platform/profession-definition/state.js';
import type {
  ProfessionAttributePreviewContext,
  ProfessionAttributePreviewPreparation
} from '#gw2/platform/profession-presentation/attribute-preview.js';
import type {
  ProfessionPaletteGroup,
  ProfessionStateSnapshotContext,
  RotationStateSnapshotItem
} from '#gw2/platform/profession-presentation/types.js';
import { planningBuffAt } from '#gw2/platform/results/result-queries.js';
import type { CanonicalCatalog, SkillId } from '#gw2/platform/skills/types.js';
import { activeRangerUiPet, rangerPetPaletteGroup, rangerUiState } from '#gw2/professions/ranger/core/presentation.js';
import { RANGER_SKILL_IDS as ID } from '#gw2/professions/ranger/data/ids.js';
import type { SoulbeastState } from '#gw2/professions/ranger/specializations/soulbeast/state.js';
import type { RangerSkill, RangerUiContext, RangerUiSlice } from '#gw2/professions/ranger/types.js';
import { createPreviewControls } from '#gw2/professions/shared/attribute-preview.js';
import { PROFESSION_STATE_IDS as STATE } from '#gw2/professions/state-ids.js';

const BEASTMODE_TOGGLE_IDS = new Set<SkillId>([ID.BEASTMODE, ID.LEAVE_BEASTMODE]);

function beastmodeActive(context: RangerUiContext): boolean {
  // Treat missing state as active: initial state starts in Beastmode, so undefined means merged.
  return rangerUiState(context)[STATE.BEASTMODE_ACTIVE] !== false;
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

  // Show the pet palette only while unmerged. Beastmode uses Beast skills in place of pet skills.
  if (!active) groups.push(rangerPetPaletteGroup(catalog, context));

  return groups;
}

/** Accepted personal stance windows own the countdown at the planning boundary, including post-combat editing. */
function soulbeastStateSnapshot(
  context: ProfessionStateSnapshotContext<RangerUiContext['professionState']>
): RotationStateSnapshotItem[] {
  const stance = planningBuffAt(context.planningState, 'one-wolf-pack');
  return stance
    ? [
        {
          id: 'soulbeast-one-wolf-pack',
          label: 'One Wolf Pack',
          value: `${stance.remaining.toFixed(1)}s`,
          title: 'Time remaining in One Wolf Pack'
        }
      ]
    : [];
}

/** Captures this UI's catalog so other profession instances cannot change its projections. */
export function bindSoulbeastUi(catalog: Readonly<CanonicalCatalog<RangerSkill>>): RangerUiSlice {
  return Object.freeze({
    /** Declare this module's conditional inputs without adding simulation settings. */
    previewControls(context: ProfessionAttributePreviewContext) {
      const preview = createPreviewControls(context);
      // Expose held combat bonuses to isolated damage calculations.
      preview.damageBuff('Twice as Vicious', 'twiceAsVicious', 'twice-as-vicious');

      if (preview.skills.has(ID.SIC_EM))
        preview.add({
          key: 'sicEm',
          label: "Sic 'Em",
          group: 'Other buffs',
          kind: 'buff',
          field: 'sic-em',
          scope: ['damage'],
          description: 'Merged damage bonus active'
        });

      preview.add({
        key: 'merged',
        label: 'Beastmode',
        group: 'Mechanic',
        kind: 'special',
        scope: ['damage'],
        initial: 1,
        description: 'Merged for ordinary attacks; Beastmode skills always require their form'
      });
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
    rotationStateSnapshot: soulbeastStateSnapshot
  });
}
