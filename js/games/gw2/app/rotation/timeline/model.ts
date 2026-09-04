import type { RotationCommand, SchedulerStep, SimulationEvent, SkillId } from '#gw2/platform/engine/types.js';
import type { Gw2ProcStep } from '#gw2/platform/resolver/types.js';
import type { Gw2SimulationResult } from '#gw2/platform/simulation/types.js';
import { targetHealthBreakpointSnapshots } from '#gw2/app/presentation/results/result-transform.js';

export type TimelineRotationEntry = RotationCommand;

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
    readonly entry: TimelineRotationEntry;
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

export interface SkillTimingOccurrence {
  readonly rotationIndex: number;
  readonly startMs: number;
  readonly intervalMs: number | null;
}

export interface SkillTimingAnalysis {
  readonly skillId: SkillId;
  readonly occurrences: readonly SkillTimingOccurrence[];
  readonly useCount: number;
  readonly averageIntervalMs: number | null;
  readonly fastestIntervalMs: number | null;
  readonly slowestIntervalMs: number | null;
}

export interface StateTimingTransition {
  readonly atMs: number;
  readonly active: boolean;
}

export interface StateTimingOccurrence {
  readonly startMs: number;
  readonly endMs: number;
  readonly durationMs: number;
  readonly endedAtTimelineEnd: boolean;
}

export interface StateTimingAnalysis {
  readonly occurrences: readonly StateTimingOccurrence[];
  readonly useCount: number;
  readonly averageDurationMs: number | null;
  readonly shortestDurationMs: number | null;
  readonly longestDurationMs: number | null;
}

/** Pairs authoritative active/inactive transitions and closes a still-active final stay at the timeline end. */
export function stateTimingAnalysis(
  transitions: readonly StateTimingTransition[] = [],
  timelineEndMs = 0
): StateTimingAnalysis {
  const ordered = transitions
    .filter((transition) => Number.isFinite(Number(transition.atMs)))
    .map((transition, index) => ({ ...transition, index }))
    .sort((left, right) => left.atMs - right.atMs || left.index - right.index);
  const occurrences: StateTimingOccurrence[] = [];
  let activeSince: number | null = null;

  for (const transition of ordered) {
    if (transition.active) {
      if (activeSince == null) activeSince = transition.atMs;
    } else if (activeSince != null) {
      occurrences.push({
        startMs: activeSince,
        endMs: transition.atMs,
        durationMs: Math.max(0, transition.atMs - activeSince),
        endedAtTimelineEnd: false
      });
      activeSince = null;
    }
  }

  if (activeSince != null) {
    const endMs = Math.max(activeSince, Number.isFinite(Number(timelineEndMs)) ? Number(timelineEndMs) : activeSince);
    occurrences.push({
      startMs: activeSince,
      endMs,
      durationMs: endMs - activeSince,
      endedAtTimelineEnd: true
    });
  }

  const durations = occurrences.map((occurrence) => occurrence.durationMs);
  return {
    occurrences,
    useCount: occurrences.length,
    averageDurationMs: durations.length
      ? durations.reduce((total, duration) => total + duration, 0) / durations.length
      : null,
    shortestDurationMs: durations.length ? Math.min(...durations) : null,
    longestDurationMs: durations.length ? Math.max(...durations) : null
  };
}

/** Groups completed casts by stable ID so every interval is measured only against the same skill. */
export function skillTimingAnalyses(
  skillIds: readonly SkillId[] = [],
  steps: readonly SchedulerStep[] = []
): SkillTimingAnalysis[] {
  const seen = new Set<SkillId>();
  return skillIds
    .filter((skillId) => {
      if (seen.has(skillId)) return false;
      seen.add(skillId);
      return true;
    })
    .map((skillId) => {
      const matches = steps
        .filter(
          (step) =>
            !step.invalid &&
            step.skillId === skillId &&
            Number.isInteger(Number(step.ri)) &&
            Number.isFinite(Number(step.start))
        )
        .sort((left, right) => Number(left.start) - Number(right.start) || Number(left.ri) - Number(right.ri));
      const occurrences = matches.map((step, index): SkillTimingOccurrence => ({
        rotationIndex: Number(step.ri),
        startMs: Number(step.start),
        intervalMs: index === 0 ? null : Number(step.start) - Number(matches[index - 1].start)
      }));
      const intervals = occurrences
        .map((occurrence) => occurrence.intervalMs)
        .filter((interval): interval is number => interval != null);
      return {
        skillId,
        occurrences,
        useCount: occurrences.length,
        averageIntervalMs: intervals.length
          ? intervals.reduce((total, interval) => total + interval, 0) / intervals.length
          : null,
        fastestIntervalMs: intervals.length ? Math.min(...intervals) : null,
        slowestIntervalMs: intervals.length ? Math.max(...intervals) : null
      };
    });
}

export interface WeaponSetDurationOptions {
  readonly startingWeaponSet?: number;
  readonly timelineEndMs?: number;
  readonly hasSecondWeaponSet?: boolean;
  readonly weaponSwapSkillIds?: ReadonlySet<SkillId>;
}

export interface WeaponSetActiveSegment {
  readonly weaponSet: 1 | 2;
  readonly startMs: number;
  readonly endMs: number;
  readonly durationMs: number;
}

/** Produces one stay per real equipped-set activation so repeated manifest rows retain their own durations. */
export function weaponSetActiveSegments(
  steps: readonly SchedulerStep[] = [],
  {
    startingWeaponSet = 1,
    timelineEndMs = 0,
    hasSecondWeaponSet = false,
    weaponSwapSkillIds = new Set<SkillId>()
  }: WeaponSetDurationOptions = {}
): readonly WeaponSetActiveSegment[] {
  const timelineStartMs = Math.min(
    0,
    ...steps.filter((step) => !step.invalid && Number.isFinite(Number(step.start))).map((step) => Number(step.start))
  );
  const timelineEnd = Math.max(timelineStartMs, Number.isFinite(Number(timelineEndMs)) ? Number(timelineEndMs) : 0);
  if (!hasSecondWeaponSet) {
    return [{ weaponSet: 1, startMs: timelineStartMs, endMs: timelineEnd, durationMs: timelineEnd - timelineStartMs }];
  }

  const segments: WeaponSetActiveSegment[] = [];
  let activeSet: 1 | 2 = Number(startingWeaponSet) === 2 ? 2 : 1;
  let segmentStart = timelineStartMs;
  const swaps = steps
    .filter(
      (step) =>
        !step.invalid &&
        step.skillId != null &&
        weaponSwapSkillIds.has(step.skillId) &&
        Number.isFinite(Number(step.end))
    )
    .sort((left, right) => Number(left.end) - Number(right.end) || Number(left.ri) - Number(right.ri));

  for (const swap of swaps) {
    const at = Math.max(segmentStart, Math.min(timelineEnd, Number(swap.end)));
    segments.push({ weaponSet: activeSet, startMs: segmentStart, endMs: at, durationMs: at - segmentStart });
    activeSet = activeSet === 1 ? 2 : 1;
    segmentStart = at;
  }

  segments.push({
    weaponSet: activeSet,
    startMs: segmentStart,
    endMs: timelineEnd,
    durationMs: timelineEnd - segmentStart
  });
  return segments;
}

/** Sums every stay for each equipped set while keeping aggregate reporting separate from row presentation. */
export function weaponSetDurationTotals(
  steps: readonly SchedulerStep[] = [],
  options: WeaponSetDurationOptions = {}
): ReadonlyMap<number, number> {
  const totals = new Map<number, number>();
  for (const segment of weaponSetActiveSegments(steps, options)) {
    totals.set(segment.weaponSet, (totals.get(segment.weaponSet) || 0) + segment.durationMs);
  }

  return totals;
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
  return [
    `${name} at ${formatTime(step.start)} for ${duration}ms`,
    `${name} cast ${ordinal.matchingIndex} of ${ordinal.matchingTotal}`,
    `Skill cast ${ordinal.skillIndex} of ${ordinal.skillTotal}`,
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

export function rotationEntryName(entry: TimelineRotationEntry): string {
  // Preserve the established UI action keys while deriving them from canonical command discriminants.
  if (entry.type === 'cast') return String(entry.skillId);
  if (entry.type === 'wait') return '__wait';
  if (entry.type === 'combat-start') return '__combat_start';
  return '__cooldown_reset';
}

export function timelineRows(
  rotation: readonly TimelineRotationEntry[] = [],
  {
    startingWeaponSet = 1,
    startingWeaponLine = null,
    isWeaponSwap = () => false,
    isWeaponSetRefresh = () => false,
    weaponLineTransition = () => undefined
  }: {
    readonly startingWeaponSet?: number;
    readonly startingWeaponLine?: string | null;
    readonly isWeaponSwap?: (entry: TimelineRotationEntry) => boolean;
    readonly isWeaponSetRefresh?: (entry: TimelineRotationEntry) => boolean;
    readonly weaponLineTransition?: (
      entry: TimelineRotationEntry,
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

export function automaticPhotonForgeExitTimelineMarkers(
  result: Gw2SimulationResult | null | undefined,
  rotationLength = 0
) {
  // Overheat exits Photon Forge without an authored deactivation cast; expose
  // that state change as both a timeline item and a Forge lane boundary.
  return eventTimelineMarkers(
    result,
    rotationLength,
    (event) => event.type === 'engineer.state' && event.reason === 'overheat'
  ).map((marker) => ({
    ...marker,
    skill: 'Overheat',
    detail: 'automatic forge exit'
  }));
}

export function timelineWeaponLineExitMarkerRowIndex(
  rows: readonly TimelineRow[],
  insertionIndex: number,
  weaponLine: string
): number {
  // Automatic exits visually belong at the tail of the transformation lane
  // they close, even though their insertion index precedes the next command.
  return rows.findIndex(
    (row) => row.weaponLine === weaponLine && Number(row.skills.at(-1)?.index) + 1 === insertionIndex
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
