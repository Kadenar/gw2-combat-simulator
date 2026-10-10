import type {
  ProfessionAttributePreviewContext,
  ProfessionAttributePreviewPreparation
} from '#gw2/platform/profession-presentation/attribute-preview.js';
import { createPreviewControls } from '#gw2/professions/shared/attribute-preview.js';
import { readProfessionSpecializationState } from '#gw2/platform/profession-definition/state.js';
import type { ScourgeState } from '#gw2/professions/necromancer/specializations/scourge/state.js';
import type { CanonicalCatalog } from '#gw2/platform/skills/types.js';
import { getActiveTraits } from '#gw2/professions/necromancer/data/traits-data.js';
import { NECROMANCER_SKILL_IDS as ID, NECROMANCER_TRAIT_IDS as TRAIT } from '#gw2/professions/necromancer/data/ids.js';
import {
  necromancerTransformPaletteGroups,
  necromancerSoulShardResourceViews,
  necromancerUiState
} from '#gw2/professions/necromancer/core/presentation.js';
import type { ProfessionResourceView } from '#gw2/platform/profession-presentation/types.js';
import type { NecromancerSkill, NecromancerUiContext, NecromancerUiSlice } from '#gw2/professions/necromancer/types.js';

const SCOURGE_SKILLS = Object.freeze([
  ID.MANIFEST_SAND_SHADE,
  ID.NEFARIOUS_FAVOR,
  ID.SAND_CASCADE,
  ID.GARISH_PILLAR,
  ID.DESERT_SHROUD,
  ID.SANDSTORM_SHROUD
]);

/** Captures this UI's catalog so other profession instances cannot change its projections. */
export function bindScourgeUi(catalog: Readonly<CanonicalCatalog<NecromancerSkill>>): NecromancerUiSlice {
  return Object.freeze({
    /** Declare this module's conditional inputs without adding simulation settings. */
    previewControls(context: ProfessionAttributePreviewContext) {
      const preview = createPreviewControls(context);
      preview.trait('Sand Sage', {
        key: 'shade',
        scope: ['attributes', 'damage'],
        kind: 'special',
        description: 'Shade active; Expertise / Concentration'
      });
      return preview.controls;
    },
    /** Seed only the detached attribute query; combat state and saved builds remain untouched. */
    prepareAttributePreview(context: ProfessionAttributePreviewPreparation) {
      readProfessionSpecializationState<ScourgeState>(context.professionState, 'Scourge')!.shades = Array(
        Number(context.values.shade || 0)
      ).fill(60);
    },

    // The trait replacement owns F5 even when its resource cost cannot currently be paid.
    paletteOverride: (context, skill) => {
      if (skill.id !== ID.DESERT_SHROUD && skill.id !== ID.SANDSTORM_SHROUD) return;
      const replaced = getActiveTraits(context.build?.specializations || []).some(
        (trait) => trait.id === TRAIT.HERALD_OF_SORROW
      );
      return { tileActive: (skill.id === ID.SANDSTORM_SHROUD) === replaced };
    },
    paletteGroups: (context: NecromancerUiContext) =>
      necromancerTransformPaletteGroups(catalog, context, {
        professionSkillIds: SCOURGE_SKILLS
      }),
    resourceViews: (context: NecromancerUiContext): ProfessionResourceView[] => [
      ...necromancerSoulShardResourceViews(context),
      {
        id: 'active-shades',
        singular: 'active shade',
        plural: 'active shades',
        // Hard-coded at 3 even with Sand Savant; Sand Savant trades count for power but
        // the resource display cap stays at 3 pips to keep the UI consistent
        maximum: 3,
        // shades array holds expiry timestamps; its length is the live count
        value: necromancerUiState(context).shades?.length || 0,
        canStart: false,
        step: 1,
        displayMode: 'counter',
        pipStyle: 'necromancer-scourge-shades',
        shortLabel: 'Shade',
        statusLabel: 'Current',
        showValue: false
      }
    ]
  });
}
