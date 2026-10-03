import { isCombatEntryEvent } from '#gw2/platform/combat/state/targets.js';
import {
  balanceProfileNumber,
  requireBalanceProfileFromContext
} from '#gw2/platform/engine/skills/balance-profiles.js';
import type { ProfessionBalanceContext } from '#gw2/platform/profession-presentation/balance-context.js';
import type { ProfessionResourceView, RotationStateSnapshotItem } from '#gw2/platform/profession-presentation/types.js';
import { timedBuffAt, timedBuffStacksAt } from '#gw2/platform/results/query.js';
import {
  formatSecondsRemaining,
  warriorPaletteGroups,
  warriorSnapshotAt,
  warriorUiState
} from '#gw2/professions/warrior/core/presentation.js';
import { WARRIOR_SKILL_IDS as ID, WARRIOR_TRAIT_IDS as TRAIT } from '#gw2/professions/warrior/data/ids.js';
import { dragonChargeReleaseProjection } from '#gw2/professions/warrior/specializations/bladesworn/mechanics/charge-release.js';
import { BLADESWORN_BALANCE_PROFILE_IDS as PROFILE } from '#gw2/professions/warrior/specializations/bladesworn/profiles.js';
import type { WarriorUiContext, WarriorUiSlice } from '#gw2/professions/warrior/types.js';

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
  // The live pool wins; authoring before simulation uses the selected Flow profile.
  const maximum =
    state.maximumFlow ??
    balanceProfileNumber(requireBalanceProfileFromContext(context, PROFILE.resources), 'maximumStacks');
  return [
    {
      id: 'flow',
      singular: 'flow',
      plural: 'flow',
      maximum,
      value: Number(state.flow ?? context.initialResource ?? 0),
      startMaximum: maximum,
      canStart: true,
      buildKey: 'initialResource',
      step: 1,
      displayMode: 'bar',
      // Flow uses the compact Warrior bar styling beside the F skills.
      pipStyle: 'compact-profession-resource-warrior-flow',
      shortLabel: 'Flow',
      statusLabel: 'Current'
    }
  ];
}

export const bladeswornUi: WarriorUiSlice = Object.freeze({
  // Tile identity follows the active bar even when the visible skill cannot currently be cast.
  paletteOverride: (context, skill) => {
    const state = warriorUiState(context);
    // Stow remains insertable while authoring; runtime validation still owns the actual cast.
    if (skill.id === ID.SHEATHE_GUNSABER) return { tileActive: Boolean(state.gunsaberActive), available: true };
    if (skill.id === ID.UNSHEATHE_GUNSABER) return { tileActive: !state.gunsaberActive };
    // The release editor validates configured charges through its existing prefix previews.
    if (skill.dragonSlash) return { editorAccess: Boolean(state.dragonTriggerActive) };
  },
  chargeReleaseProjection: dragonChargeReleaseProjection,
  // Describe recorded charge outcomes without recalculating Flow gain or the charging cadence.
  timelineAnnotation: ({ skill, entry, spend, formattedTime }) => {
    if (!skill?.dragonSlash || entry?.type !== 'cast') return null;
    const outcome = spend?.resource === 'dragon charges' ? spend : undefined;
    const requested = entry.releaseAtCharges ?? outcome?.maximumCharges;
    const actual = outcome?.chargesReached ?? outcome?.count;
    return {
      editLabel: 'charge release',
      releaseBadge: {
        label: `⚡${entry.releaseAtCharges ?? 'Max'}${formattedTime ? `\n${formattedTime}` : ''}`,
        title: `Release at ${entry.releaseAtCharges == null ? 'maximum' : entry.releaseAtCharges} charges; cast at ${formattedTime}`
      },
      outcomeMismatch:
        Boolean(outcome) && Number.isFinite(requested) && Number.isFinite(actual) && requested !== actual,
      resourceLabel: outcome
        ? `${outcome.count} ${outcome.count === 1 ? 'dragon charge' : 'dragon charges'} consumed at cast start`
        : '',
      details: outcome
        ? [
            `Charges reached: ${actual}`,
            `${(entry.releaseDelayMs ?? 0) > 0 ? 'Time in Dragon Trigger' : 'Time spent charging'}: ${(outcome.chargingSeconds || 0).toFixed(3)}s`,
            ...((entry.releaseDelayMs ?? 0) > 0
              ? [`Additional release delay: ${entry.releaseDelayMs} ms (no charging Flow)`]
              : []),
            `Flow spent: ${(outcome.flowSpent || 0).toFixed(2)}`
          ]
        : []
    };
  },
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
  rotationStateSnapshot: (context: WarriorUiContext & { readonly balanceContext: ProfessionBalanceContext }) => {
    const state = warriorUiState(context);
    const at = warriorSnapshotAt(context);
    const items: RotationStateSnapshotItem[] = [];
    const result = context.result;
    // Bladesworn's trait buffs live on the resolved buff timeline, which keeps
    // this snapshot aligned with the damage and ferocity modifier gates.
    const maximum = balanceProfileNumber(
      requireBalanceProfileFromContext(context.balanceContext, TRAIT.FIERCE_AS_FIRE),
      'maximumStacks'
    );
    const fierceAsFire = Math.min(maximum, timedBuffStacksAt(result, 'fierce-as-fire', at));
    if (fierceAsFire > 0) {
      items.push({
        id: 'bladesworn-fierce-as-fire',
        label: 'Fierce as Fire',
        value: `${fierceAsFire}/${maximum}`,
        title: 'Active Fierce as Fire stacks'
      });
    }

    const gunsAndGlory = timedBuffAt(result, 'guns-and-glory', at);
    if (gunsAndGlory) {
      items.push({
        id: 'bladesworn-guns-and-glory',
        label: 'Guns and Glory',
        value: formatSecondsRemaining(gunsAndGlory.remaining),
        title: 'Guns and Glory ferocity window remaining'
      });
    }

    const window = (state.overchargedCartridgeWindows || []).find(
      (candidate) => candidate.startedAt <= at && candidate.expiresAt > at
    );
    if (window) {
      const name = window.supercharged ? 'Supercharged Cartridges' : 'Overcharged Cartridges';
      items.push({
        id: window.supercharged ? 'supercharged-cartridges' : 'overcharged-cartridges',
        label: name,
        value: formatSecondsRemaining(window.expiresAt - at),
        title: `${name} active (+${Math.round((window.damageBonus || 0) * 100)}% damage)`
      });
    }

    const positiveFlowSources = (state.flowStabilizerWindows || [])
      .filter((candidate) => candidate.startedAt <= at && candidate.expiresAt > at)
      .map((candidate) => ({
        stacks: 2,
        expiresAt: candidate.expiresAt
      }));
    if ((state.traitPositiveFlowStartedAt || 0) <= at && (state.traitPositiveFlowUntil || 0) > at) {
      positiveFlowSources.push({
        stacks: Number(state.traitPositiveFlowStacks),
        expiresAt: Number(state.traitPositiveFlowUntil)
      });
    }

    // Keep Flow visible after temporary stacks expire; the base stack starts at the combat boundary.
    const baseStacks = result?.events.some(
      (event) =>
        event.at <= at &&
        (!result.hasExplicitCombatStart || event.at >= (result.combatStartTime ?? Infinity)) &&
        isCombatEntryEvent(event)
    )
      ? 1
      : 0;
    const stacks = positiveFlowSources.reduce((total, source) => total + source.stacks, baseStacks);
    const remaining = positiveFlowSources.length
      ? Math.min(...positiveFlowSources.map((source) => source.expiresAt)) - at
      : null;
    const stackLabel = `${stacks} ${stacks === 1 ? 'stack' : 'stacks'}`;
    items.push({
      id: 'positive-flow',
      label: 'Positive Flow',
      value: remaining == null ? stackLabel : `${stackLabel} · ${formatSecondsRemaining(remaining)}`,
      title: `Positive Flow (${stackLabel}${remaining == null ? '' : '; time until the next temporary stack expires'})`
    });

    return items;
  }
});
