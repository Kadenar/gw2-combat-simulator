import type { ProfessionAppState } from '#gw2/app/types.js';
import type { RotationCommand, SchedulerStep } from '#gw2/platform/execution/types.js';
import type { SkillId } from '#gw2/platform/engine/skills/types.js';
import type { Gw2ProcStep } from '#gw2/platform/resolver/types.js';

import { targetHealthBreakpointSnapshots } from '#gw2/app/results/summary-metrics.js';
import type { SimulationEvent } from '#gw2/platform/engine/events/events.js';
import type { Gw2SimulationResult } from '#gw2/platform/simulation/types.js';
import { TRANSITION_LOCKOUT_EVENT } from '#gw2/platform/skills/transition-delays.js';

export interface TimelineCastOrdinal {
  readonly matchingIndex: number;
  readonly matchingTotal: number;
  readonly skillIndex: number;
  readonly skillTotal: number;
}

export interface TimelineRow {
  readonly weaponSet: number;
  readonly weaponLine: string | null;
  readonly skills: Array<{
    readonly entry: RotationCommand;
    readonly index: number;
  }>;
}

export interface EventTimelineMarker {
  readonly insertionIndex: number;
  readonly skill: string | undefined;
  readonly start: number;
  readonly detail: string | undefined;
}

export interface TimelineDeadTimeMarker {
  readonly insertionIndex: number;
  readonly start: number;
  readonly end: number;
  readonly durationMs: number;
  readonly reason?: 'explicit-wait' | 'zero-damage-cast' | 'cancelled-before-commit';
  readonly skill?: string;
}

export interface TimelineDeadTimeOptions {
  readonly includeExplicitWaits?: boolean;
}

interface TimelineDeadTimeStep extends SchedulerStep {
  readonly type?: unknown;
  readonly partialFill?: {
    readonly startMs?: unknown;
    readonly durationMs?: unknown;
  };
}

/** Preserves millisecond timing in cast details so short waits are not displayed as rounded centiseconds. */
export function formatTimelineCastDetails(
  step: SchedulerStep | null | undefined,
  formatTime: (time: number) => string
): string {
  const start = Number(step?.start);
  const end = Number(step?.end);
  if (!Number.isFinite(start) || !Number.isFinite(end)) return '';
  const castSeconds = Math.max(0, end - start) / 1000;
  return `Cast: ${formatTime(start)} → ${formatTime(end)}\nCast time: ${castSeconds.toFixed(3)}s`;
}

/** Read scheduled impacts so precombat suppression does not hide the timing needed to place Combat Start. */
export function timelineTargetImpactDetails(
  steps: readonly SchedulerStep[],
  events: readonly SimulationEvent[]
): Map<string, string> {
  const details = new Map<string, string>();
  for (const [activationId, offsetsMs] of timelineImpactOffsets(steps, events)) {
    // The editor only needs the cast-relative offset to position Combat Start.
    details.set(activationId, `First hit: ${offsetsMs[0]} ms`);
  }

  return details;
}

/**
 * Distinct cast-relative impact times in ascending milliseconds, keyed by activation. Packets sharing a timestamp
 * (a strike and its condition) form one hit, so editors can count how many hits land before Combat Start. Only the
 * cast's own packets count: procs it triggers (sigils, traits, relics) carry its lineage but are derived from a hit,
 * so they follow that hit instead of being hits of the skill.
 */
export function timelineImpactOffsets(
  steps: readonly SchedulerStep[],
  events: readonly SimulationEvent[]
): Map<string, number[]> {
  const impactTimes = new Map<string, Set<number>>();
  for (const event of events) {
    if (
      !event.activationId ||
      event.causalOrder != null ||
      event.cancelled === true ||
      !['damage', 'condition', 'control', 'blind'].includes(event.type) ||
      event.controlKind === 'initial-state'
    )
      continue;
    const times = impactTimes.get(event.activationId) ?? new Set<number>();
    times.add(Math.round(event.at * 1000));
    impactTimes.set(event.activationId, times);
  }

  const offsets = new Map<string, number[]>();
  for (const step of steps) {
    if (!step.activationId || step.invalid) continue;
    const times = impactTimes.get(step.activationId);
    if (!times) continue;
    const start = Math.round(step.start);
    offsets.set(
      step.activationId,
      [...times].map((atMs) => atMs - start).sort((left, right) => left - right)
    );
  }

  return offsets;
}

const NON_SKILL_STEP_NAMES = new Set([
  'Wait',
  'Combat Start',
  'Cooldown Reset',
  '__wait',
  '__combat_start',
  '__cooldown_reset'
]);
const NON_SKILL_STEP_TYPES = new Set(['wait', 'combat_start', 'cooldown_reset']);
const TIMELINE_WAIT_STEP_NAMES = new Set(['Wait', '__wait']);
const TIMELINE_WAIT_STEP_TYPES = new Set(['wait']);

function isValidTimelineStep(step: TimelineDeadTimeStep): boolean {
  return Number.isInteger(Number(step?.ri)) && Number(step.ri) >= 0 && !step.invalid;
}

function isTimelineWaitStep(step: TimelineDeadTimeStep): boolean {
  return (
    isValidTimelineStep(step) &&
    (TIMELINE_WAIT_STEP_NAMES.has(String(step.skill || '')) || TIMELINE_WAIT_STEP_TYPES.has(String(step.type || '')))
  );
}

function isTimelineSkillStep(step: TimelineDeadTimeStep): boolean {
  return (
    isValidTimelineStep(step) &&
    !NON_SKILL_STEP_NAMES.has(String(step.skill || '')) &&
    !NON_SKILL_STEP_TYPES.has(String(step.type || ''))
  );
}

export function timelineSkillCastOrdinals(steps: readonly SchedulerStep[] = []): Map<number, TimelineCastOrdinal> {
  const casts = steps
    .filter(isTimelineSkillStep)
    .sort((left, right) => Number(left.start || 0) - Number(right.start || 0) || Number(left.ri) - Number(right.ri));
  const totalsBySkill = new Map<string, number>();
  for (const cast of casts) {
    totalsBySkill.set(cast.skill, (totalsBySkill.get(cast.skill) || 0) + 1);
  }

  const seenBySkill = new Map<string, number>();
  return new Map(
    casts.map((cast, index) => {
      const matchingIndex = (seenBySkill.get(cast.skill) || 0) + 1;
      seenBySkill.set(cast.skill, matchingIndex);
      return [
        Number(cast.ri),
        {
          matchingIndex,
          matchingTotal: totalsBySkill.get(cast.skill) ?? 0,
          skillIndex: index + 1,
          skillTotal: casts.length
        }
      ];
    })
  );
}

/** Reports idle gaps plus the full attempted duration of casts that failed to commit. */
export function timelineDeadTimeMarkers(
  steps: readonly TimelineDeadTimeStep[] = [],
  resolvedEvents: readonly SimulationEvent[] = [],
  { includeExplicitWaits = true }: TimelineDeadTimeOptions = {}
): TimelineDeadTimeMarker[] {
  const explicitWaitMarkers: TimelineDeadTimeMarker[] = [];
  const intervals: Array<{
    start: number;
    end: number;
    insertionIndex: number;
    containsSkill: boolean;
  }> = [];

  for (const step of steps) {
    const isSkill = isTimelineSkillStep(step);
    if (!isSkill && !isTimelineWaitStep(step)) continue;
    const start = Math.round(Number(step.start));
    // A retained post-interrupt cast lockout is forced busy time, even though
    // the visible cast itself ends at the earlier interrupt timestamp.
    const end = Math.max(Math.round(Number(step.end)), Math.round(Number(step.castLockoutEnd ?? step.end)));
    const insertionIndex = Number(step.ri);
    if (Number.isFinite(start) && Number.isFinite(end) && end >= start) {
      intervals.push({ start, end, insertionIndex, containsSkill: isSkill });
      // Wait commands are known idle intervals. Keep them in the occupancy
      // union to suppress duplicate gap markers, but report their full shape.
      if (includeExplicitWaits && !isSkill && end > start) {
        explicitWaitMarkers.push({
          insertionIndex,
          start,
          end,
          durationMs: end - start,
          reason: 'explicit-wait'
        });
      }
    }

    if (!isSkill) continue;
    const partialFillStart = Math.round(Number(step.partialFill?.startMs));
    const partialFillDuration = Math.round(Number(step.partialFill?.durationMs));
    if (Number.isFinite(partialFillStart) && Number.isFinite(partialFillDuration) && partialFillDuration > 0) {
      intervals.push({
        start: partialFillStart,
        end: partialFillStart + partialFillDuration,
        insertionIndex,
        containsSkill: true
      });
    }
  }

  // Forced transition recovery is occupied time, never an editable Wait shape or idle-time suggestion.
  for (const event of resolvedEvents) {
    if (event.type !== TRANSITION_LOCKOUT_EVENT) continue;
    const start = Math.round(event.at * 1000);
    const end = Math.round((event.at + Number(event.duration || 0)) * 1000);
    const following = steps.find((step) => Number(step.start) >= end && isTimelineSkillStep(step));
    intervals.push({ start, end, insertionIndex: following?.ri ?? 0, containsSkill: false });
  }

  // Simultaneous actions anchor to the earliest authored entry so preceding idle time renders before all of them.
  intervals.sort(
    (left, right) => left.start - right.start || left.insertionIndex - right.insertionIndex || right.end - left.end
  );
  const busy: typeof intervals = [];
  for (const interval of intervals) {
    const previous = busy.at(-1);
    if (previous && interval.start <= previous.end) {
      previous.end = Math.max(previous.end, interval.end);
      previous.containsSkill ||= interval.containsSkill;
    } else {
      busy.push({ ...interval });
    }
  }

  const markers: TimelineDeadTimeMarker[] = [...explicitWaitMarkers];
  const futureContainsSkill = new Array<boolean>(busy.length);
  let containsFutureSkill = false;
  for (let index = busy.length - 1; index >= 0; index -= 1) {
    containsFutureSkill ||= busy[index]?.containsSkill || false;
    futureContainsSkill[index] = containsFutureSkill;
  }

  let previousContainsSkill = busy[0]?.containsSkill || false;
  for (let index = 1; index < busy.length; index += 1) {
    const previous = busy[index - 1];
    const next = busy[index];
    if (!previous || !next) continue;
    const durationMs = next.start - previous.end;
    if (durationMs > 0 && previousContainsSkill && futureContainsSkill[index]) {
      markers.push({
        insertionIndex: next.insertionIndex,
        start: previous.end,
        end: next.start,
        durationMs
      });
    }

    previousContainsSkill ||= next.containsSkill;
  }

  const damagingActivations = new Set(
    resolvedEvents
      .filter((event) => event.activationId && Number(event.damage) > 0)
      .map((event) => String(event.activationId))
  );
  for (const step of steps) {
    if (!isTimelineSkillStep(step) || !step.activationId) continue;
    const missingCommitMetadata = step.missingInterruptCommit === true;
    const cancelledBeforeKnownCommit = step.cancelledBeforeCommit === true && !missingCommitMetadata;
    if (!missingCommitMetadata && !cancelledBeforeKnownCommit) continue;
    // A declared cutoff proves the cast failed even if an incidental proc dealt damage;
    // missing metadata remains dead time only when the activation produced no damage at all.
    if (missingCommitMetadata && damagingActivations.has(step.activationId)) continue;
    const start = Math.round(Number(step.start));
    const end = Math.round(Number(step.end));
    const durationMs = end - start;
    if (!Number.isFinite(start) || !Number.isFinite(end) || durationMs <= 0) continue;
    markers.push({
      insertionIndex: Number(step.ri),
      start,
      end,
      durationMs,
      reason: cancelledBeforeKnownCommit ? 'cancelled-before-commit' : 'zero-damage-cast',
      skill: step.skill
    });
  }

  return markers.sort((left, right) => left.start - right.start || left.insertionIndex - right.insertionIndex);
}

/** Display only recovery that adds a gap; existing casts, retained recovery, and authored waits already occupy time. */
export function timelineTransitionDelayMarkers(
  steps: readonly TimelineDeadTimeStep[],
  events: readonly SimulationEvent[],
  endMs: number
): TimelineDeadTimeMarker[] {
  const occupied = steps
    .filter((step) => isTimelineSkillStep(step) || isTimelineWaitStep(step))
    .map((step) => ({ start: step.start, end: Math.max(step.end, step.castLockoutEnd ?? step.end) }))
    .sort((left, right) => left.start - right.start);
  const intervals: Array<{ start: number; end: number }> = [];
  for (const event of events) {
    if (event.type !== TRANSITION_LOCKOUT_EVENT) continue;
    let start = Math.round(event.at * 1000);
    const end = Math.min(endMs, Math.round((event.at + Number(event.duration || 0)) * 1000));
    for (const busy of occupied) {
      if (busy.end <= start || busy.start >= end) continue;
      if (busy.start > start) intervals.push({ start, end: busy.start });
      start = Math.max(start, busy.end);
    }

    if (start < end) intervals.push({ start, end });
  }

  // Overlapping transitions impose one deadline, so their visible uncovered intervals are a union too.
  const merged: typeof intervals = [];
  for (const interval of intervals.sort((left, right) => left.start - right.start)) {
    const previous = merged.at(-1);
    if (previous && interval.start < previous.end) previous.end = Math.max(previous.end, interval.end);
    else merged.push({ ...interval });
  }

  const skills = steps
    .filter(isTimelineSkillStep)
    .sort((left, right) => left.start - right.start || left.ri - right.ri);
  return merged.map(({ start, end }) => ({
    start,
    end,
    durationMs: end - start,
    insertionIndex: skills.find((step) => step.start >= end)?.ri ?? Math.max(0, ...steps.map((step) => step.ri + 1))
  }));
}

export function formatTimelineDuration(durationMs: unknown): string {
  const milliseconds = Math.max(0, Math.round(Number(durationMs) || 0));
  if (milliseconds < 1000) return `${milliseconds}ms`;
  const seconds = milliseconds / 1000;
  const precision = seconds < 10 ? 2 : seconds < 100 ? 1 : 0;
  const formatted = seconds.toFixed(precision);
  return `${precision > 0 ? formatted.replace(/\.?0+$/, '') : formatted}s`;
}

export function formatTimelineSkillTooltip(
  name: unknown,
  step: SchedulerStep | null | undefined,
  ordinal: TimelineCastOrdinal | null | undefined,
  formatTime: (time: number) => string,
  details: readonly string[] = []
): string {
  if (!step || step.invalid || !ordinal) return String(name || '');
  const duration = Math.max(0, Math.round(Number(step.end || 0) - Number(step.start || 0)));
  // Compact labels separate this activation's timing and ordinals from the skill's own description.
  return [
    `Start: ${formatTime(step.start)}`,
    `Cast time: ${duration}ms`,
    `Skill use: ${ordinal.matchingIndex} of ${ordinal.matchingTotal}`,
    `Rotation action: ${ordinal.skillIndex} of ${ordinal.skillTotal}`,
    ...details
  ].join('\n');
}

export function formatConcurrentTimelineBadge(offsetMs: unknown, timestamp: unknown = ''): string {
  const time = String(timestamp || '').trim();
  return `⊙${Number(offsetMs)}ms${time ? `\n${time}` : ''}`;
}

export function formatInterruptTimelineBadge(interruptMs: unknown, timestamp: unknown = ''): string {
  const time = String(timestamp || '').trim();
  return `✂${Number(interruptMs)}ms${time ? `\n${time}` : ''}`;
}

export function rotationEntryName(entry: RotationCommand): string {
  // Preserve the established UI action keys while deriving them from canonical command discriminants.
  if (entry.type === 'cast') return String(entry.skillId);
  if (entry.type === 'wait') return '__wait';
  if (entry.type === 'combat-start') return '__combat_start';
  return '__cooldown_reset';
}

export function timelineRows(
  rotation: readonly RotationCommand[] = [],
  {
    startingWeaponSet = 1,
    startingWeaponLine = null,
    isWeaponSwap = () => false,
    isWeaponSetRefresh = () => false,
    weaponLineTransition = () => undefined
  }: {
    readonly startingWeaponSet?: number;
    readonly startingWeaponLine?: string | null;
    readonly isWeaponSwap?: (entry: RotationCommand) => boolean;
    readonly isWeaponSetRefresh?: (entry: RotationCommand) => boolean;
    readonly weaponLineTransition?: (
      entry: RotationCommand,
      current: { weaponSet: number; weaponLine: string | null },
      index: number
    ) => string | null | undefined;
  } = {}
): TimelineRow[] {
  const rows: TimelineRow[] = [
    {
      weaponSet: startingWeaponSet,
      weaponLine: startingWeaponLine,
      skills: []
    }
  ];
  let weaponSet = startingWeaponSet;
  let weaponLine: string | null = startingWeaponLine;
  rotation.forEach((entry, index) => {
    rows.at(-1)?.skills.push({ entry, index });
    const swapsWeaponSet = isWeaponSwap(entry);
    // Supply the source rotation index so callers can apply simulated
    // transitions that occur immediately after this authored entry.
    const nextWeaponLine = weaponLineTransition(
      entry,
      {
        weaponSet,
        weaponLine
      },
      index
    );
    const changesWeaponLine = nextWeaponLine !== undefined;
    if (!swapsWeaponSet && !isWeaponSetRefresh(entry) && !changesWeaponLine) return;
    // A real swap changes the next row's set. Transform transitions start a
    // fresh row for the same equipped set.
    if (swapsWeaponSet) weaponSet = weaponSet === 1 ? 2 : 1;
    if (changesWeaponLine) weaponLine = nextWeaponLine;
    if (index < rotation.length - 1) {
      rows.push({ weaponSet, weaponLine, skills: [] });
    }
  });
  return rows;
}

export function eventTimelineMarkers(
  result: Gw2SimulationResult | null | undefined,
  rotationLength: number,
  predicate: (event: SimulationEvent) => boolean = (event) => event.type === 'marker'
): EventTimelineMarker[] {
  const steps = (result?.steps || [])
    .filter((step) => step.ri >= 0 && !step.invalid)
    .sort((left, right) => left.start - right.start || left.ri - right.ri);
  return (result?.events || [])
    .filter(predicate)
    .map((event) => {
      const start = Math.round(Number(event.at || 0) * 1000);
      // Inject the marker immediately before the first rotation step that has
      // not started; events after all steps append to the timeline.
      const next = steps.find((step) => step.start >= start);
      return {
        insertionIndex: next?.ri ?? rotationLength,
        skill: event.name,
        start,
        detail: event.detail
      };
    })
    .sort((left, right) => left.start - right.start);
}

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

/** Places simulated trait procs after the rotation command that triggered them. */
export function traitProcTimelineMarkers(
  result: Gw2SimulationResult | null | undefined,
  rotationLength = 0
): ProcTimelineMarker[] {
  return matchingProcTimelineMarkers(result, 'trait_proc', rotationLength);
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
  const effectiveEnd = Number(result?.combatEndTime || 0);
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

export interface TimelineWeaponRowGroup {
  readonly weaponSet: number;
  readonly rows: TimelineRow[];
}

/** Groups adjacent timeline lines under one weapon-set label while preserving every transform boundary. */
export function timelineWeaponRowGroups(rows: readonly TimelineRow[] = []): TimelineWeaponRowGroup[] {
  const groups: TimelineWeaponRowGroup[] = [];
  for (const row of rows) {
    const current = groups.at(-1);
    if (current?.weaponSet === row.weaponSet) current.rows.push(row);
    else groups.push({ weaponSet: row.weaponSet, rows: [row] });
  }

  return groups;
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

export function targetHealthTimelineMarkers(
  result: Gw2SimulationResult | null | undefined,
  targetHealth: number,
  thresholds: readonly number[] = [],
  rotationLength = 0,
  startingHealthPercent = 100
) {
  const percents = [...new Set(thresholds)]
    .map((threshold) => Number(threshold) * 100)
    .filter((percent) => percent > 0 && percent < 100);
  if (!percents.length) return [];
  const steps = (result?.steps || [])
    .filter((step) => step.ri >= 0 && !step.invalid)
    .sort((left, right) => left.start - right.start || left.ri - right.ri);
  return targetHealthBreakpointSnapshots(result, targetHealth, percents, startingHealthPercent).map((snapshot) => {
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
  readonly maximumChargingSeconds?: number;
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
      ...(event.maximumChargingSeconds == null ? {} : { maximumChargingSeconds: Number(event.maximumChargingSeconds) }),
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
 * window as a partial fill excludes charging from dead time, but holding past
 * full charge remains idle. Keep the fill anchored to entry, not release.
 */
export function timelineStepsWithChargeFills(
  steps: readonly SchedulerStep[],
  resourceSpends: ReadonlyMap<number, ShatterResourceSpend>
): TimelineChargeFillStep[] {
  return steps.map((step) => {
    const spend = resourceSpends.get(step.ri);
    const chargingMs = Math.round(Number(spend?.chargingSeconds || 0) * 1000);
    if (chargingMs <= 0) return step;
    return {
      ...step,
      partialFill: {
        startMs: step.start - chargingMs,
        durationMs: Math.min(chargingMs, Math.round(Number(spend?.maximumChargingSeconds ?? Infinity) * 1000))
      }
    };
  });
}

export type TimelineItem = {
  command: RotationCommand;
  type: RotationCommand['type'];
  name: string;
  skillId?: SkillId;
  concurrentOffsetMs?: number;
  interruptAfterMs?: number;
  offTarget?: boolean;
  impactDelayMs?: number;
  releaseAtCharges?: unknown;
  doubleEdgeOutcome?: unknown;
  durationMs?: number;
};

// Projects canonical commands into the uniform fields needed by timeline rendering.
export function timelineItem(command: RotationCommand): TimelineItem {
  if (command.type === 'cast') {
    return { ...command, command, name: String(command.skillId) };
  }

  if (command.type === 'wait') {
    return { ...command, command, name: '__wait' };
  }

  return {
    ...command,
    command,
    name: command.type === 'combat-start' ? '__combat_start' : '__cooldown_reset'
  };
}

/** Prevents a newly changed rotation from displaying timings produced for the previous build revision. */
export function currentTimelineResults(
  app: Pick<ProfessionAppState, 'buildRevision' | 'resultRevision' | 'results'>
): ProfessionAppState['results'] {
  return app.resultRevision === app.buildRevision ? app.results : null;
}
