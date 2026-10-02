import type { CanonicalCatalog } from '#gw2/platform/engine/skills/types.js';
import {
  balanceProfileNumber,
  requireBalanceProfileFromContext
} from '#gw2/platform/engine/skills/balance-profiles.js';
import { DRUID_BALANCE_PROFILE_IDS as PROFILE } from '#gw2/professions/ranger/specializations/druid/profiles.js';
import { RANGER_SKILL_IDS as ID } from '#gw2/professions/ranger/data/ids.js';
import { rangerPetPaletteGroup, rangerUiState } from '#gw2/professions/ranger/core/presentation.js';
import type { PaletteSkillAvailability, ProfessionResourceView } from '#gw2/platform/profession-presentation/types.js';
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

function availability(
  catalog: Readonly<CanonicalCatalog<RangerSkill>>,
  context: RangerUiContext,
  skill: RangerSkill
): PaletteSkillAvailability {
  const state = rangerUiState(context);
  const active = Boolean(state.celestialAvatarActive);
  if (skill.id === ID.CELESTIAL_AVATAR) {
    if (active) {
      return {
        available: false,
        message: 'Celestial Avatar is already active'
      };
    }

    // Runtime snapshots and detached planning projections share the same force clock.
    if ((state.astralClock?.value ?? 0) < astralForceMaximum(catalog, context)) {
      return { available: false, message: 'Requires full Astral Force' };
    }
  }

  if (skill.id === ID.RELEASE_CELESTIAL_AVATAR && !active) {
    return { available: false, message: 'Celestial Avatar is not active' };
  }

  if (skill.celestialAvatarSkill && !active) {
    return { available: false, message: 'Enter Celestial Avatar first' };
  }

  // Normal weapon skills are suppressed while in CA; only CA skills (celestialAvatarSkill=true) show available
  if (skill.type === 'Weapon' && active && !skill.celestialAvatarSkill) {
    return {
      available: false,
      message: 'Celestial Avatar replaces weapon skills'
    };
  }

  return { available: true, message: '' };
}

/** Captures this UI's catalog so other profession instances cannot change its projections. */
export function bindDruidUi(catalog: Readonly<CanonicalCatalog<RangerSkill>>): RangerUiSlice {
  return Object.freeze({
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
    },
    paletteSkillAvailability: (context: RangerUiContext, skill: RangerSkill) => availability(catalog, context, skill)
  });
}
