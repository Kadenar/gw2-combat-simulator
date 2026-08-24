import { flattenProfessionState } from '../../../platform/engine/profession/state.js';
import { SIMULATION_RANDOMNESS_ASSUMPTION_CONTROLS } from '../../../app/simulation/randomness.js';
import { timedBuffAt, timedBuffStacksAt } from '../../../platform/gw2/result-state.js';
import { WARRIOR_SKILL_IDS as ID, WARRIOR_TRAIT_IDS as TRAIT } from '../data/ids.js';
import { getActiveTraits } from '../data/traits-data.js';
import type {
  CanonicalCatalog,
  PaletteSkillAvailability,
  ProfessionEventLogDescriptor,
  ProfessionPaletteGroup,
  ProfessionResourceView,
  ProfessionSkillBarGroup,
  ProfessionUiContract,
  RotationStateSnapshotItem
} from '../../../platform/engine/types.js';
import type { Gw2SimulationResult } from '../../../platform/gw2/types.js';
import type { WarriorSpecializationSelection } from '../data/traits-data.js';
import type { WarriorSimulationEvent, WarriorSkill, WarriorState, WarriorUiContext } from '../types.js';

/** Signet Mastery caps at 5 stacks, each granting +100 ferocity. */
const SIGNET_MASTERY_MAX_STACKS = 5;

export const WARRIOR_REGULAR_BURSTS_BY_WEAPON: Readonly<Record<string, number>> = Object.freeze({
  Axe: ID.EVISCERATE,
  Dagger: ID.BREACHING_STRIKE,
  Greatsword: ID.ARCING_SLICE,
  Hammer: ID.EARTHSHAKER,
  Longbow: ID.COMBUSTIVE_SHOT,
  Mace: ID.SKULL_CRACK,
  Rifle: ID.KILL_SHOT,
  Spear: ID.HARRIERS_TOSS,
  Staff: ID.PATH_TO_VICTORY,
  Sword: ID.BLOODTHIRSTER
});

export function warriorUiState(context: WarriorUiContext = {}): Partial<WarriorState> {
  return flattenProfessionState(context.state?.profession || context.professionState) as Partial<WarriorState>;
}

export function warriorUiSpecialization(context: WarriorUiContext = {}): string {
  return context.specialization || context.config?.specialization || 'Core';
}

/** Simulation time (seconds) of the rotation point being inspected. */
export function warriorSnapshotAt(context: WarriorUiContext = {}): number {
  return Math.max(0, Number(context.atSeconds || 0));
}

/** Formats a remaining duration for the active-state bar (e.g. `4.2s`). */
export function formatSecondsRemaining(seconds: number): string {
  return `${Math.max(0, seconds).toFixed(1)}s`;
}

function selectedPrimaryWeapon(context: WarriorUiContext, weaponSet: 1 | 2): string {
  if (context.build) {
    return String(weaponSet === 1 ? context.build.weapons?.[0] || '' : context.build.alternateWeapons?.[0] || '');
  }

  return String(weaponSet === 1 ? context.config?.primaryWeapon || '' : context.config?.weaponSet2Primary || '');
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
      resourceAnchor: true
    },
    {
      id: 'warrior-actions',
      label: 'Act',
      skillIds: [ID.DODGE, ID.SWAP_WEAPONS],
      color: '#e0ad70'
    }
  ];
}

export function warriorSkillBarGroups(
  context: WarriorUiContext,
  professionSkillIds: readonly number[] = [],
  burstsByWeapon: Readonly<Record<string, number>> = WARRIOR_REGULAR_BURSTS_BY_WEAPON
): ProfessionSkillBarGroup[] {
  return [
    {
      id: 'warrior-f-keys',
      label: 'F Keys',
      skillIds: warriorProfessionSkillIds(context, professionSkillIds, burstsByWeapon),
      color: '#d79b55',
      className: 'warrior-burst-f-keys',
      layout: 'warrior-burst'
    }
  ];
}

/** Presents the shared adrenaline state with the cap selected by the active slice. */
export function warriorAdrenalineResourceViews(context: WarriorUiContext): ProfessionResourceView[] {
  const state = warriorUiState(context);
  return [
    {
      id: 'adrenaline',
      singular: 'adrenaline',
      plural: 'adrenaline',
      maximum: Number(state.maximumAdrenaline || 30),
      value: Number(state.adrenaline ?? state.resource ?? context.initialResource ?? 0),
      startMaximum: Number(state.maximumAdrenaline || 30),
      startValue: Number(context.initialResource ?? 0),
      canStart: true,
      buildKey: 'initialResource',
      step: 1,
      displayMode: 'bar',
      barSegments: Math.max(1, Number(state.maximumAdrenaline || 30) / 10),
      pipStyle: 'warrior-adrenaline',
      shortLabel: 'Adr',
      statusLabel: 'Current'
    }
  ];
}

/** Restricts a weapon burst to the weapon set that supplied it. */
export function warriorBurstPaletteAvailability(
  context: WarriorUiContext,
  skill: WarriorSkill,
  burstsByWeapon: Readonly<Record<string, number>> = WARRIOR_REGULAR_BURSTS_BY_WEAPON
): PaletteSkillAvailability {
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

  return { available: true, message: '' };
}

/**
 * Presents boon-removal effects (e.g. Breaching Strike) in the event log for
 * every warrior specialization. Returning `undefined` for other custom events
 * lets a specialization slice present or suppress its own event types.
 */
function warriorEventLogRow(
  _context: WarriorUiContext,
  event: WarriorSimulationEvent
): ProfessionEventLogDescriptor | null | undefined {
  if (event?.type !== 'warrior.boon-removal') return undefined;
  const attempted = Math.max(1, Math.trunc(Number(event.attemptedBoonRemovals) || 1));
  const removed = event.boonsRemoved == null ? null : Math.max(0, Number(event.boonsRemoved));
  const source = event.skillName || event.name || 'Boon removal';
  const detail = removed == null ? `x${attempted}` : `${removed}/${attempted}`;
  return {
    type: event.type,
    description: `BOON REMOVAL ${source} (${detail})`,
    className: 'trigger',
    order: 55,
    flags: []
  };
}

/** True when the build has the Arms trait Signet Mastery selected. */
function hasSignetMasteryTrait(context: WarriorUiContext): boolean {
  return getActiveTraits((context.build?.specializations || []) as WarriorSpecializationSelection[]).some(
    (trait) => Number(trait.id) === TRAIT.SIGNET_MASTERY
  );
}

/**
 * Core Warrior buffs active at the inspection point. Read from the same buff
 * timeline as their modifiers so the bar never drifts from the simulation.
 */
function warriorCoreStateSnapshot(context: WarriorUiContext): RotationStateSnapshotItem[] {
  const result = context.result as Gw2SimulationResult | null | undefined;
  const at = warriorSnapshotAt(context);
  const items: RotationStateSnapshotItem[] = [];
  const peakPerformance = timedBuffAt(result, 'peak-performance', at);
  if (peakPerformance) {
    items.push({
      id: 'peak-performance',
      label: 'Peak Performance',
      value: formatSecondsRemaining(peakPerformance.remaining),
      title: 'Peak Performance: +10% strike damage (+15% total from trait)'
    });
  }

  if (hasSignetMasteryTrait(context)) {
    const stacks = Math.min(SIGNET_MASTERY_MAX_STACKS, timedBuffStacksAt(result, 'signet-mastery', at));
    if (stacks > 0) {
      items.push({
        id: 'signet-mastery',
        label: 'Signet Mastery',
        value: `${stacks}/${SIGNET_MASTERY_MAX_STACKS}`,
        title: `Signet Mastery: +${stacks * 100} ferocity (+100 per stack)`
      });
    }
  }

  // These independent stacking trait buffs are useful across every Warrior
  // specialization, regardless of whether Signet Mastery is selected.
  for (const [id, label, kind, maximum] of [
    ['furious-surge', 'Furious Surge', 'furious-surge', 25],
    ['berserkers-power', "Berserker's Power", 'berserkers-power', 4]
  ] as const) {
    const stacks = Math.min(maximum, timedBuffStacksAt(result, kind, at));
    if (stacks > 0) items.push({ id, label, value: `${stacks}/${maximum}`, title: `${label} active stacks` });
  }

  return items;
}

export const warriorCoreUi: Partial<ProfessionUiContract> = Object.freeze({
  assumptionControls: SIMULATION_RANDOMNESS_ASSUMPTION_CONTROLS,
  eventLogRow: warriorEventLogRow,
  rotationStateSnapshot: warriorCoreStateSnapshot,
  paletteGroups: (context) => (warriorUiSpecialization(context) === 'Core' ? warriorPaletteGroups(context) : []),
  skillBarGroups: (context) => (warriorUiSpecialization(context) === 'Core' ? warriorSkillBarGroups(context) : []),
  resourceViews: (context) =>
    warriorUiSpecialization(context) === 'Core' ? warriorAdrenalineResourceViews(context) : [],
  paletteSkillAvailability: (context, skill) =>
    warriorUiSpecialization(context) === 'Core'
      ? warriorBurstPaletteAvailability(context, skill as WarriorSkill)
      : { available: true, message: '' },
  targetHealthThresholds: () => [0.8, 0.5, 0.25]
});

export function bindWarriorCoreUi(_catalog: Readonly<CanonicalCatalog>): typeof warriorCoreUi {
  return warriorCoreUi;
}
