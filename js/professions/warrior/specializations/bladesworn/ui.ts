import { WARRIOR_SKILL_IDS as ID } from '../../data/ids.js';
import {
  formatSecondsRemaining,
  warriorPaletteGroups,
  warriorSkillBarGroups,
  warriorSnapshotAt,
  warriorUiState
} from '../../core/ui.js';
import type {
  PaletteSkillAvailability,
  ProfessionResourceView,
  ProfessionUiContract,
  RotationStateSnapshotItem
} from '../../../../platform/engine/types.js';
import type { WarriorSkill, WarriorUiContext } from '../../types.js';
import { dragonChargeReleaseProjection } from './charge-release.js';

const PROFESSION_SKILLS = Object.freeze([ID.UNSHEATHE_GUNSABER, ID.SHEATHE_GUNSABER, ID.DRAGON_TRIGGER]);
const DRAGON_SLASH_SKILLS = Object.freeze([ID.DRAGON_SLASH_FORCE, ID.DRAGON_SLASH_BOOST, ID.DRAGON_SLASH_REACH]);
const DRAGON_TRIGGER_SKILLS = Object.freeze([ID.TRIGGERGUARD, ID.FLICKER_STEP]);
const GUNSABER_SKILLS = Object.freeze([
  ID.SWIFT_CUT,
  ID.STEEL_DIVIDE,
  ID.EXPLOSIVE_THRUST,
  ID.BLOOMING_FIRE,
  ID.ARTILLERY_SLASH,
  ID.CYCLONE_TRIGGER,
  ID.BREAK_STEP
]);
const PALETTE_STACK_ID = 'bladesworn-profession';
const NO_WEAPON_BURSTS: Readonly<Record<string, number>> = Object.freeze({});

function resources(context: WarriorUiContext): ProfessionResourceView[] {
  const state = warriorUiState(context);
  return [
    {
      id: 'flow',
      singular: 'flow',
      plural: 'flow',
      maximum: 100,
      value: Number(state.flow ?? context.initialResource ?? 0),
      startMaximum: 100,
      startValue: Number(context.initialResource ?? 0),
      canStart: true,
      buildKey: 'initialResource',
      step: 1,
      displayMode: 'bar',
      shortLabel: 'Flow',
      statusLabel: 'Current'
    }
  ];
}

/** Presents gunsaber and Dragon Trigger gates owned by the Bladesworn slice. */
function availability(context: WarriorUiContext, skill: WarriorSkill): PaletteSkillAvailability {
  const state = warriorUiState(context);
  // Keep the stow action usable while authoring; the scheduler validates live state.
  if (skill.id === ID.SHEATHE_GUNSABER) return { available: true, message: '' };
  if (skill.gunsaberSkill) {
    if ((skill.dragonSlash || skill.dragonTriggerSkill) && !state.dragonTriggerActive) {
      return { available: false, message: 'Enter Dragon Trigger first' };
    }

    if (!skill.dragonSlash && !skill.dragonTriggerSkill && !state.gunsaberActive) {
      return { available: false, message: 'Unsheathe the gunsaber first' };
    }

    if (state.dragonTriggerActive && !skill.dragonSlash && !skill.dragonTriggerSkill) {
      return { available: false, message: 'Finish Dragon Trigger first' };
    }
  }

  if ((state.gunsaberActive || state.dragonTriggerActive) && skill.type === 'Weapon' && Boolean(skill.weapon)) {
    return { available: false, message: 'Sheathe the gunsaber first' };
  }

  if (skill.id === ID.UNSHEATHE_GUNSABER && state.gunsaberActive) {
    return { available: false, message: 'Gunsaber is already active' };
  }

  return { available: true, message: '' };
}

export const bladeswornUi: Partial<ProfessionUiContract> = Object.freeze({
  chargeReleaseProjection: dragonChargeReleaseProjection,
  paletteGroups: (context: WarriorUiContext) => [
    ...warriorPaletteGroups(context, PROFESSION_SKILLS, NO_WEAPON_BURSTS).map((group) =>
      group.id === 'profession'
        ? {
            ...group,
            className: 'bladesworn-f-skills',
            stackId: PALETTE_STACK_ID
          }
        : group
    ),
    {
      id: 'dragon-slash',
      label: 'Dgn',
      skillIds: DRAGON_SLASH_SKILLS,
      color: '#d56f55',
      className: 'bladesworn-dragon-slash',
      stackId: PALETTE_STACK_ID
    },
    {
      id: 'dragon-trigger',
      label: 'Dgn+',
      skillIds: DRAGON_TRIGGER_SKILLS,
      color: '#ba5f5f',
      className: 'bladesworn-dragon-trigger',
      stackId: PALETTE_STACK_ID
    },
    {
      id: 'gunsaber',
      label: 'Gun',
      skillIds: GUNSABER_SKILLS,
      color: '#c97645',
      className: 'bladesworn-gunsaber',
      placement: 'weapon-set-1' as const
    }
  ],
  skillBarGroups: (context: WarriorUiContext) => [
    ...warriorSkillBarGroups(context, PROFESSION_SKILLS, NO_WEAPON_BURSTS),
    {
      id: 'warrior-dragon-slash',
      label: 'Dragon Slash',
      skillIds: DRAGON_SLASH_SKILLS,
      color: '#d56f55'
    },
    {
      id: 'warrior-dragon-trigger',
      label: 'Dragon Trigger',
      skillIds: DRAGON_TRIGGER_SKILLS,
      color: '#ba5f5f'
    },
    {
      id: 'warrior-gunsaber',
      label: 'Gunsaber',
      skillIds: GUNSABER_SKILLS,
      color: '#c97645',
      placement: 'weapon-bar' as const
    }
  ],
  timelineWeaponLineTransition: (context: WarriorUiContext) => {
    const skillId = Number((context.skill as { readonly id?: number } | undefined)?.id);
    if ((skillId === ID.UNSHEATHE_GUNSABER || skillId === ID.DRAGON_TRIGGER) && context.weaponLine !== 'Gunsaber') {
      return 'Gunsaber';
    }

    if (skillId === ID.SHEATHE_GUNSABER && context.weaponLine === 'Gunsaber') {
      return null;
    }

    return undefined;
  },
  resourceViews: resources,
  paletteSkillAvailability: availability,
  rotationStateSnapshot: (context: WarriorUiContext) => {
    const state = warriorUiState(context);
    const at = warriorSnapshotAt(context);
    const items: RotationStateSnapshotItem[] = [];
    const window = (state.overchargedCartridgeWindows || []).find(
      (candidate) => Number(candidate.startedAt) <= at && Number(candidate.expiresAt) > at
    );
    if (window) {
      const name = window.supercharged ? 'Supercharged Cartridges' : 'Overcharged Cartridges';
      items.push({
        id: window.supercharged ? 'supercharged-cartridges' : 'overcharged-cartridges',
        label: name,
        value: formatSecondsRemaining(Number(window.expiresAt) - at),
        title: `${name} active (+${Math.round(Number(window.damageBonus || 0) * 100)}% damage)`
      });
    }

    const positiveFlowSources = (state.flowStabilizerWindows || [])
      .filter((candidate) => Number(candidate.startedAt) <= at && Number(candidate.expiresAt) > at)
      .map((candidate) => ({
        stacks: 2,
        expiresAt: Number(candidate.expiresAt)
      }));
    if (Number(state.traitPositiveFlowStartedAt || 0) <= at && Number(state.traitPositiveFlowUntil || 0) > at) {
      positiveFlowSources.push({
        stacks: 1,
        expiresAt: Number(state.traitPositiveFlowUntil)
      });
    }

    if (positiveFlowSources.length) {
      const stacks = positiveFlowSources.reduce((total, source) => total + source.stacks, 0);
      const remaining = Math.min(...positiveFlowSources.map((source) => source.expiresAt)) - at;
      const stackLabel = `${stacks} ${stacks === 1 ? 'stack' : 'stacks'}`;
      items.push({
        id: 'positive-flow',
        label: 'Positive Flow',
        value: `${stackLabel} · ${formatSecondsRemaining(remaining)}`,
        title: `Positive Flow active (${stackLabel}; time until the next stack expires)`
      });
    }

    return items;
  }
});
