import {
  balanceProfileNumber,
  requireBalanceProfileFromContext
} from '#gw2/platform/engine/skills/balance-profiles.js';
import type { CanonicalCatalog } from '#gw2/platform/engine/skills/types.js';
import type {
  PaletteSkillAvailability,
  ProfessionPaletteGroup,
  ProfessionResourceView,
  RotationStateSnapshotItem
} from '#gw2/platform/profession-presentation/types.js';
import { rangerPetPaletteGroup, rangerUiState } from '#gw2/professions/ranger/core/presentation.js';
import { RANGER_SKILL_IDS as ID } from '#gw2/professions/ranger/data/ids.js';
import { GALESHOT_BALANCE_PROFILE_IDS as PROFILE } from '#gw2/professions/ranger/specializations/galeshot/profiles.js';
import { perilousSkiesSelected } from '#gw2/professions/ranger/specializations/galeshot/traits/behavior.js';
import type { RangerSkill, RangerUiContext, RangerUiSlice } from '#gw2/professions/ranger/types.js';

const BOW_SKILLS = Object.freeze([
  ID.KEEN_SHOT,
  ID.HAWKEYE,
  ID.BLUSTER,
  ID.FLEETING_ZEPHYR,
  ID.QUARRYS_PERIL,
  ID.PELT,
  ID.SUPERSONIC_ARROW
]);
const GALESHOT_PALETTE_STACK = 'ranger-galeshot';

/** Shows Mistral only while its Galeshot damage window remains active. */
function galeshotStateSnapshot(context: RangerUiContext): RotationStateSnapshotItem[] {
  const expiresAt = rangerUiState(context).mistralUntil || 0;
  const remaining = expiresAt - Math.max(0, context.atSeconds || 0);
  // The final missile may trigger at equality; zero remains the unarmed sentinel.
  return expiresAt > 0 && remaining >= 0
    ? [
        {
          id: 'galeshot-mistral',
          label: 'Mistral',
          value: `${remaining.toFixed(1)}s`,
          title: 'Time remaining in Mistral'
        }
      ]
    : [];
}

/** Replaces Quarry's Peril with Pelt only while Perilous Skies is selected. */
function visibleBowSkills(context: RangerUiContext) {
  const perilousSkies = perilousSkiesSelected(context);
  return BOW_SKILLS.filter((skillId) => skillId !== (perilousSkies ? ID.QUARRYS_PERIL : ID.PELT));
}

// Mirror Galeshot's runtime resource, replacement, and temporary weapon-bar gates
// in the palette without mutating live state.
function availability(
  catalog: Readonly<CanonicalCatalog<RangerSkill>>,
  context: RangerUiContext,
  skill: RangerSkill
): PaletteSkillAvailability {
  const state = rangerUiState(context);
  if (skill.id === ID.DISMISS_CYCLONE_BOW && !state.cycloneBowActive) {
    return { available: false, message: 'Cyclone Bow is not active' };
  }

  if (skill.id === ID.SUMMON_CYCLONE_BOW && state.cycloneBowActive) {
    return { available: false, message: 'Cyclone Bow is already active' };
  }

  if (skill.cycloneBowSkill && !state.cycloneBowActive) {
    return { available: false, message: 'Summon the Cyclone Bow first' };
  }

  if ((skill.arrowCost || 0) > (state.arrows?.value || 0)) {
    return { available: false, message: `Requires ${skill.arrowCost} arrows` };
  }

  // Resolve the same patched Wind Force threshold used by runtime grants and cast gates.
  const maximumWindForce = balanceProfileNumber(
    requireBalanceProfileFromContext({ catalog: context.catalog ?? catalog }, PROFILE.resources),
    'minimumStacks'
  );
  if (skill.id === ID.HAWKEYE && (state.windForce || 0) < maximumWindForce) {
    return { available: false, message: `Requires ${maximumWindForce} Wind Force` };
  }

  if (skill.id === ID.KEEN_SHOT && (state.windForce || 0) >= maximumWindForce) {
    return { available: false, message: 'Replaced by Hawkeye' };
  }

  if (skill.id === ID.QUARRYS_PERIL && perilousSkiesSelected(context)) {
    return { available: false, message: 'Replaced by Pelt' };
  }

  if (skill.id === ID.PELT && !perilousSkiesSelected(context)) {
    return { available: false, message: 'Requires Perilous Skies' };
  }

  if (state.cycloneBowActive && skill.type === 'Weapon' && !skill.cycloneBowSkill) {
    return {
      available: false,
      message: 'Cyclone Bow replaces weapon skills'
    };
  }

  return { available: true, message: '' };
}

/** Captures this UI's catalog so other profession instances cannot change its projections. */
export function bindGaleshotUi(catalog: Readonly<CanonicalCatalog<RangerSkill>>): RangerUiSlice {
  return Object.freeze({
    // null = suppress the row entirely; undefined = fall through to default rendering.
    // State-sync events are internal bookkeeping and should not appear in the log.
    paletteGroups: (context: RangerUiContext): ProfessionPaletteGroup[] => [
      rangerPetPaletteGroup(catalog, context, { stackId: GALESHOT_PALETTE_STACK }),
      {
        id: 'ranger-galeshot-profession',
        label: 'F5',
        // Declare both sides so the shared projector can render the currently
        // usable Summon/Dismiss identity as one live F5 tile.
        skillIds: [ID.SUMMON_CYCLONE_BOW, ID.DISMISS_CYCLONE_BOW],
        color: '#67b4c4',
        className: 'ranger-galeshot-f5',
        resourceIds: ['arrows'],
        resourcePlacement: 'beside',
        stackId: GALESHOT_PALETTE_STACK
      },
      {
        id: 'ranger-cyclone-bow',
        label: 'CB',
        skillIds: visibleBowSkills(context),
        color: '#67b4c4',
        className: 'ranger-cyclone-bow-skills',
        resourceIds: ['wind-force'],
        resourcePlacement: 'above',
        stackId: GALESHOT_PALETTE_STACK
      }
    ],
    timelineWeaponLineTransition: (context: RangerUiContext) => {
      const skill = context.skill;
      if (skill?.id === ID.SUMMON_CYCLONE_BOW) {
        return 'Cyclone Bow';
      }

      if (skill?.id === ID.DISMISS_CYCLONE_BOW) {
        return null;
      }

      return undefined;
    },
    resourceViews: (context: RangerUiContext): ProfessionResourceView[] => {
      const state = rangerUiState(context);
      const profile = requireBalanceProfileFromContext({ catalog: context.catalog ?? catalog }, PROFILE.resources);
      const maximumWindForce = balanceProfileNumber(profile, 'minimumStacks');
      const maximum =
        state.arrows?.maximum ?? context.resources?.arrows?.maximum ?? balanceProfileNumber(profile, 'maximumStacks');
      return [
        {
          id: 'arrows',
          singular: 'arrow',
          plural: 'arrows',
          maximum,
          value: state.arrows?.value ?? context.initialArrows ?? maximum,
          startMaximum: maximum,
          canStart: true,
          buildKey: 'initialArrows',
          step: 1,
          displayMode: 'pips',
          pipStyle: 'ranger-arrows',
          showValue: false,
          shortLabel: 'Arrows',
          statusLabel: 'Current'
        },
        {
          id: 'wind-force',
          singular: 'Wind Force',
          plural: 'Wind Force',
          maximum: maximumWindForce,
          value: state.windForce || 0,
          startMaximum: maximumWindForce,
          canStart: false,
          displayMode: 'pips',
          pipStyle: 'ranger-wind-force',
          showValue: false,
          shortLabel: 'WF',
          // Wind Force is meaningless when the Cyclone Bow isn't summoned, so
          // the status label reflects bow state rather than a numeric count.
          statusLabel: state.cycloneBowActive ? 'Cyclone Bow' : 'Inactive'
        }
      ];
    },
    rotationStateSnapshot: galeshotStateSnapshot,
    paletteSkillAvailability: (context: RangerUiContext, skill: RangerSkill) => availability(catalog, context, skill)
  });
}
