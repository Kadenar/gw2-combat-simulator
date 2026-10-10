import type { ProfessionAttributePreviewContext } from '#gw2/platform/profession-presentation/attribute-preview.js';
import { createPreviewControls } from '#gw2/professions/shared/attribute-preview.js';
import { balanceProfileNumber, requireBalanceProfileFromContext } from '#gw2/platform/skills/balance-profiles.js';
import type { CanonicalCatalog } from '#gw2/platform/skills/types.js';
import type { ProfessionResourceView } from '#gw2/platform/profession-presentation/types.js';
import { rangerPetPaletteGroup, rangerUiState } from '#gw2/professions/ranger/core/presentation.js';
import { RANGER_SKILL_IDS as ID } from '#gw2/professions/ranger/data/ids.js';
import { DRUID_BALANCE_PROFILE_IDS as PROFILE } from '#gw2/professions/ranger/specializations/druid/profiles.js';
import type { RangerSkill, RangerUiContext, RangerUiSlice } from '#gw2/professions/ranger/types.js';

const AVATAR_SKILLS = Object.freeze([
  ID.COSMIC_RAY,
  ID.SEED_OF_LIFE,
  ID.LUNAR_IMPACT,
  ID.REJUVENATING_TIDES,
  ID.NATURAL_CONVERGENCE
]);

/** Share the live clock limit, or the bound catalog's limit for a detached preview. */
function astralForceMaximum(catalog: Readonly<CanonicalCatalog<RangerSkill>>, context: RangerUiContext): number {
  return (
    rangerUiState(context).astralClock?.maximum ??
    balanceProfileNumber(
      requireBalanceProfileFromContext({ catalog: context.catalog ?? catalog }, PROFILE.resources),
      'maximumStacks'
    )
  );
}

/** Captures this UI's catalog so other profession instances cannot change its projections. */
export function bindDruidUi(catalog: Readonly<CanonicalCatalog<RangerSkill>>): RangerUiSlice {
  return Object.freeze({
    /** Expose held combat bonuses without changing the saved build or simulation. */
    previewControls(context: ProfessionAttributePreviewContext) {
      const preview = createPreviewControls(context);
      preview.damageBuff('Natural Balance', 'naturalBalance', 'natural-balance');
      return preview.controls;
    },
    // Tile identity follows the active bar even when the visible skill cannot currently be cast.
    paletteOverride: (context, skill) => {
      if (skill.id === ID.CELESTIAL_AVATAR || skill.id === ID.RELEASE_CELESTIAL_AVATAR)
        return {
          tileActive:
            (skill.id === ID.RELEASE_CELESTIAL_AVATAR) === Boolean(rangerUiState(context).celestialAvatarActive)
        };
    },
    paletteGroups: (context: RangerUiContext) => [
      rangerPetPaletteGroup(catalog, context),
      {
        id: 'ranger-druid-profession',
        label: 'Avatar',
        skillIds: [ID.CELESTIAL_AVATAR, ID.RELEASE_CELESTIAL_AVATAR, ...AVATAR_SKILLS],
        color: '#75c5c5',
        resourceAnchor: true
      }
    ],
    timelineWeaponLineTransition: (context: RangerUiContext) => {
      const skill = context.skill;
      if (skill?.id === ID.CELESTIAL_AVATAR) {
        return 'Celestial Avatar';
      }

      if (skill?.id === ID.RELEASE_CELESTIAL_AVATAR) {
        // null signals end of CA section on the timeline without starting a new named line
        return null;
      }

      return undefined;
    },
    resourceViews: (context: RangerUiContext): ProfessionResourceView[] => {
      const state = rangerUiState(context);
      const maximum = astralForceMaximum(catalog, context);
      return [
        {
          id: 'astral-force',
          singular: 'astral force',
          plural: 'astral force',
          maximum,
          value: state.astralClock?.value ?? context.initialAstralForce ?? maximum,
          startMaximum: maximum,
          canStart: true,
          // buildKey links this value to the config field that persists initial force across sessions
          buildKey: 'initialAstralForce',
          step: 1,
          displayMode: 'bar',
          shortLabel: 'Astral Force',
          statusLabel: state.celestialAvatarActive ? 'Celestial Avatar' : 'Current'
        }
      ];
    }
  });
}
