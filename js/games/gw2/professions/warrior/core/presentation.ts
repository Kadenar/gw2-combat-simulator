import type { ProfessionAttributePreviewContext } from '#gw2/platform/profession-presentation/attribute-preview.js';
import { createAttributePreviewControls } from '#gw2/professions/shared/attribute-preview.js';

import type { PaletteOverride } from '#gw2/platform/profession-presentation/types.js';
import { PERMANENT_COMBO_FIELD_ASSUMPTION_CONTROLS } from '#gw2/platform/combos/permanent-field-assumption.js';
import { flattenProfessionState } from '#gw2/platform/engine/profession/state.js';
import {
  balanceProfileNumber,
  requireBalanceProfileFromContext
} from '#gw2/platform/engine/skills/balance-profiles.js';
import { gw2PrimaryWeapon } from '#gw2/platform/equipment/weapons/loadout.js';
import type { ProfessionBalanceContext } from '#gw2/platform/profession-presentation/balance-context.js';
import type {
  ProfessionEffectPresentation,
  ProfessionPaletteGroup,
  ProfessionResourceView,
  RotationStateSnapshotItem
} from '#gw2/platform/profession-presentation/types.js';
import { timedBuffAt, timedBuffStacksAt } from '#gw2/platform/results/query.js';
import { SIMULATION_RANDOMNESS_ASSUMPTION_CONTROLS } from '#gw2/platform/simulation/randomness.js';
import { SHARED_SKILL_IDS } from '#gw2/platform/skills/shared-actions.js';
import { WARRIOR_SKILL_IDS as ID, WARRIOR_TRAIT_IDS as TRAIT } from '#gw2/professions/warrior/data/ids.js';
import { getActiveTraits } from '#gw2/professions/warrior/data/traits-data.js';
import type { WarriorSkill, WarriorState, WarriorUiContext, WarriorUiSlice } from '#gw2/professions/warrior/types.js';

const WARRIOR_REGULAR_BURSTS_BY_WEAPON: Readonly<Record<string, number>> = Object.freeze({
  Axe: ID.EVISCERATE,
  Dagger: ID.BREACHING_STRIKE,
  Greatsword: ID.ARCING_SLICE,
  Hammer: ID.EARTHSHAKER,
  Longbow: ID.COMBUSTIVE_SHOT,
  Mace: ID.SKULL_CRACK,
  Rifle: ID.KILL_SHOT,
  Spear: ID.HARRIERS_TOSS,
  Staff: ID.PATH_TO_VICTORY_ID_71932,
  Sword: ID.BLOODTHIRSTER
});

export function warriorUiState(context: WarriorUiContext = {}): Partial<WarriorState> {
  return flattenProfessionState(context.state?.profession || context.professionState);
}

/** Simulation time (seconds) of the rotation point being inspected. */
export function warriorSnapshotAt(context: WarriorUiContext = {}): number {
  return Math.max(0, context.atSeconds || 0);
}

/** Formats a remaining duration for the active-state bar (e.g. `4.2s`). */
export function formatSecondsRemaining(seconds: number): string {
  return `${Math.max(0, seconds).toFixed(1)}s`;
}

// Resolve a valid primary weapon for either UI set from build and projected
// runtime state, falling back safely when a saved selection is empty.
function selectedPrimaryWeapon(context: WarriorUiContext, weaponSet: 1 | 2): string {
  if (context.build) {
    return weaponSet === 1 ? context.build.weapons?.[0] || '' : context.build.alternateWeapons?.[0] || '';
  }

  return gw2PrimaryWeapon(context.config, weaponSet) || '';
}

function weaponSetBurstSkillId(
  context: WarriorUiContext,
  weaponSet: 1 | 2,
  burstsByWeapon: Readonly<Record<string, number>>
): number | undefined {
  return burstsByWeapon[selectedPrimaryWeapon(context, weaponSet)];
}

function warriorProfessionSkillIds(
  context: WarriorUiContext,
  professionSkillIds: readonly number[],
  burstsByWeapon: Readonly<Record<string, number>>
): number[] {
  const weaponBursts = ([1, 2] as const)
    .map((weaponSet) => weaponSetBurstSkillId(context, weaponSet, burstsByWeapon))
    .filter((skillId): skillId is number => Number.isFinite(skillId));
  return [...new Set([...weaponBursts, ...professionSkillIds])];
}

export function warriorPaletteGroups(
  context: WarriorUiContext,
  professionSkillIds: readonly number[] = [],
  burstsByWeapon: Readonly<Record<string, number>> = WARRIOR_REGULAR_BURSTS_BY_WEAPON
): ProfessionPaletteGroup[] {
  const skillIds = warriorProfessionSkillIds(context, professionSkillIds, burstsByWeapon);
  return [
    {
      id: 'profession',
      label: 'F',
      skillIds,
      color: '#d79b55',
      // Keep the shared adrenaline meter above the burst skills across Warrior specializations.
      className: 'compact-resource-palette warrior-f-skills',
      resourceAnchor: true
    },
    {
      id: 'warrior-actions',
      label: 'Act',
      skillIds: [SHARED_SKILL_IDS.DODGE, SHARED_SKILL_IDS.SWAP_WEAPONS],
      color: '#e0ad70'
    }
  ];
}

/** Presents projected adrenaline with the slice's starting cap until a runtime cap is available. */
export function warriorAdrenalineResourceViews(
  context: WarriorUiContext,
  startingMaximum = 30
): ProfessionResourceView[] {
  const state = warriorUiState(context);
  const maximum = state.maximumAdrenaline ?? startingMaximum;
  return [
    {
      id: 'adrenaline',
      singular: 'adrenaline',
      plural: 'adrenaline',
      maximum,
      value: Number(state.adrenaline ?? context.initialResource ?? 0),
      startMaximum: maximum,
      canStart: true,
      buildKey: 'initialResource',
      step: 1,
      displayMode: 'bar',
      barSegments: Math.max(1, maximum / 10),
      pipStyle: 'compact-profession-resource-warrior-adrenaline',
      shortLabel: 'Adr',
      statusLabel: 'Current'
    }
  ];
}

/** True when the build has the Arms trait Signet Mastery selected. */
function hasSignetMasteryTrait(context: WarriorUiContext): boolean {
  return getActiveTraits(context.build?.specializations || []).some(
    (trait) => Number(trait.id) === TRAIT.SIGNET_MASTERY
  );
}

/**
 * Core Warrior buffs active at the inspection point. Read from the same buff
 * timeline as their modifiers so the bar never drifts from the simulation.
 */
function warriorCoreStateSnapshot(
  context: WarriorUiContext & { readonly balanceContext: ProfessionBalanceContext }
): RotationStateSnapshotItem[] {
  const result = context.result;
  const at = warriorSnapshotAt(context);
  const items: RotationStateSnapshotItem[] = [];
  const balance = context.balanceContext;
  const peakPerformance = timedBuffAt(result, 'peak-performance', at);
  if (peakPerformance) {
    // Show the active window here; the trait tooltip owns damage bonus details.
    items.push({
      id: 'peak-performance',
      label: 'Peak Performance',
      value: formatSecondsRemaining(peakPerformance.remaining),
      title: 'Peak Performance active'
    });
  }

  if (hasSignetMasteryTrait(context)) {
    const profile = requireBalanceProfileFromContext(balance, TRAIT.SIGNET_MASTERY);
    const maximum = balanceProfileNumber(profile, 'maximumStacks');
    const bonus = balanceProfileNumber(profile, 'attributeBonus');
    const stacks = Math.min(maximum, timedBuffStacksAt(result, 'signet-mastery', at));
    if (stacks > 0) {
      items.push({
        id: 'signet-mastery',
        label: 'Signet Mastery',
        value: `${stacks}/${maximum}`,
        title: `Signet Mastery: +${stacks * bonus} ferocity (+${bonus} per stack)`
      });
    }
  }

  // These independent stacking trait buffs are useful across every Warrior
  // specialization, regardless of whether Signet Mastery is selected.
  for (const [id, label, kind, maximum] of [
    [
      'furious-surge',
      'Furious Surge',
      'furious-surge',
      balanceProfileNumber(requireBalanceProfileFromContext(balance, TRAIT.FURIOUS), 'maximumStacks')
    ],
    [
      'berserkers-power',
      "Berserker's Power",
      'berserkers-power',
      balanceProfileNumber(requireBalanceProfileFromContext(balance, TRAIT.BERSERKERS_POWER), 'maximumStacks')
    ]
  ] as const) {
    const stacks = Math.min(maximum, timedBuffStacksAt(result, kind, at));
    if (stacks > 0) items.push({ id, label, value: `${stacks}/${maximum}`, title: `${label} active stacks` });
  }

  return items;
}

/** Stack displays read the same profile cap as the damage formula. */
function warriorCoreEffectPresentations(context: WarriorUiContext): ProfessionEffectPresentation[] {
  return [
    {
      id: 'warrior-berserkers-power',
      kind: 'berserkers-power',
      name: "Berserker's Power",
      maximumStacks: balanceProfileNumber(
        requireBalanceProfileFromContext(context, TRAIT.BERSERKERS_POWER),
        'maximumStacks'
      )
    }
  ];
}

export const warriorCoreUi: WarriorUiSlice = Object.freeze({
  /** Declare this module's conditional inputs without adding simulation settings. */
  attributePreviewControls(context: ProfessionAttributePreviewContext) {
    const preview = createAttributePreviewControls(context);

    preview.buff('Signet Mastery', 'signetMastery', 'signet-mastery', 'Ferocity', true);
    preview.buff('Furious', 'furious', 'furious-surge', 'Condition Damage', true);
    preview.buff('Burst Precision', 'burstPrecision', 'burst-precision', 'Critical Chance / Ferocity');
    if (preview.has('Unsuspecting Foe'))
      preview.add({
        key: 'defiant',
        label: 'Defiant target',
        group: 'Trait conditionals',
        kind: 'special',
        initial: 1,
        description: 'Defiant-target critical bonuses'
      });
    preview.condition('Bleeding', 'Deep Strikes');
    preview.passives('Signet of Might', 'Signet of Fury');
    return preview.controls;
  },

  // Burst tiles are authored for a specific weapon set; inactive-set insertion needs an explicit swap.
  paletteOverride: (context, skill) => {
    if ((context.specialization || 'Core') === 'Core') return warriorBurstPaletteOverride(context, skill);
  },
  assumptionControls: [...SIMULATION_RANDOMNESS_ASSUMPTION_CONTROLS, ...PERMANENT_COMBO_FIELD_ASSUMPTION_CONTROLS],
  effectPresentations: warriorCoreEffectPresentations,
  rotationStateSnapshot: warriorCoreStateSnapshot,
  paletteGroups: (context) => (warriorUiSpecialization(context) === 'Core' ? warriorPaletteGroups(context) : []),
  resourceViews: (context) =>
    warriorUiSpecialization(context) === 'Core' ? warriorAdrenalineResourceViews(context) : [],
  targetHealthThresholds: () => [0.8, 0.5, 0.25]
});

/** Restricts a weapon burst to the weapon set that supplied it. */
export function warriorBurstPaletteOverride(
  context: WarriorUiContext,
  skill: WarriorSkill,
  burstsByWeapon: Readonly<Record<string, number>> = WARRIOR_REGULAR_BURSTS_BY_WEAPON
): PaletteOverride {
  const activeWeaponSet = Number(context.activeWeaponSet) === 2 ? 2 : 1;
  const activeBurstSkillId = weaponSetBurstSkillId(context, activeWeaponSet, burstsByWeapon);
  const weaponSetBurstIds = ([1, 2] as const).map((weaponSet) =>
    weaponSetBurstSkillId(context, weaponSet, burstsByWeapon)
  );
  if (weaponSetBurstIds.includes(Number(skill.id)) && activeBurstSkillId !== Number(skill.id)) {
    const requiredWeaponSet = weaponSetBurstIds.indexOf(Number(skill.id)) + 1;
    return {
      available: false,
      message: `Switch to weapon set ${requiredWeaponSet}`
    };
  }

  return {};
}

function warriorUiSpecialization(context: WarriorUiContext = {}): string {
  return context.specialization || context.config?.specialization || 'Core';
}
