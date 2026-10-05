import { isCombatEntryEvent } from '#gw2/platform/combat/state/targets.js';
import { balanceProfileNumber, requireBalanceProfileFromContext } from '#gw2/platform/skills/balance-profiles.js';
import type { Skill } from '#gw2/platform/skills/types.js';
import type { ProfessionAttributePreviewContext } from '#gw2/platform/profession-presentation/attribute-preview.js';
import type { ProfessionBalanceContext } from '#gw2/platform/profession-presentation/balance-context.js';
import type {
  SkillDamagePreviewContext,
  SkillDamageState
} from '#gw2/platform/profession-presentation/skill-damage.js';
import type { ProfessionResourceView, RotationStateSnapshotItem } from '#gw2/platform/profession-presentation/types.js';
import { planningBuffAt, planningBuffStacks } from '#gw2/platform/results/query.js';
import { createPreviewControls } from '#gw2/professions/shared/attribute-preview.js';
import {
  formatSecondsRemaining,
  warriorPaletteGroups,
  warriorSnapshotAt,
  warriorUiState
} from '#gw2/professions/warrior/core/presentation.js';
import { WARRIOR_SKILL_IDS as ID, WARRIOR_TRAIT_IDS as TRAIT } from '#gw2/professions/warrior/data/ids.js';
import { dragonChargeReleaseProjection } from '#gw2/professions/warrior/specializations/bladesworn/mechanics/charge-release.js';
import { BLADESWORN_BALANCE_PROFILE_IDS as PROFILE } from '#gw2/professions/warrior/specializations/bladesworn/profiles.js';
import { maximumDragonCharges } from '#gw2/professions/warrior/specializations/bladesworn/traits/behavior.js';
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
const GUNSABER_CHAIN = Object.freeze([ID.SWIFT_CUT, ID.STEEL_DIVIDE, ID.EXPLOSIVE_THRUST]);
const PALETTE_STACK_ID = 'bladesworn-profession';
const NO_WEAPON_BURSTS: Readonly<Record<string, number>> = Object.freeze({});

function resources(context: WarriorUiContext): ProfessionResourceView[] {
  const state = warriorUiState(context);
  // The live pool wins; authoring before simulation uses the selected Flow profile.
  const maximum =
    state.flow?.maximum ??
    balanceProfileNumber(requireBalanceProfileFromContext(context, PROFILE.resources), 'maximumStacks');
  return [
    {
      id: 'flow',
      singular: 'flow',
      plural: 'flow',
      maximum,
      value: Number(state.flow?.value ?? context.initialResource ?? 0),
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

/**
 * Gunsaber skills are cast from the drawn Gunsaber, and chain steps after their predecessors. Dragon Trigger skills
 * start inside the stance with a full Flow pool; Dragon Slashes are measured at every reachable charge count.
 */
function bladeswornSkillDamageOccurrence(context: SkillDamagePreviewContext, skill: Skill): SkillDamageState | null {
  const id = Number(skill.id);
  const includes = (ids: readonly number[]): boolean => ids.includes(id);
  const chainIndex = (GUNSABER_CHAIN as readonly number[]).indexOf(id);
  if (chainIndex >= 0)
    return {
      context: `Gunsaber 1 · chain ${chainIndex + 1} of ${GUNSABER_CHAIN.length}`
    };
  if (includes(GUNSABER_SKILLS)) return {};

  const isDragonSlash = includes(DRAGON_SLASH_SKILLS);
  if (!isDragonSlash && !includes(DRAGON_TRIGGER_SKILLS) && id !== ID.DRAGON_TRIGGER) return null;
  // Entering the stance spends Flow, so every Dragon Trigger probe starts from the selected Flow maximum.
  const flow = balanceProfileNumber(requireBalanceProfileFromContext(context, PROFILE.resources), 'maximumStacks');
  if (id === ID.DRAGON_TRIGGER) return { initialResource: flow };
  if (!isDragonSlash) return { initialResource: flow };
  const charges = maximumDragonCharges({
    catalog: context.catalog,
    traits: new Set(context.activeTraits.map((trait) => trait.id))
  } as Parameters<typeof maximumDragonCharges>[0]);
  return {
    initialResource: flow,
    variants: Array.from({ length: charges }, (_, index) => ({
      id: String(index + 1),
      label: `${index + 1} ${index ? 'charges' : 'charge'}`,
      cast: { releaseAtCharges: index + 1 }
    })),
    primaryVariantId: String(charges),
    context: `Dragon Trigger · ${charges} charges`
  };
}

export const bladeswornUi: WarriorUiSlice = Object.freeze({
  // Fierce as Fire changes outgoing damage only; Guns and Glory's Ferocity also shows in the Attribute Preview.
  previewControls(context: ProfessionAttributePreviewContext) {
    const preview = createPreviewControls(context);
    if (preview.has('Fierce as Fire'))
      preview.add({
        key: 'fierceAsFire',
        label: 'Fierce as Fire',
        group: 'Trait conditionals',
        kind: 'buff',
        field: 'fierce-as-fire',
        max: preview.maximumStacks('Fierce as Fire'),
        scope: ['damage'],
        description: 'stacks; strike and condition damage'
      });
    preview.buff('Guns and Glory', 'gunsAndGlory', 'guns-and-glory', 'Explosion hit recently; Ferocity');
    return preview.controls;
  },
  skillDamageGroups: () => [
    { id: 'gunsaber', title: 'Gunsaber', skillIds: GUNSABER_SKILLS, order: 0 },
    {
      id: 'dragon-trigger',
      title: 'Dragon Trigger',
      skillIds: [...DRAGON_SLASH_SKILLS, ...DRAGON_TRIGGER_SKILLS],
      order: 1
    }
  ],
  skillDamageState: bladeswornSkillDamageOccurrence,
  // Reports share combat's trait caps; Glory events already contain the complete refreshed window.
  effectPresentations: () => [
    {
      id: 'bladesworn-fierce-as-fire',
      kind: 'fierce-as-fire',
      name: 'Fierce as Fire'
    },
    {
      id: 'bladesworn-guns-and-glory',
      kind: 'guns-and-glory',
      name: 'Guns and Glory'
    }
  ],
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
    const fierceAsFire = planningBuffStacks(context.planningState, 'fierce-as-fire');
    if (fierceAsFire > 0) {
      items.push({
        id: 'bladesworn-fierce-as-fire',
        label: 'Fierce as Fire',
        value: `${fierceAsFire}/${maximum}`,
        title: 'Active Fierce as Fire stacks'
      });
    }

    const gunsAndGlory = planningBuffAt(context.planningState, 'guns-and-glory');
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
