import type { RotationCommand, SchedulerStep } from '../../../platform/engine/types.js';
import type { Gw2ProcStep } from '../../../platform/gw2/resolver/types.js';
import type { Gw2SimulationResult } from '../../../platform/gw2/simulation/types.js';
import { eventTimelineMarkers, rotationEntryName, timelineRows } from '../../../platform/ui/rotation/timeline.js';
import { targetHealthBreakpointSnapshots } from '../../../platform/ui/results/result-transform.js';

const WEAPON_SET_REFRESH_SKILLS = new Set([
  'Swap Legends',
  "Reaper's Shroud",
  "Exit Reaper's Shroud",
  'Harbinger Shroud',
  'Exit Harbinger Shroud',
  "Ritualist's Shroud",
  "Exit Ritualist's Shroud",
  'Enter Shadow Shroud',
  'Exit Shadow Shroud',
  'Enter Radiant Forge',
  'Exit Radiant Forge'
]);

export function procFilterKey(proc: Gw2ProcStep): string {
  return `${proc.type}:${proc.skill}`;
}

export function procFilterLabel(proc: Gw2ProcStep): string {
  const type =
    proc.type === 'relic_proc'
      ? 'Relic'
      : proc.type === 'sigil_proc'
        ? 'Sigil'
        : proc.type === 'skill_proc'
          ? 'Skill'
          : 'Trait';
  return `${proc.skill} (${type})`;
}

export interface ProcTimelineMarker extends Gw2ProcStep {
  readonly insertionIndex: number;
  readonly activations: readonly Gw2ProcStep[];
  readonly expired?: boolean;
}

function procMarkerInsertionIndex(steps: readonly SchedulerStep[], start: number, rotationLength: number): number {
  return steps.find((step) => step.start > start)?.ri ?? rotationLength;
}

function matchingProcTimelineMarkers(
  result: Gw2SimulationResult | null | undefined,
  procType: string,
  rotationLength = 0
): ProcTimelineMarker[] {
  const steps = (result?.steps || [])
    .filter((step) => step.ri >= 0 && !step.invalid)
    .sort((left, right) => left.start - right.start || left.ri - right.ri);
  const activationGroups = new Map<string, Gw2ProcStep[]>();
  for (const proc of [...(result?.procSteps || [])].sort((left, right) => left.start - right.start)) {
    const activationKey = `${procFilterKey(proc)}:${proc.start}`;
    const activations = activationGroups.get(activationKey) || [];
    activations.push(proc);
    activationGroups.set(activationKey, activations);
  }

  return [...activationGroups.values()]
    .filter((activations) => activations[0]?.type === procType)
    .map((activations) => {
      const proc = activations[0] as Gw2ProcStep;
      // A proc at cast start belongs after that cast. Later procs are placed
      // immediately before the next command that has not started yet.
      return {
        ...proc,
        insertionIndex: procMarkerInsertionIndex(steps, proc.start, rotationLength),
        activations
      };
    })
    .sort((left, right) => left.start - right.start);
}

export function sigilProcTimelineMarkers(
  result: Gw2SimulationResult | null | undefined,
  rotationLength = 0
): ProcTimelineMarker[] {
  return matchingProcTimelineMarkers(result, 'sigil_proc', rotationLength);
}

export function relicProcTimelineMarkers(
  result: Gw2SimulationResult | null | undefined,
  rotationLength = 0
): ProcTimelineMarker[] {
  return matchingProcTimelineMarkers(result, 'relic_proc', rotationLength);
}

/**
 * Emits one marker at the true end of each continuous timed-relic window.
 * Activations at or before the current deadline are refreshes, so their window
 * is merged and no misleading crossed icon is shown at the earlier deadline.
 */
export function relicProcExpirationTimelineMarkers(
  result: Gw2SimulationResult | null | undefined,
  rotationLength = 0
): ProcTimelineMarker[] {
  const steps = (result?.steps || [])
    .filter((step) => step.ri >= 0 && !step.invalid)
    .sort((left, right) => left.start - right.start || left.ri - right.ri);
  const effectiveEnd = result?.deathTime == null ? Number(result?.duration || 0) : Number(result.deathTime);
  const rotationEnd = Math.round(effectiveEnd * 1000);
  const windows = new Map<string, { proc: Gw2ProcStep; expiresAt: number; activations: Gw2ProcStep[] }>();
  const expired: ProcTimelineMarker[] = [];

  const appendExpiration = (window: { proc: Gw2ProcStep; expiresAt: number; activations: Gw2ProcStep[] }): void => {
    if (window.expiresAt > rotationEnd) return;
    expired.push({
      ...window.proc,
      start: window.expiresAt,
      end: window.expiresAt,
      expiresAt: window.expiresAt,
      insertionIndex: procMarkerInsertionIndex(steps, window.expiresAt, rotationLength),
      activations: window.activations,
      expired: true
    });
  };

  for (const proc of [...(result?.procSteps || [])]
    .filter((step) => step.type === 'relic_proc' && Number(step.expiresAt) > step.start)
    .sort((left, right) => left.start - right.start)) {
    const key = procFilterKey(proc);
    const expiresAt = Number(proc.expiresAt);
    const window = windows.get(key);
    if (window && proc.start <= window.expiresAt) {
      window.proc = proc;
      window.expiresAt = Math.max(window.expiresAt, expiresAt);
      window.activations.push(proc);
      continue;
    }

    if (window) appendExpiration(window);
    windows.set(key, { proc, expiresAt, activations: [proc] });
  }

  for (const window of windows.values()) appendExpiration(window);
  return expired.sort((left, right) => left.start - right.start);
}

export function rotationSkillHighlightKey(entry: RotationCommand): string {
  // Canonical identities keep duplicate display names and special commands from sharing highlights.
  return `skill:${entry.type === 'cast' ? String(entry.skillId) : entry.type}`;
}

export function procStackLabel(proc: Gw2ProcStep): string {
  if (proc.skill !== 'Relic of Aristocracy') return '';
  return String(proc.detail || '').match(/^(\d+\/\d+)\s+stacks$/)?.[1] || '';
}

export function procBadgeLabel(procSteps: readonly Gw2ProcStep[] = []): string {
  const reductions = procSteps.map((proc) => Number(proc.cooldownReduction));
  if (reductions.length && reductions.every((reduction) => Number.isFinite(reduction) && reduction > 0)) {
    const total = reductions.reduce((sum, reduction) => sum + reduction, 0);
    const rounded = Math.round((total + Number.EPSILON) * 1000) / 1000;
    return `-${rounded}s`;
  }

  return procSteps.length > 1 ? `×${procSteps.length}` : '';
}

export interface ConsecutiveProcGroup {
  readonly key: string;
  readonly steps: Gw2ProcStep[];
}

export function groupConsecutiveProcSteps(procSteps: readonly Gw2ProcStep[] = []): ConsecutiveProcGroup[] {
  const groups: ConsecutiveProcGroup[] = [];
  for (const proc of procSteps) {
    const key = procFilterKey(proc);
    const previous = groups.at(-1);
    if (previous?.key === key) {
      previous.steps.push(proc);
    } else {
      groups.push({ key, steps: [proc] });
    }
  }

  return groups;
}

export interface TimelineWeaponRowOptions {
  readonly startingWeaponSet?: number;
  readonly startingWeaponLine?: string | null;
  readonly weaponSwapChangesSet?: boolean;
  readonly weaponLineEndIndexes?: ReadonlySet<number>;
  readonly skillName?: (entry: RotationCommand) => string;
  readonly weaponLineTransition?: (
    entry: RotationCommand,
    current: { weaponSet: number; weaponLine: string | null },
    index: number
  ) => string | null | undefined;
}

export function timelineWeaponRows(
  rotation: readonly RotationCommand[] = [],
  {
    startingWeaponSet = 1,
    startingWeaponLine = null,
    weaponSwapChangesSet = true,
    weaponLineEndIndexes = new Set<number>(),
    skillName = rotationEntryName,
    weaponLineTransition = () => undefined
  }: TimelineWeaponRowOptions = {}
) {
  return timelineRows(rotation, {
    startingWeaponSet,
    startingWeaponLine,
    isWeaponSwap(entry) {
      return weaponSwapChangesSet && skillName(entry) === 'Swap Weapons';
    },
    isWeaponSetRefresh(entry) {
      const name = skillName(entry);
      return (!weaponSwapChangesSet && name === 'Swap Weapons') || WEAPON_SET_REFRESH_SKILLS.has(name);
    },
    weaponLineTransition(entry, current, index) {
      const authoredTransition = weaponLineTransition(entry, current, index);
      // Simulated automatic exits close a named lane after the matching
      // authored entry without requiring a synthetic rotation command.
      return authoredTransition !== undefined
        ? authoredTransition
        : current.weaponLine !== null && weaponLineEndIndexes.has(index + 1)
          ? null
          : undefined;
    }
  });
}

export function continuumEndTimelineMarkers(result: Gw2SimulationResult | null | undefined, rotationLength = 0) {
  return eventTimelineMarkers(
    result,
    rotationLength,
    (event) => event.type === 'marker' && event.name === 'Continuum Shift' && event.detail === 'split expired'
  );
}

export function automaticTomeStowTimelineMarkers(result: Gw2SimulationResult | null | undefined, rotationLength = 0) {
  // Page exhaustion is emitted by the final chapter rather than as an
  // authored Stow Tome cast; expose that state transition as a timeline item.
  return eventTimelineMarkers(
    result,
    rotationLength,
    (event) => event.type === 'guardian.tome-page-used' && Number(event.pagesRemaining) === 0 && !event.activeTome
  ).map((marker) => ({
    ...marker,
    skill: 'Stow Tome',
    detail: 'page exhaustion'
  }));
}

export function targetHealthTimelineMarkers(
  result: Gw2SimulationResult | null | undefined,
  targetHealth: number,
  thresholds: readonly number[] = [],
  rotationLength = 0
) {
  const percents = [...new Set(thresholds)]
    .map((threshold) => Number(threshold) * 100)
    .filter((percent) => percent > 0 && percent < 100);
  if (!percents.length) return [];
  const steps = (result?.steps || [])
    .filter((step) => step.ri >= 0 && !step.invalid)
    .sort((left, right) => left.start - right.start || left.ri - right.ri);
  return targetHealthBreakpointSnapshots(result, targetHealth, percents).map((snapshot) => {
    const start = Math.round(snapshot.at * 1000);
    const next = steps.find((step) => step.start >= start);
    return {
      insertionIndex: next?.ri ?? rotationLength,
      healthPercent: snapshot.healthPercent,
      start,
      damage: snapshot.damage
    };
  });
}

export interface ShatterResourceSpend {
  readonly count: number;
  readonly resource: string;
  readonly sourceSkill: string;
  readonly requestedCharges?: number;
  readonly maximumCharges?: number;
  readonly chargesReached?: number;
  readonly chargingSeconds?: number;
  readonly flowSpent?: number;
}

export function shatterResourceSpends(
  result: Gw2SimulationResult | null | undefined
): Map<number, ShatterResourceSpend> {
  const spends = new Map<number, ShatterResourceSpend>();
  for (const event of result?.events || []) {
    const rotationIndex = Number(event.rotationIndex);
    if (event.type !== 'resource' || event.reason !== 'profession mechanic' || !Number.isInteger(rotationIndex)) {
      continue;
    }

    spends.set(rotationIndex, {
      count: Math.abs(Number(event.amount || 0)),
      resource: String(event.resource || 'resources'),
      sourceSkill: String(event.sourceSkill || ''),
      ...(event.requestedCharges == null ? {} : { requestedCharges: Number(event.requestedCharges) }),
      ...(event.maximumCharges == null ? {} : { maximumCharges: Number(event.maximumCharges) }),
      ...(event.chargesReached == null ? {} : { chargesReached: Number(event.chargesReached) }),
      ...(event.chargingSeconds == null ? {} : { chargingSeconds: Number(event.chargingSeconds) }),
      ...(event.flowSpent == null ? {} : { flowSpent: Number(event.flowSpent) })
    });
  }

  return spends;
}

export interface TimelineChargeFillStep extends SchedulerStep {
  readonly partialFill?: {
    readonly startMs: number;
    readonly durationMs: number;
  };
}

/**
 * Charging casts such as Dragon Slash occupy the character from the moment
 * their charge window opens, well before the cast bar begins. Surfacing that
 * window as a partial fill keeps the charge time from being counted as dead
 * time on the timeline.
 */
export function timelineStepsWithChargeFills(
  steps: readonly SchedulerStep[],
  resourceSpends: ReadonlyMap<number, ShatterResourceSpend>
): TimelineChargeFillStep[] {
  return steps.map((step) => {
    const chargingMs = Math.round(Number(resourceSpends.get(step.ri)?.chargingSeconds || 0) * 1000);
    if (chargingMs <= 0) return step;
    return {
      ...step,
      partialFill: {
        startMs: step.start - chargingMs,
        durationMs: chargingMs
      }
    };
  });
}
