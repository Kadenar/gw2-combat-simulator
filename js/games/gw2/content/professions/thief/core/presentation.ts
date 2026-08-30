import { flattenProfessionState } from '../../../../platform/engine/profession/state.js';
import { SIMULATION_RANDOMNESS_ASSUMPTION_CONTROLS } from '../../../../app/simulation/randomness.js';
import { THIEF_CORE_ASSUMPTION_CONTROLS } from './assumptions.js';
import { THIEF_SKILL_IDS as ID } from '../data/ids.js';
import { spearChainStageForSkill } from './conditions.js';
import { thiefWeaponSkillMatchesSet } from './weapons.js';
import { storedStolenSkillChoices, THIEF_STOLEN_SKILL_IDS } from './steal.js';
import type { RotationStateSnapshotItem } from '../../../../platform/engine/types.js';
import type { ThiefSimulationEvent, ThiefSkill, ThiefState, ThiefUiContext } from '../types.js';

export function thiefUiState(context: ThiefUiContext = {}): Partial<ThiefState> {
  return flattenProfessionState(context.state?.profession || context.professionState) as unknown as Partial<ThiefState>;
}

export function thiefStealPaletteGroups(professionSkillId = ID.STEAL) {
  // Keep the base stolen-skill pool beside Steal so choices stay discoverable before and after they are granted.
  return [
    {
      id: 'thief-profession',
      label: 'F',
      skillIds: [professionSkillId],
      color: '#9a535c',
      resourceAnchor: true,
      stackId: 'thief-stolen-skills',
      className: 'thief-steal-skill'
    },
    {
      id: 'thief-stolen-skills',
      label: 'Stolen',
      skillIds: [...THIEF_STOLEN_SKILL_IDS],
      color: '#9a535c',
      stackId: 'thief-stolen-skills',
      className: 'thief-stolen-skill-choices'
    }
  ];
}

function corePaletteSkillAvailability(
  context: ThiefUiContext = {},
  skill: ThiefSkill
): { available: boolean; message: string } {
  const state = thiefUiState(context);
  const stealthed =
    Number(state.stealthUntil || 0) > Number(context.time || 0) &&
    Number(state.revealedUntil || 0) <= Number(context.time || 0);
  const bonusStealthAttack =
    Number(state.stealthAttackCharges || 0) > 0 &&
    Number(state.stealthAttackExpiresAt || 0) > Number(context.time || 0);
  const spearChainStage = spearChainStageForSkill(skill.id);
  const flipValue = state.availableFlips?.[String(skill.id)];
  const flipAvailable = flipValue === Number.POSITIVE_INFINITY || Number(flipValue || 0) > Number(context.time || 0);
  if (
    skill.slot === 'Profession_2' &&
    (THIEF_STOLEN_SKILL_IDS.includes(skill.id) || (skill.categories || []).includes('stolen skill')) &&
    !storedStolenSkillChoices(state as ThiefState).includes(skill.id)
  ) {
    // Stolen-skill palettes remain visible for selection, but only the currently granted choices are actionable.
    return {
      available: false,
      message: 'Steal this skill before using it'
    };
  }

  if (spearChainStage != null && Number(state.spearChainStage || 0) !== spearChainStage) {
    return {
      available: false,
      message: `Advance the spear chain to stage ${spearChainStage + 1}`
    };
  }

  if (skill.type === 'Weapon' && skill.flipParentId != null && !flipAvailable) {
    return {
      available: false,
      message: 'Use its opening weapon skill first'
    };
  }

  if (
    skill.type === 'Weapon' &&
    skill.flipSkillId != null &&
    skill.flipSkillId !== skill.nextChainId &&
    Number(state.availableFlips?.[String(skill.flipSkillId)] || 0) > Number(context.time || 0)
  ) {
    return {
      available: false,
      message: 'Use or wait out the active follow-up skill'
    };
  }

  if (skill.stealthAttack) {
    const available = stealthed || bonusStealthAttack;
    return {
      available,
      message: available ? '' : 'Gain stealth first'
    };
  }

  if ((stealthed || bonusStealthAttack) && skill.type === 'Weapon' && skill.slot === 'Weapon_1') {
    return {
      available: false,
      message: "The active weapon's stealth attack replaces skill 1"
    };
  }

  return { available: true, message: '' };
}

function thiefCoreEventLogRow(_context: ThiefUiContext, event: ThiefSimulationEvent) {
  if (event?.type !== 'thief.state') return undefined;
  const state = event.state || {};
  return {
    type: event.type,
    description: [event.reason || 'State', `Initiative ${Number(state.initiative || 0).toFixed(1)}`].join(' · '),
    className: 'resource',
    order: 30,
    flags: []
  };
}

/** Shows the mutually exclusive Stealth and Revealed gates that control stealth attacks. */
function thiefCoreStateSnapshot(context: ThiefUiContext): RotationStateSnapshotItem[] {
  const state = thiefUiState(context);
  const at = Math.max(0, Number(context.atSeconds || 0));
  const revealedRemaining = Number(state.revealedUntil || 0) - at;
  if (revealedRemaining > 0) {
    return [
      {
        id: 'thief-revealed',
        label: 'Revealed',
        value: `${revealedRemaining.toFixed(1)}s`,
        title: 'Time remaining before Stealth can be gained again'
      }
    ];
  }

  const stealthRemaining = Number(state.stealthUntil || 0) - at;
  return stealthRemaining > 0
    ? [
        {
          id: 'thief-stealth',
          label: 'Stealth',
          value: `${stealthRemaining.toFixed(1)}s`,
          title: 'Time remaining in Stealth'
        }
      ]
    : [];
}

export const thiefCoreUi = Object.freeze({
  assumptionControls: Object.freeze([...THIEF_CORE_ASSUMPTION_CONTROLS, ...SIMULATION_RANDOMNESS_ASSUMPTION_CONTROLS]),
  rotationStateSnapshot: thiefCoreStateSnapshot,
  weaponSkillMatchesSet: thiefWeaponSkillMatchesSet,
  paletteGroups: (context: ThiefUiContext) =>
    (context.specialization || context.config?.specialization || 'Core') === 'Core' ? thiefStealPaletteGroups() : [],
  skillBarGroups: (context: ThiefUiContext) =>
    (context.specialization || context.config?.specialization || 'Core') === 'Core'
      ? [
          {
            id: 'thief-stolen-skills',
            label: 'Stolen Skills',
            skillIds: [...THIEF_STOLEN_SKILL_IDS],
            color: '#9a535c'
          }
        ]
      : [],
  resourceViews: (context: ThiefUiContext) => {
    const state = thiefUiState(context);
    const enduranceCapacity = Math.max(
      Number(state.maximumEndurance || 100),
      100 + Number(state.enduranceCapacityBonus || 0)
    );
    const endurance =
      Number(state.maximumEndurance || 100) < enduranceCapacity &&
      Number(state.endurance ?? 100) === Number(state.maximumEndurance || 100)
        ? enduranceCapacity
        : Number(state.endurance ?? enduranceCapacity);
    return [
      {
        id: 'initiative',
        singular: 'initiative',
        plural: 'initiative',
        maximum: Number(state.maximumInitiative || 12),
        value: Number(state.initiative ?? context.initialInitiative ?? 12),
        startMaximum: 15,
        startValue: Number(context.initialInitiative ?? 12),
        canStart: true,
        buildKey: 'initialInitiative',
        step: 1,
        displayMode: 'pips',
        pipStyle: 'thief-initiative',
        pipRows: Number(state.initiativePipRows || 2),
        shortLabel: 'Init',
        statusLabel: 'Current'
      },
      {
        id: 'endurance',
        singular: 'endurance',
        plural: 'endurance',
        // Specializations publish capacity bonuses; Core renders the shared meter without naming their owner.
        maximum: enduranceCapacity,
        value: endurance,
        canStart: false,
        step: 1,
        displayMode: 'bar',
        pipStyle: 'endurance',
        shortLabel: 'End',
        statusLabel: 'Current',
        // Render the endurance meter beneath the Dodge button rather than as a
        // standalone bar, so the resource sits with the action that spends it.
        paletteSkillId: ID.DODGE
      }
    ];
  },
  paletteSkillAvailability: corePaletteSkillAvailability,
  eventLogRow: thiefCoreEventLogRow
});
