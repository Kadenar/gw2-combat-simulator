import { RANGER_SKILL_IDS as ID, RANGER_TRAIT_IDS as TRAIT } from '../../data/ids.js';
import { hasTrait } from '../../../../platform/gw2/trait-state.js';
import { rangerUiState } from '../../core/ui.js';
import type {
  PaletteSkillAvailability,
  ProfessionPaletteGroup,
  ProfessionResourceView,
  ProfessionUiContract,
  SchedulerRecord
} from '../../../../platform/engine/types.js';
import type { RangerSkill, RangerUiContext } from '../../types.js';

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

/** Replaces Quarry's Peril with Pelt only while Perilous Skies is selected. */
function visibleBowSkills(context: RangerUiContext) {
  const perilousSkies = hasTrait(context, TRAIT.PERILOUS_SKIES);
  return BOW_SKILLS.filter((skillId) => skillId !== (perilousSkies ? ID.QUARRYS_PERIL : ID.PELT));
}

function availability(context: RangerUiContext, skill: RangerSkill): PaletteSkillAvailability {
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

  if (Number(skill.arrowCost || 0) > Number(state.arrows || 0)) {
    return { available: false, message: `Requires ${skill.arrowCost} arrows` };
  }

  if (skill.id === ID.HAWKEYE && Number(state.windForce || 0) < 5) {
    return { available: false, message: 'Requires 5 Wind Force' };
  }

  if (skill.id === ID.KEEN_SHOT && Number(state.windForce || 0) >= 5) {
    return { available: false, message: 'Replaced by Hawkeye' };
  }

  if (skill.id === ID.QUARRYS_PERIL && hasTrait(context, TRAIT.PERILOUS_SKIES)) {
    return { available: false, message: 'Replaced by Pelt' };
  }

  if (skill.id === ID.PELT && !hasTrait(context, TRAIT.PERILOUS_SKIES)) {
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

export const galeshotUi: Partial<ProfessionUiContract> & SchedulerRecord = Object.freeze({
  // null = suppress the row entirely; undefined = fall through to default rendering.
  // State-sync events are internal bookkeeping and should not appear in the log.
  eventLogRow: (_context: RangerUiContext, event: SchedulerRecord) =>
    event.type === 'ranger.galeshot-state' ? null : undefined,
  skillBarGroups: (context: RangerUiContext) => [
    {
      id: 'ranger-galeshot-f5',
      label: 'Cyclone Bow',
      // Only one of the two toggle skills is shown at a time to mirror the
      // in-game F5 button that flips between Summon and Dismiss.
      skillIds: [rangerUiState(context).cycloneBowActive ? ID.DISMISS_CYCLONE_BOW : ID.SUMMON_CYCLONE_BOW],
      color: '#67b4c4'
    },
    {
      id: 'ranger-cyclone-bow',
      label: 'Bow',
      skillIds: visibleBowSkills(context),
      color: '#67b4c4',
      className: 'ranger-cyclone-bow-skills',
      // Hawkeye replaces Keen Shot at full Wind Force, so preview the pair
      // as one slot using the same follow-up treatment as autoattack chains.
      inspectionChainRoots: { [ID.HAWKEYE]: ID.KEEN_SHOT }
    }
  ],
  paletteGroups: (context: RangerUiContext): ProfessionPaletteGroup[] => [
    {
      id: 'ranger-galeshot-profession',
      label: 'F5',
      // Both IDs appear in the palette so the user can drag either; the
      // skillBarGroups function hides the inactive one from the live bar.
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
    const skill = context.skill as RangerSkill | undefined;
    if (skill?.handlerId === 'ranger.cyclone-bow-enter') {
      return 'Cyclone Bow';
    }

    if (skill?.handlerId === 'ranger.cyclone-bow-exit') {
      return null;
    }

    return undefined;
  },
  resourceViews: (context: RangerUiContext): ProfessionResourceView[] => {
    const state = rangerUiState(context);
    return [
      {
        id: 'arrows',
        singular: 'arrow',
        plural: 'arrows',
        maximum: 8,
        value: Number(state.arrows ?? context.initialArrows ?? 8),
        startMaximum: 8,
        // startValue drives the "starting arrows" control in the build panel,
        // so it must fall back to the build-level setting, not the live state.
        startValue: Number(context.initialArrows ?? 8),
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
        maximum: 5,
        value: Number(state.windForce || 0),
        startMaximum: 5,
        startValue: 0,
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
  paletteSkillAvailability: availability
});
