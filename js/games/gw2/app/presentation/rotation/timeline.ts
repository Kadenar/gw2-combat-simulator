import type {
  RotationCommand,
  SchedulerRecord,
  SchedulerStep,
  SimulationEvent,
  SkillId
} from '#gw2/platform/engine/types.js';
import type { Gw2SimulationResult } from '#gw2/platform/simulation/types.js';

export interface RotationDragState extends SchedulerRecord {
  readonly source?: string;
  readonly index?: number;
  readonly name?: string;
  readonly skillId?: SkillId;
}

export interface TimelineInteractionOptions {
  readonly getDragState: () => RotationDragState | null | undefined;
  readonly setDragState: (value: RotationDragState | null) => void;
  /** Applies a timeline drag through the application-owned rotation editing layer. */
  readonly moveEntry: (fromIndex: number, toIndex: number) => boolean;
  /** Applies one resolved palette item or macro through the application-owned editing layer. */
  readonly insertEntries: (entries: readonly RotationCommand[], insertAt: number) => boolean;
  readonly resolvePaletteEntry?: (
    name: string,
    drag: RotationDragState | null | undefined,
    insertAt: number
  ) => RotationCommand | RotationCommand[] | null | undefined;
  readonly onChanged?: () => void;
}

/** Applies one palette or timeline drop through caller-owned mutation hooks. */
export function applyTimelineDrop(options: TimelineInteractionOptions, insertAt: number): boolean {
  const drag = options.getDragState?.();
  if (!drag) return false;
  if (drag.source === 'timeline') {
    options.setDragState?.(null);
    const fromIndex = Number(drag.index ?? drag.idx);
    if (!options.moveEntry(fromIndex, insertAt)) return false;
    options.onChanged?.();
    return true;
  }

  if (drag.source !== 'palette') return false;
  const name = String(drag.name ?? drag.skillName ?? '');
  const resolved = options.resolvePaletteEntry?.(name, drag, insertAt);
  options.setDragState?.(null);
  const entries = Array.isArray(resolved) ? resolved : resolved ? [resolved] : [];
  if (!options.insertEntries(entries, insertAt)) return false;
  options.onChanged?.();
  return true;
}

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

export function clearTimelineDropIndicators(root: HTMLElement | null | undefined): void {
  if (!root) return;
  root.classList.remove('drag-over', 'drag-over-empty', 'drag-insert-before', 'drag-insert-after');
  root
    .querySelectorAll<HTMLElement>('.drag-over, .drag-over-empty, .drag-insert-before, .drag-insert-after')
    .forEach((element) =>
      element.classList.remove('drag-over', 'drag-over-empty', 'drag-insert-before', 'drag-insert-after')
    );
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

export function getSkillDropInsertionIndex(skillElement: HTMLElement, clientX: number): number | null {
  const rawIndex = skillElement?.dataset?.idx;
  if (rawIndex == null || String(rawIndex).trim() === '') return null;
  const index = Number(rawIndex);
  if (!Number.isInteger(index)) return null;
  const rect = skillElement.getBoundingClientRect();
  // Dropping on the left/right half inserts before/after the hovered entry.
  return clientX < rect.left + rect.width / 2 ? index : index + 1;
}

export function updateSkillDropIndicator(skillElement: HTMLElement, clientX: number): void {
  skillElement.classList.remove('drag-insert-before', 'drag-insert-after');
  const rect = skillElement.getBoundingClientRect();
  skillElement.classList.add(clientX < rect.left + rect.width / 2 ? 'drag-insert-before' : 'drag-insert-after');
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
