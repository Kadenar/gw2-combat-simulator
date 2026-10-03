import { effectStateValue, type EffectState } from '#gw2/platform/combat/effect-state.js';
import { canonicalTime } from '#kernel/core/clock.js';

export interface EffectSegment {
  readonly source?: EffectState['source'];
  readonly start: number;
  readonly end: number;
  readonly count: number;
  readonly countLimit: number | null;
  readonly expiresAt: number | null;
}

export interface EffectTrack extends Omit<EffectState, 'windows'> {
  readonly id: string;
  readonly segments: readonly EffectSegment[];
  readonly terminal: {
    readonly count: number;
    readonly expiresAt: number | null;
    readonly source?: EffectState['source'];
  };
}

export interface EffectReport {
  readonly start: number;
  readonly end: number;
  readonly tracks: readonly EffectTrack[];
}

/** Commit observations at execution boundaries; expiry is derived from the same accepted windows as live state. */
export class EffectRecorder {
  private readonly tracks = new Map<
    string,
    { state: EffectState; at: number; segments: EffectSegment[]; owner: string }
  >();

  capture(at: number, states: readonly EffectState[], owner = 'runtime'): void {
    const ids = new Set<string>();
    for (const state of states) {
      const id = `${state.origin}:${state.recipient}:${state.category}:${state.kind}`;
      if (ids.has(id)) throw new TypeError(`Duplicate effect state owner: ${id}`);
      ids.add(id);
      const previous = this.tracks.get(id);
      if (
        previous &&
        previous.state.countLimit === state.countLimit &&
        previous.state.durationLimit === state.durationLimit &&
        previous.state.source?.eventOrder === state.source?.eventOrder &&
        previous.state.source?.at === state.source?.at &&
        previous.state.windows.length === state.windows.length &&
        previous.state.windows.every(
          (window, index) =>
            window.expiresAt === state.windows[index]!.expiresAt && window.stacks === state.windows[index]!.stacks
        )
      )
        continue;
      if (previous) this.advance(previous, at);
      this.tracks.set(id, { state: structuredClone(state), at, segments: previous?.segments ?? [], owner });
    }

    for (const [id, track] of this.tracks) {
      if (ids.has(id) || track.owner !== owner) continue;
      this.advance(track, at);
      track.state = { ...track.state, windows: [] };
    }
  }

  private advance(track: { state: EffectState; at: number; segments: EffectSegment[] }, end: number): void {
    if (end < track.at) throw new RangeError('Effect observations must follow execution time.');
    const boundaries = [
      track.at,
      ...new Set(
        track.state.windows
          .map((window) => window.expiresAt)
          .filter((at): at is number => at != null && at > track.at && at < end)
      ),
      end
    ].sort((a, b) => a - b);
    for (let index = 1; index < boundaries.length; index++) {
      const start = boundaries[index - 1]!;
      const finish = boundaries[index]!;
      if (finish <= start) continue;
      const value = effectStateValue(track.state, start);
      if (!value.count) continue;
      const segment = { start, end: finish, ...value, countLimit: track.state.countLimit, source: value.source };
      const previous = track.segments.at(-1);
      if (
        previous &&
        previous.end === start &&
        previous.count === segment.count &&
        previous.countLimit === segment.countLimit &&
        previous.expiresAt === segment.expiresAt &&
        previous.source?.eventOrder === segment.source?.eventOrder &&
        previous.source?.at === segment.source?.at
      )
        track.segments[track.segments.length - 1] = { ...previous, end: finish };
      else track.segments.push(segment);
    }

    track.at = end;
  }

  finish(end: number): EffectReport {
    const tracks: EffectTrack[] = [];
    for (const [id, track] of this.tracks) {
      this.advance(track, end);
      const { windows: _windows, ...metadata } = track.state;
      const segments = track.segments
        .filter((segment) => segment.start < end)
        .map((segment) => ({ ...segment, end: Math.min(end, segment.end) }));
      const terminal = effectStateValue(track.state, end);
      tracks.push({ ...metadata, id, segments, terminal });
    }

    return structuredClone({ start: 0, end, tracks });
  }
}

/** Reports expose accepted counts and deadlines; queries never enforce a chart-specific cap. */
export function effectStateAt(report: EffectReport, track: EffectTrack, at: number) {
  at = canonicalTime(at);
  if (at < report.start || at > report.end) return null;
  if (at === report.end) return { ...track.terminal };
  let low = 0,
    high = track.segments.length;
  while (low < high) {
    const middle = (low + high) >>> 1;
    if (track.segments[middle]!.end <= at) low = middle + 1;
    else high = middle;
  }

  const segment = track.segments[low];
  return segment && segment.start <= at
    ? { count: segment.count, expiresAt: segment.expiresAt, source: segment.source }
    : { count: 0, expiresAt: at, source: undefined };
}

/** Integrate exact segments so zoom and sample spacing never change uptime or average counts. */
export function effectSummary(track: EffectTrack, start: number, end: number) {
  let active = 0,
    counts = 0,
    maximum = 0;
  for (const segment of track.segments) {
    const elapsed = Math.max(0, Math.min(end, segment.end) - Math.max(start, segment.start));
    if (segment.count > 0) active += elapsed;
    counts += elapsed * segment.count;
    if (segment.countLimit != null && segment.count >= segment.countLimit) maximum += elapsed;
  }

  const duration = Math.max(0, end - start);
  return {
    uptime: duration > 0 ? active / duration : 0,
    averageStacks: duration > 0 ? counts / duration : 0,
    ...(track.countLimit == null || track.measure === 'remaining-duration'
      ? {}
      : { maximumStacks: track.countLimit, maximumStackUptime: duration > 0 ? maximum / duration : 0 })
  };
}
