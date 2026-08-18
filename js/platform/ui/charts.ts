import type { Gw2ResolverEvent, Gw2ResolverResult } from '../gw2/types.js';
import { remainingDurationStackSeconds } from '../gw2/boon-state.js';
import { escapeHtml } from './html.js';

export interface ChartPoint {
  readonly t: number;
  readonly v: number;
}

// One resolved hit/tick: time (ms, relative to the DPS window), damage, and
// whether it critically struck (null when the run is deterministic and crits
// are expected values rather than a per-hit yes/no).
export interface SkillHit {
  readonly t: number;
  readonly v: number;
  readonly crit?: boolean | null;
}

export type ChartEffectType = 'boon' | 'condition' | 'buff';

export interface ChartSeries {
  readonly durationMs: number;
  readonly dps: readonly ChartPoint[];
  readonly effects: Readonly<Record<string, readonly ChartPoint[]>>;
  readonly effectTypes?: Readonly<Record<string, ChartEffectType>>;
  readonly effectUnits?: Readonly<Record<string, string>>;
  readonly cumulativeDamage?: readonly ChartPoint[];
  // Individual hits/ticks per skill breakdown row key (`group|name`), each
  // timestamped relative to the DPS window. Backs the per-skill damage-events
  // timeline (in the table) and the hit-marker strip on the DPS chart.
  readonly skillDamage?: Readonly<Record<string, readonly SkillHit[]>>;
  // Display name per skill key, for timeline labels and tooltips.
  readonly skillNames?: Readonly<Record<string, string>>;
}

export interface ChartHealthBreakpoint {
  readonly healthPercent: number;
  readonly elapsed: number;
  readonly damage?: number;
}

export interface ChartOptions {
  readonly title: string;
  readonly dpsLabel: string;
  readonly dpsColor: string;
  readonly colors: Readonly<Record<string, string>>;
  readonly defaultVisibleEffectLimit: number;
  readonly emptyEffectsText: string;
  readonly healthBreakpoints: readonly ChartHealthBreakpoint[];
  readonly healthBreakpointColor: string;
  // Colour of the per-skill hit markers on the DPS strip and table timeline.
  readonly skillDamageColor: string;
}

export interface BuildChartSeriesOptions {
  readonly effectName?: (value: unknown, event: Gw2ResolverEvent) => string;
  readonly effectType?: (value: unknown, event: Gw2ResolverEvent) => ChartEffectType;
  readonly replacementGroup?: (value: unknown, event: Gw2ResolverEvent) => string;
  readonly stackCaps?: Readonly<Record<string, number>>;
  readonly durationStackCaps?: Readonly<Record<string, number>>;
  // Attributes a resolved damage/condition event to a skill breakdown row key
  // (`group|name`), or null to omit it from the per-skill damage series.
  readonly skillKey?: (event: Gw2ResolverEvent) => string | null;
  // Human-readable label for a skill key, used by the skill-damage panel.
  readonly skillName?: (key: string, event: Gw2ResolverEvent) => string;
}

interface ChartEffectApplication {
  readonly name: string;
  readonly type: ChartEffectType;
  readonly start: number;
  readonly end: number;
  readonly stacks: number;
  readonly replacementGroup: string;
}

interface ChartLine {
  readonly name: string;
  readonly color: string;
  readonly points: readonly ChartPoint[];
}

interface ChartMarker {
  readonly label: string;
  readonly color: string;
  readonly healthPercent: number;
  readonly timeMs: number;
  readonly damage: number;
}

interface ChartFightPhase {
  readonly id: string;
  readonly label: string;
  readonly enabled: boolean;
  readonly startMs: number;
  readonly endMs: number;
  readonly startDamage: number;
  readonly endDamage: number;
}

interface ChartDpsView {
  readonly label: string;
  readonly durationMs: number;
  readonly dps: readonly ChartPoint[];
  readonly markers: readonly ChartMarker[];
}

interface ChartEffectsView {
  readonly durationMs: number;
  readonly effects: Readonly<Record<string, readonly ChartPoint[]>>;
}

interface ChartLayout {
  readonly cssWidth: number;
  readonly height: number;
  readonly pad: {
    readonly top: number;
    readonly right: number;
    readonly bottom: number;
    readonly left: number;
  };
  readonly plotWidth: number;
  readonly plotHeight: number;
}

function eventDamageTicks(event: Gw2ResolverEvent): Array<{ at: number; damage: number }> {
  return Array.isArray(event.damageTicks) ? (event.damageTicks as Array<{ at: number; damage: number }>) : [];
}

export function chartValueAt(points: readonly ChartPoint[], time: number): number {
  if (!points.length) return 0;
  // Series are step functions: use the latest sample at or before the pointer.
  let value = Number(points[0]!.v || 0);
  for (const point of points) {
    if (Number(point.t || 0) > time) break;
    value = Number(point.v || 0);
  }
  return value;
}

export function buildChartSeries(
  result: Gw2ResolverResult,
  sampleStepMs = 250,
  {
    effectName = (value) => String(value || ''),
    effectType = (_value, event) => (event.type === 'condition' ? 'condition' : 'buff'),
    replacementGroup = () => '',
    stackCaps = {},
    durationStackCaps = {},
    skillKey,
    skillName
  }: BuildChartSeriesOptions = {}
): ChartSeries {
  // Chart time is relative to the DPS window, while simulation events use
  // absolute seconds. Keep the conversion at this boundary.
  const dpsStartMs = Math.max(0, Number(result.dpsStartTime ?? result.firstHitTime ?? 0) * 1000);
  const endMs = Math.max(
    dpsStartMs,
    Math.round(
      Number(
        result.deathTime ??
          (result.dpsWindow != null
            ? Number(result.dpsStartTime || 0) + Number(result.dpsWindow)
            : Number(result.duration || 0))
      ) * 1000
    )
  );
  const durationMs = Math.max(1, endMs - dpsStartMs);
  const interval = Math.max(50, Math.min(1000, Number(sampleStepMs) || 250));
  const times: number[] = [];
  for (let time = 0; time < durationMs; time += interval) times.push(time);
  times.push(durationMs);
  const resolved = result.resolvedEvents || [];
  const damageEvents = resolved.filter(
    (event) =>
      (event.type === 'damage' || event.type === 'condition') &&
      (Number(event.damage || 0) > 0 || eventDamageTicks(event).some((tick) => Number(tick.damage || 0) > 0))
  );
  const dps = times.map((time) => {
    const elapsed = time / 1000;
    if (elapsed <= 0) return { t: time, v: 0 };
    const absoluteTime = dpsStartMs + time;
    let damage = 0;
    for (const event of damageEvents) {
      const damageTicks = eventDamageTicks(event);
      if (damageTicks.length) {
        // Condition applications store aggregate damage plus individual ticks;
        // use ticks to avoid showing future condition damage too early.
        damage += damageTicks
          .filter((tick) => Number(tick.at || 0) * 1000 <= absoluteTime)
          .reduce((sum, tick) => sum + Number(tick.damage || 0), 0);
      } else if (Number(event.at || 0) * 1000 <= absoluteTime) {
        damage += Number(event.damage || 0);
      }
    }
    return { t: time, v: damage / elapsed };
  });
  const applications: ChartEffectApplication[] = [];
  // Convert conditions and buffs to half-open [start, end) stack intervals.
  for (const event of resolved) {
    if (event.type !== 'condition') continue;
    const start = Number(event.at || 0) * 1000 - dpsStartMs;
    const end =
      Number(
        event.naturalExpiresAt ??
          event.expiresAt ??
          Number(event.at || 0) + Number(event.effectiveDuration ?? event.duration ?? 0)
      ) *
        1000 -
      dpsStartMs;
    if (end > start) {
      applications.push({
        name: effectName(event.condition, event),
        type: effectType(event.condition, event),
        start,
        end,
        stacks: Number(event.stacks || 1),
        replacementGroup: replacementGroup(event.condition, event)
      });
    }
  }
  for (const event of result.events || []) {
    if (event.type !== 'buff' || event.affectsSelf === false || !Number(event.duration || 0)) continue;
    const start = Number(event.at || 0) * 1000 - dpsStartMs;
    applications.push({
      name: effectName(event.kind, event),
      type: effectType(event.kind, event),
      start,
      end: start + Number(event.duration) * 1000,
      stacks: Number(event.stacks || 1),
      replacementGroup: replacementGroup(event.kind, event)
    });
  }
  const effects: Record<string, ChartPoint[]> = {};
  const effectTypes: Record<string, ChartEffectType> = {};
  for (const name of new Set(applications.map((entry) => entry.name))) {
    const matching = applications
      .filter((entry) => entry.name === name)
      .sort((left, right) => left.start - right.start);
    effectTypes[name] = matching[0]?.type || 'buff';
    const durationApplications = matching.map((entry) => ({
      at: entry.start / 1000,
      duration: (entry.end - entry.start) / 1000,
      stacks: entry.stacks
    }));
    effects[name] = times.map((time) => {
      if (durationStackCaps[name] != null) {
        return {
          t: time,
          v: remainingDurationStackSeconds(durationApplications, time / 1000, {
            maximum: durationStackCaps[name]
          })
        };
      }
      const activeReplacements = new Map<string, (typeof applications)[number]>();
      for (const entry of applications) {
        if (!entry.replacementGroup || entry.start > time) continue;
        const active = activeReplacements.get(entry.replacementGroup);
        if (!active || entry.start >= active.start) {
          activeReplacements.set(entry.replacementGroup, entry);
        }
      }
      return {
        t: time,
        v: Math.min(
          stackCaps[name] ?? Infinity,
          matching.reduce(
            (sum, entry) =>
              sum +
              (entry.start <= time &&
              entry.end > time &&
              (!entry.replacementGroup || activeReplacements.get(entry.replacementGroup) === entry)
                ? entry.stacks
                : 0),
            0
          )
        )
      };
    });
  }
  const cumulativeDamage = dps.map((point) => ({
    t: point.t,
    v: point.v * (point.t / 1000)
  }));
  const skillDamage: Record<string, SkillHit[]> = {};
  const skillNames: Record<string, string> = {};
  if (skillKey) {
    // Each strike is one hit at its time; conditions expand to a hit per
    // damaging tick. Times are relative to the DPS window, matching `dps`.
    for (const event of damageEvents) {
      const key = skillKey(event);
      if (!key) continue;
      const hits = skillDamage[key] || (skillDamage[key] = []);
      if (skillName && skillNames[key] == null) {
        skillNames[key] = skillName(key, event);
      }
      const crit = event.didCrit ?? null;
      const damageTicks = eventDamageTicks(event);
      if (damageTicks.length) {
        // Condition ticks are neither critical nor non-critical strikes.
        for (const tick of damageTicks) {
          const value = Number(tick.damage || 0);
          const time = Number(tick.at || 0) * 1000 - dpsStartMs;
          if (value > 0 && time >= 0 && time <= durationMs) {
            hits.push({ t: time, v: value, crit: null });
          }
        }
      } else {
        const value = Number(event.damage || 0);
        const time = Number(event.at || 0) * 1000 - dpsStartMs;
        if (value > 0 && time >= 0 && time <= durationMs) {
          hits.push({ t: time, v: value, crit });
        }
      }
    }
    for (const key of Object.keys(skillDamage)) {
      skillDamage[key]!.sort((left, right) => left.t - right.t);
    }
  }
  return {
    durationMs,
    dps,
    effects,
    effectTypes,
    effectUnits: Object.fromEntries(Object.keys(durationStackCaps).map((name) => [name, 's'])),
    cumulativeDamage,
    skillDamage,
    skillNames
  };
}

const DEFAULT_OPTIONS: ChartOptions = {
  title: 'DPS & Effects Over Time',
  dpsLabel: 'DPS',
  dpsColor: '#54c96b',
  colors: {},
  defaultVisibleEffectLimit: 8,
  emptyEffectsText: 'No timed effects in this rotation',
  healthBreakpoints: [],
  healthBreakpointColor: '#e1c070',
  skillDamageColor: '#b57ce0'
};
interface ActiveChartMount {
  readonly token: object;
  resizeObserver?: ResizeObserver;
}

const ACTIVE_MOUNTS = new WeakMap<HTMLElement, ActiveChartMount>();

const chartNumber = (value: unknown): string => {
  const number = Number(value || 0);
  if (number >= 1_000_000) return `${(number / 1_000_000).toFixed(1)}m`;
  if (number >= 1000) {
    return `${(number / 1000).toFixed(number >= 10_000 ? 0 : 1)}k`;
  }
  return number.toFixed(number < 10 && number % 1 ? 1 : 0);
};

function niceAxisMaximum(value: number): number {
  if (!(value > 0)) return 1;
  // Use familiar 1/2/5/10 axis bounds instead of arbitrary maxima.
  const magnitude = 10 ** Math.floor(Math.log10(value));
  const normalized = value / magnitude;
  const rounded = normalized <= 1 ? 1 : normalized <= 2 ? 2 : normalized <= 5 ? 5 : 10;
  return rounded * magnitude;
}

function fallbackColor(index: number): string {
  return `hsl(${(index * 61 + 210) % 360} 62% 62%)`;
}

function healthBreakpointMarkers(
  breakpoints: readonly ChartHealthBreakpoint[],
  durationMs: number,
  color: string
): ChartMarker[] {
  const seen = new Set<number>();
  return breakpoints
    .map((breakpoint) => ({
      healthPercent: Number(breakpoint.healthPercent),
      timeMs: Number(breakpoint.elapsed) * 1000,
      damage: Number(breakpoint.damage)
    }))
    .filter(({ healthPercent, timeMs }) => {
      if (
        !Number.isFinite(healthPercent) ||
        !Number.isFinite(timeMs) ||
        healthPercent <= 0 ||
        healthPercent >= 100 ||
        timeMs < 0 ||
        timeMs > durationMs + 1 ||
        seen.has(healthPercent)
      ) {
        return false;
      }
      seen.add(healthPercent);
      return true;
    })
    .map((breakpoint) => ({
      ...breakpoint,
      timeMs: Math.min(durationMs, breakpoint.timeMs)
    }))
    .sort((left, right) => left.timeMs - right.timeMs)
    .map(({ healthPercent, timeMs, damage }) => ({
      label: `${chartNumber(healthPercent)}%`,
      color,
      healthPercent,
      timeMs,
      damage
    }));
}

const FIGHT_PHASE_RANGES = [
  { id: '100-80', label: '100–80%', startHealth: 100, endHealth: 80 },
  { id: '80-60', label: '80–60%', startHealth: 80, endHealth: 60 },
  { id: '60-40', label: '60–40%', startHealth: 60, endHealth: 40 },
  { id: '40-20', label: '40–20%', startHealth: 40, endHealth: 20 },
  { id: '20-0', label: '20–0%', startHealth: 20, endHealth: 0 }
] as const;

function fightPhases(series: ChartSeries, markers: readonly ChartMarker[]): ChartFightPhase[] {
  const cumulativeDamage = series.cumulativeDamage || [];
  const finalDamage = Number(cumulativeDamage.at(-1)?.v);
  const boundaries = new Map<number, { readonly timeMs: number; readonly damage: number }>([
    [100, { timeMs: 0, damage: 0 }]
  ]);
  for (const marker of markers) {
    if (Number.isFinite(marker.damage)) {
      boundaries.set(marker.healthPercent, {
        timeMs: marker.timeMs,
        damage: marker.damage
      });
    }
  }
  if (Number.isFinite(finalDamage)) {
    boundaries.set(0, {
      timeMs: series.durationMs,
      damage: finalDamage
    });
  }

  return [
    {
      id: 'full',
      label: 'Full Fight',
      enabled: true,
      startMs: 0,
      endMs: series.durationMs,
      startDamage: 0,
      endDamage: Number.isFinite(finalDamage) ? finalDamage : 0
    },
    ...FIGHT_PHASE_RANGES.map((range) => {
      const start = boundaries.get(range.startHealth);
      const end = boundaries.get(range.endHealth);
      const enabled = Boolean(start && end && end.timeMs > start.timeMs && end.damage >= start.damage);
      return {
        id: range.id,
        label: range.label,
        enabled,
        startMs: start?.timeMs || 0,
        endMs: end?.timeMs || 0,
        startDamage: start?.damage || 0,
        endDamage: end?.damage || 0
      };
    })
  ];
}

export function buildPhaseDpsSeries(
  cumulativeDamage: readonly ChartPoint[],
  startMs: number,
  endMs: number,
  startDamage: number,
  endDamage: number
): ChartPoint[] {
  const durationMs = Math.max(0, endMs - startMs);
  if (!(durationMs > 0)) return [];
  const points: ChartPoint[] = [{ t: 0, v: 0 }];
  for (const point of cumulativeDamage) {
    const timeMs = Number(point.t);
    if (!(timeMs > startMs && timeMs < endMs)) continue;
    const elapsedMs = timeMs - startMs;
    points.push({
      t: elapsedMs,
      v: Math.max(0, Number(point.v) - startDamage) / Math.max(0.001, elapsedMs / 1000)
    });
  }
  points.push({
    t: durationMs,
    v: Math.max(0, endDamage - startDamage) / Math.max(0.001, durationMs / 1000)
  });
  return points;
}

export function buildPhaseEffectSeries(points: readonly ChartPoint[], startMs: number, endMs: number): ChartPoint[] {
  const durationMs = Math.max(0, endMs - startMs);
  if (!points.length || !(durationMs > 0)) return [];
  return [
    { t: 0, v: chartValueAt(points, startMs) },
    ...points
      .filter((point) => point.t > startMs && point.t < endMs)
      .map((point) => ({ t: point.t - startMs, v: point.v })),
    { t: durationMs, v: chartValueAt(points, endMs) }
  ];
}

function dpsViewForPhase(series: ChartSeries, markers: readonly ChartMarker[], phase: ChartFightPhase): ChartDpsView {
  if (phase.id === 'full') {
    return {
      label: phase.label,
      durationMs: series.durationMs,
      dps: series.dps,
      markers
    };
  }
  return {
    label: phase.label,
    durationMs: phase.endMs - phase.startMs,
    dps: buildPhaseDpsSeries(
      series.cumulativeDamage || [],
      phase.startMs,
      phase.endMs,
      phase.startDamage,
      phase.endDamage
    ),
    markers: markers
      .filter((marker) => marker.timeMs >= phase.startMs && marker.timeMs <= phase.endMs)
      .map((marker) => ({
        ...marker,
        timeMs: marker.timeMs - phase.startMs
      }))
  };
}

function effectsViewForPhase(series: ChartSeries, phase: ChartFightPhase): ChartEffectsView {
  if (phase.id === 'full') {
    return {
      durationMs: series.durationMs,
      effects: series.effects
    };
  }
  return {
    durationMs: phase.endMs - phase.startMs,
    effects: Object.fromEntries(
      Object.entries(series.effects).map(([name, points]) => [
        name,
        buildPhaseEffectSeries(points, phase.startMs, phase.endMs)
      ])
    )
  };
}

function drawLineChart(
  canvas: HTMLCanvasElement | null | undefined,
  lines: readonly ChartLine[],
  durationMs: number,
  {
    height = 260,
    emptyText = '',
    markers = []
  }: {
    readonly height?: number;
    readonly emptyText?: string;
    readonly markers?: readonly ChartMarker[];
  } = {}
): ChartLayout | null {
  if (!canvas?.getContext) return null;
  const cssWidth = Math.max(
    1,
    Math.floor(canvas.parentElement?.clientWidth || canvas.closest?.('.chart-wrap')?.clientWidth || 760)
  );
  const dpr = Math.max(1, Number(globalThis.window?.devicePixelRatio) || 1);
  // Separate backing-store pixels from CSS dimensions for sharp HiDPI lines.
  canvas.width = Math.round(cssWidth * dpr);
  canvas.height = Math.round(height * dpr);
  canvas.style.width = `${cssWidth}px`;
  canvas.style.height = `${height}px`;
  const context = canvas.getContext('2d');
  if (!context) return null;
  context.setTransform(dpr, 0, 0, dpr, 0, 0);
  context.clearRect(0, 0, cssWidth, height);

  const pad = {
    top: markers.length ? 28 : 16,
    right: 16,
    bottom: 28,
    left: 54
  };
  const plotWidth = cssWidth - pad.left - pad.right;
  const plotHeight = height - pad.top - pad.bottom;
  const maxValue = niceAxisMaximum(
    Math.max(0, ...lines.flatMap((line) => line.points.map((point) => Number(point.v || 0))))
  );
  context.font = '10px sans-serif';
  context.lineWidth = 1;
  context.textBaseline = 'middle';

  for (let index = 0; index <= 5; index += 1) {
    const ratio = index / 5;
    const y = pad.top + plotHeight * (1 - ratio);
    context.strokeStyle = 'rgba(255,255,255,.08)';
    context.beginPath();
    context.moveTo(pad.left, y);
    context.lineTo(cssWidth - pad.right, y);
    context.stroke();
    context.fillStyle = '#8d8d9f';
    context.textAlign = 'right';
    context.fillText(chartNumber(maxValue * ratio), pad.left - 7, y);

    const x = pad.left + plotWidth * ratio;
    context.textAlign = 'center';
    context.textBaseline = 'top';
    context.fillText(
      `${((durationMs * ratio) / 1000).toFixed(durationMs < 10_000 ? 1 : 0)}s`,
      x,
      height - pad.bottom + 8
    );
    context.textBaseline = 'middle';
  }

  const markerGroups = new Map<number, ChartMarker[]>();
  for (const marker of markers) {
    const group = markerGroups.get(marker.timeMs) || [];
    group.push(marker);
    markerGroups.set(marker.timeMs, group);
  }
  for (const [timeMs, group] of markerGroups) {
    const x = pad.left + (timeMs / durationMs) * plotWidth;
    context.save();
    context.strokeStyle = group[0]!.color;
    context.lineWidth = 1;
    context.setLineDash([4, 4]);
    context.beginPath();
    context.moveTo(x, pad.top);
    context.lineTo(x, pad.top + plotHeight);
    context.stroke();
    context.restore();

    context.fillStyle = group[0]!.color;
    context.font = 'bold 10px sans-serif';
    context.textBaseline = 'middle';
    context.textAlign = x < pad.left + 24 ? 'left' : x > cssWidth - pad.right - 24 ? 'right' : 'center';
    context.fillText(group.map((marker) => marker.label).join(' / '), x, pad.top - 10);
  }

  for (const line of lines) {
    if (!line.points.length) continue;
    context.strokeStyle = line.color;
    context.lineWidth = 2;
    context.beginPath();
    line.points.forEach((point, index) => {
      const x = pad.left + (Number(point.t || 0) / durationMs) * plotWidth;
      const y = pad.top + (1 - Number(point.v || 0) / maxValue) * plotHeight;
      if (index === 0) context.moveTo(x, y);
      else context.lineTo(x, y);
    });
    context.stroke();
  }

  if (!lines.length && emptyText) {
    context.fillStyle = '#8d8d9f';
    context.textAlign = 'center';
    context.fillText(emptyText, pad.left + plotWidth / 2, pad.top + plotHeight / 2);
  }

  return {
    cssWidth,
    height,
    pad,
    plotWidth,
    plotHeight
  };
}

// Shared horizontal padding so a standalone hit strip lines up with the DPS
// line chart drawn above it (same left axis gutter, same right margin).
const HIT_TIMELINE_PAD = { right: 16, left: 54 } as const;

interface HitTimelineOptions {
  readonly height?: number;
  readonly color?: string;
  readonly label?: string;
  readonly emptyText?: string;
  // When true, draws a time axis (0s…end) beneath the markers.
  readonly showAxis?: boolean;
}

// Draws hit markers along a single time lane. Marker height encodes relative
// damage so heavier hits read as taller ticks; returns a layout for hover
// hit-testing (with the marker time baked into each point).
function drawHitTimeline(
  canvas: HTMLCanvasElement | null | undefined,
  hits: readonly SkillHit[],
  durationMs: number,
  { height = 64, color = '#b57ce0', label = '', emptyText = '', showAxis = true }: HitTimelineOptions = {}
): ChartLayout | null {
  if (!canvas?.getContext) return null;
  const cssWidth = Math.max(
    1,
    Math.floor(
      canvas.parentElement?.clientWidth ||
        canvas.closest?.('.chart-wrap')?.clientWidth ||
        canvas.closest?.('.res-skill-timeline')?.clientWidth ||
        760
    )
  );
  const dpr = Math.max(1, Number(globalThis.window?.devicePixelRatio) || 1);
  canvas.width = Math.round(cssWidth * dpr);
  canvas.height = Math.round(height * dpr);
  canvas.style.width = `${cssWidth}px`;
  canvas.style.height = `${height}px`;
  const context = canvas.getContext('2d');
  if (!context) return null;
  context.setTransform(dpr, 0, 0, dpr, 0, 0);
  context.clearRect(0, 0, cssWidth, height);

  const pad = {
    top: label ? 18 : 10,
    right: HIT_TIMELINE_PAD.right,
    bottom: showAxis ? 18 : 8,
    left: HIT_TIMELINE_PAD.left
  };
  const plotWidth = cssWidth - pad.left - pad.right;
  const plotHeight = height - pad.top - pad.bottom;
  context.font = '10px sans-serif';
  context.textBaseline = 'middle';

  if (label) {
    context.fillStyle = '#8d8d9f';
    context.textAlign = 'left';
    context.textBaseline = 'top';
    context.fillText(label.toUpperCase(), pad.left, 3);
    context.textBaseline = 'middle';
  }

  // Baseline the markers sit on.
  const baseY = pad.top + plotHeight;
  context.strokeStyle = 'rgba(255,255,255,.14)';
  context.lineWidth = 1;
  context.beginPath();
  context.moveTo(pad.left, baseY);
  context.lineTo(cssWidth - pad.right, baseY);
  context.stroke();

  if (showAxis) {
    context.fillStyle = '#8d8d9f';
    context.textBaseline = 'top';
    for (let index = 0; index <= 5; index += 1) {
      const ratio = index / 5;
      const x = pad.left + plotWidth * ratio;
      context.textAlign = index === 0 ? 'left' : index === 5 ? 'right' : 'center';
      context.fillText(`${((durationMs * ratio) / 1000).toFixed(durationMs < 10_000 ? 1 : 0)}s`, x, baseY + 5);
    }
    context.textBaseline = 'middle';
  }

  const maxValue = Math.max(1, ...hits.map((hit) => Number(hit.v || 0)));
  const minMarker = Math.min(plotHeight, 8);
  context.strokeStyle = color;
  context.lineWidth = 2;
  for (const hit of hits) {
    const value = Number(hit.v || 0);
    if (!(value > 0)) continue;
    const x = pad.left + (Number(hit.t || 0) / durationMs) * plotWidth;
    // Scale each marker between a floor and the lane height by relative damage.
    const markerHeight = minMarker + (plotHeight - minMarker) * (value / maxValue);
    context.beginPath();
    context.moveTo(x, baseY);
    context.lineTo(x, baseY - markerHeight);
    context.stroke();
  }

  if (!hits.length && emptyText) {
    context.fillStyle = '#8d8d9f';
    context.textAlign = 'center';
    context.fillText(emptyText, pad.left + plotWidth / 2, pad.top + plotHeight / 2);
  }

  return { cssWidth, height, pad, plotWidth, plotHeight };
}

// Discrete hits windowed to a fight phase (no interpolation): keep those inside
// [startMs, endMs) and re-base their timestamps to the phase.
function filterHitsToPhase(hits: readonly SkillHit[], startMs: number, endMs: number): SkillHit[] {
  if (!hits.length || !(endMs > startMs)) return [];
  return hits
    .filter((hit) => hit.t >= startMs && hit.t < endMs)
    .map((hit) => ({ t: hit.t - startMs, v: hit.v, crit: hit.crit }));
}

// Shared hover for a hit lane: snaps to the nearest marker within a few pixels
// and reports its time, damage, and crit state.
function bindHitTimelineHover(
  canvas: HTMLCanvasElement | null | undefined,
  tooltip: HTMLElement | null | undefined,
  state: {
    readonly layout: () => ChartLayout | null;
    readonly hits: () => readonly SkillHit[];
    readonly durationMs: () => number;
    readonly label: () => string;
  }
): void {
  if (!canvas || !tooltip) return;
  canvas.onmouseleave = () => {
    tooltip.style.display = 'none';
  };
  canvas.onmousemove = (event) => {
    const layout = state.layout();
    if (!layout) return;
    const rect = canvas.getBoundingClientRect();
    const scaleX = layout.cssWidth / Math.max(1, rect.width);
    const pointerX = event.clientX - rect.left;
    const pointerY = event.clientY - rect.top;
    const chartX = pointerX * scaleX;
    const durationMs = state.durationMs();
    const time = ((chartX - layout.pad.left) / Math.max(1, layout.plotWidth)) * durationMs;
    const toleranceMs = (7 * durationMs) / Math.max(1, layout.plotWidth);
    let nearest: SkillHit | null = null;
    let nearestDistance = Infinity;
    for (const hit of state.hits()) {
      const distance = Math.abs(Number(hit.t || 0) - time);
      if (distance < nearestDistance) {
        nearestDistance = distance;
        nearest = hit;
      }
    }
    if (!nearest || nearestDistance > toleranceMs) {
      tooltip.style.display = 'none';
      return;
    }
    const critLine = nearest.crit == null ? '' : `<div>Critical: ${nearest.crit ? 'Yes' : 'No'}</div>`;
    const label = state.label();
    tooltip.innerHTML =
      `<div><b>${(Number(nearest.t || 0) / 1000).toFixed(2)}s</b></div>` +
      (label ? `<div>${escapeHtml(label)}</div>` : '') +
      `<div>Damage: ${Math.round(Number(nearest.v || 0)).toLocaleString()}</div>` +
      critLine;
    tooltip.style.left = `${pointerX + 12}px`;
    tooltip.style.top = `${pointerY + 12}px`;
    tooltip.style.display = 'block';
  };
}

function chartHtml(
  series: ChartSeries,
  options: ChartOptions,
  healthMarkers: readonly ChartMarker[],
  phases: readonly ChartFightPhase[]
): string {
  const effects = Object.keys(series.effects || {});
  const visibleEffects = new Set(effects.slice(0, Math.max(0, options.defaultVisibleEffectLimit)));
  const effectIndexes = new Map(effects.map((name, index) => [name, index]));
  const effectGroups: readonly {
    type: ChartEffectType;
    label: string;
  }[] = [
    { type: 'boon', label: 'Boons' },
    { type: 'condition', label: 'Conditions' },
    { type: 'buff', label: 'Buffs' }
  ];
  // Effect visibility checkboxes live with the Effects Over Time panel they
  // control (below the DPS graph).
  const effectTogglesMarkup = `<div class="chart-toggles" data-role="chart-toggles">
      ${effectGroups
        .map(({ type, label }) => {
          const groupEffects = effects
            .filter((name) => (series.effectTypes?.[name] || 'buff') === type)
            .sort((left, right) => left.localeCompare(right));
          if (!groupEffects.length) return '';
          return `<div class="chart-toggle-group" data-role="chart-toggle-group" data-effect-type="${type}">
        <div class="chart-toggle-group-header">
          <span class="chart-toggle-label">${label}</span>
          <span class="chart-toggle-actions" aria-label="${label} visibility">
            <button type="button" data-toggle-action="all">All</button><span aria-hidden="true">/</span><button type="button" data-toggle-action="none">None</button>
          </span>
        </div>
        <div class="chart-toggle-items">
          ${groupEffects
            .map((name) => {
              const index = effectIndexes.get(name) || 0;
              return `<label>
            <input type="checkbox" data-series="${escapeHtml(name)}" ${visibleEffects.has(name) ? 'checked' : ''} />
            <span class="swatch" style="background:${escapeHtml(options.colors[name] || fallbackColor(index))}"></span>
            ${escapeHtml(`${name}${series.effectUnits?.[name] ? ` (${series.effectUnits[name]})` : ''}`)}
          </label>`;
            })
            .join('')}
        </div>
      </div>`;
        })
        .join('')}
    </div>`;
  return `<div class="chart-wrap">
    <div class="chart-title">${escapeHtml(options.title)}</div>
    ${
      healthMarkers.length
        ? `<div class="chart-phase-toggles" data-role="chart-phase-toggles">
      <span class="chart-toggle-label">Chart range</span>
      ${phases
        .map(
          (phase) => `<button type="button"
        data-chart-phase="${escapeHtml(phase.id)}"
        aria-pressed="${phase.id === 'full' ? 'true' : 'false'}"
        ${phase.enabled ? '' : 'disabled title="Target health range not reached"'}>
        ${escapeHtml(phase.label)}
      </button>`
        )
        .join('')}
    </div>`
        : ''
    }
    <div class="chart-panels">
      <div class="chart-panel">
        <div class="chart-panel-title" data-role="dps-panel-title">${escapeHtml(options.dpsLabel)} Over Time</div>
        <div class="chart-canvas-wrap">
          <canvas class="chart-canvas" data-role="dps-canvas"></canvas>
          <div class="chart-tooltip" data-role="dps-tooltip"></div>
        </div>
        <div class="chart-hit-strip" data-role="dps-hit-strip" hidden>
          <div class="chart-canvas-wrap">
            <canvas class="chart-canvas" data-role="dps-hit-canvas"></canvas>
            <div class="chart-tooltip" data-role="dps-hit-tooltip"></div>
          </div>
        </div>
      </div>
      <div class="chart-panel">
        <div class="chart-panel-title" data-role="effects-panel-title">Effects Over Time</div>
        ${effectTogglesMarkup}
        <div class="chart-canvas-wrap">
          <canvas class="chart-canvas" data-role="effects-canvas"></canvas>
          <div class="chart-tooltip" data-role="effects-tooltip"></div>
        </div>
      </div>
    </div>
  </div>`;
}

/**
 * Replaces `container` with a complete, container-scoped time-series chart.
 * Replacing the contents also makes repeated mounts safe from duplicate
 * handlers.
 */
export function mountTimeSeriesCharts(
  container: HTMLElement | null | undefined,
  series: ChartSeries,
  options: Partial<ChartOptions> = {}
): {
  redraw: () => void;
  setSelectedSkill: (key: string | null) => void;
} | null {
  if (!container) return null;
  // A token makes a queued animation-frame redraw from an older mount harmless.
  ACTIVE_MOUNTS.get(container)?.resizeObserver?.disconnect();
  const mountToken = {};
  const activeMount: ActiveChartMount = { token: mountToken };
  ACTIVE_MOUNTS.set(container, activeMount);
  const resolvedDps = series?.dps || [];
  const resolvedSeries: ChartSeries = {
    durationMs: Math.max(1, Number(series?.durationMs || 0)),
    dps: resolvedDps,
    effects: series?.effects || {},
    effectTypes: series?.effectTypes || {},
    effectUnits: series?.effectUnits || {},
    cumulativeDamage:
      series?.cumulativeDamage ||
      resolvedDps.map((point) => ({
        t: point.t,
        v: Number(point.v) * (Number(point.t) / 1000)
      })),
    skillDamage: series?.skillDamage || {},
    skillNames: series?.skillNames || {}
  };
  const resolvedOptions: ChartOptions = {
    ...DEFAULT_OPTIONS,
    ...options,
    colors: { ...DEFAULT_OPTIONS.colors, ...(options.colors || {}) },
    healthBreakpoints: options.healthBreakpoints || []
  };
  const healthMarkers = healthBreakpointMarkers(
    resolvedOptions.healthBreakpoints,
    resolvedSeries.durationMs,
    resolvedOptions.healthBreakpointColor
  );
  const phases = fightPhases(resolvedSeries, healthMarkers);
  let activePhaseId = 'full';
  // Which breakdown row's hits the DPS strip highlights (null until a row is
  // clicked).
  let selectedSkillKey: string | null = null;
  container.innerHTML = chartHtml(resolvedSeries, resolvedOptions, healthMarkers, phases);

  // Cached control roots for toggle/phase state queries during redraw.
  const chartTogglesEl = container.querySelector<HTMLElement>('[data-role="chart-toggles"]');
  const chartPhaseTogglesEl = container.querySelector<HTMLElement>('[data-role="chart-phase-toggles"]');

  const chartState: {
    dpsLayout: ChartLayout | null;
    dpsView: ChartDpsView;
    effectsLayout: ChartLayout | null;
    effectsView: ChartEffectsView;
    effectLines: ChartLine[];
    hitStripLayout: ChartLayout | null;
    hitStripDurationMs: number;
    hitStripHits: SkillHit[];
    hitStripLabel: string;
  } = {
    dpsLayout: null,
    dpsView: dpsViewForPhase(resolvedSeries, healthMarkers, phases[0]!),
    effectsLayout: null,
    effectsView: effectsViewForPhase(resolvedSeries, phases[0]!),
    effectLines: [],
    hitStripLayout: null,
    hitStripDurationMs: resolvedSeries.durationMs,
    hitStripHits: [],
    hitStripLabel: ''
  };

  const redraw = (): void => {
    if (ACTIVE_MOUNTS.get(container)?.token !== mountToken) return;
    const selected = new Set(
      [...(chartTogglesEl?.querySelectorAll<HTMLInputElement>('input:checked') || [])].map(
        (input) => input.dataset.series
      )
    );
    const activePhase = phases.find((phase) => phase.id === activePhaseId && phase.enabled) || phases[0]!;
    chartState.dpsView = dpsViewForPhase(resolvedSeries, healthMarkers, activePhase);
    chartState.effectsView = effectsViewForPhase(resolvedSeries, activePhase);
    const dpsTitle = container.querySelector<HTMLElement>('[data-role="dps-panel-title"]');
    if (dpsTitle) {
      dpsTitle.textContent =
        `${resolvedOptions.dpsLabel} Over Time` + (activePhase.id === 'full' ? '' : ` — ${activePhase.label}`);
    }
    const effectsTitle = container.querySelector<HTMLElement>('[data-role="effects-panel-title"]');
    if (effectsTitle) {
      effectsTitle.textContent = 'Effects Over Time' + (activePhase.id === 'full' ? '' : ` — ${activePhase.label}`);
    }
    // DPS is always shown; only effect series are toggleable.
    chartState.dpsLayout = drawLineChart(
      container.querySelector<HTMLCanvasElement>('[data-role="dps-canvas"]'),
      [
        {
          name: resolvedOptions.dpsLabel,
          color: resolvedOptions.dpsColor,
          points: chartState.dpsView.dps
        }
      ],
      chartState.dpsView.durationMs,
      {
        height: 280,
        emptyText: resolvedOptions.emptyEffectsText,
        markers: chartState.dpsView.markers
      }
    );
    chartState.effectLines = Object.entries(chartState.effectsView.effects)
      .filter(([name]) => selected.has(name))
      .map(([name, points]) => ({
        name,
        points,
        color: resolvedOptions.colors[name] || fallbackColor(Object.keys(resolvedSeries.effects).indexOf(name))
      }));
    chartState.effectsLayout = drawLineChart(
      container.querySelector<HTMLCanvasElement>('[data-role="effects-canvas"]'),
      chartState.effectLines,
      chartState.effectsView.durationMs,
      { height: 260, emptyText: resolvedOptions.emptyEffectsText }
    );

    // Marker strip beneath the DPS line showing the selected skill's hits,
    // aligned to the same time axis as the DPS view above it.
    const hitStrip = container.querySelector<HTMLElement>('[data-role="dps-hit-strip"]');
    const hitCanvas = container.querySelector<HTMLCanvasElement>('[data-role="dps-hit-canvas"]');
    const allHits = (selectedSkillKey && resolvedSeries.skillDamage?.[selectedSkillKey]) || [];
    chartState.hitStripDurationMs = chartState.dpsView.durationMs;
    chartState.hitStripHits = !selectedSkillKey
      ? []
      : activePhase.id === 'full'
        ? [...allHits]
        : filterHitsToPhase(allHits, activePhase.startMs, activePhase.endMs);
    chartState.hitStripLabel = selectedSkillKey
      ? `${resolvedSeries.skillNames?.[selectedSkillKey] || selectedSkillKey} hits`
      : '';
    if (hitStrip) hitStrip.hidden = !selectedSkillKey;
    if (hitCanvas && selectedSkillKey) {
      chartState.hitStripLayout = drawHitTimeline(hitCanvas, chartState.hitStripHits, chartState.hitStripDurationMs, {
        height: 48,
        color: resolvedOptions.skillDamageColor,
        label: chartState.hitStripLabel,
        showAxis: false
      });
    } else {
      chartState.hitStripLayout = null;
    }
  };

  const bindHover = (canvasRole: string, tooltipRole: string, kind: 'dps' | 'effects'): void => {
    const canvas = container.querySelector<HTMLCanvasElement>(`[data-role="${canvasRole}"]`);
    const tooltip = container.querySelector<HTMLElement>(`[data-role="${tooltipRole}"]`);
    if (!canvas || !tooltip) return;

    canvas.onmouseleave = () => {
      tooltip.style.display = 'none';
    };
    canvas.onmousemove = (event) => {
      const layout = kind === 'dps' ? chartState.dpsLayout : chartState.effectsLayout;
      if (!layout) return;

      const rect = canvas.getBoundingClientRect();
      // Canvas CSS size can differ from its logical drawing size.
      const scaleX = layout.cssWidth / Math.max(1, rect.width);
      const scaleY = layout.height / Math.max(1, rect.height);
      const pointerX = event.clientX - rect.left;
      const pointerY = event.clientY - rect.top;
      const chartX = pointerX * scaleX;
      const chartY = pointerY * scaleY;
      const minX = layout.pad.left;
      const maxX = layout.cssWidth - layout.pad.right;
      const minY = layout.pad.top;
      const maxY = layout.pad.top + layout.plotHeight;

      if (chartX < minX || chartX > maxX || chartY < minY || chartY > maxY) {
        tooltip.style.display = 'none';
        return;
      }

      const durationMs = kind === 'dps' ? chartState.dpsView.durationMs : chartState.effectsView.durationMs;
      const time = Math.max(0, Math.min(durationMs, ((chartX - minX) / layout.plotWidth) * durationMs));
      const timeLabel = `${(time / 1000).toFixed(2)}s`;
      let body: string;
      if (kind === 'dps') {
        const dps = Math.round(chartValueAt(chartState.dpsView.dps, time));
        body =
          `<div>${escapeHtml(chartState.dpsView.label)}</div>` +
          `<div>${escapeHtml(resolvedOptions.dpsLabel)}: ${dps.toLocaleString()}</div>`;
      } else {
        const entries = chartState.effectLines
          .map((line) => {
            const value = chartValueAt(line.points, time);
            return {
              name: line.name,
              value,
              displayValue: resolvedSeries.effectUnits?.[line.name]
                ? `${Number(value.toFixed(2))}${resolvedSeries.effectUnits[line.name]}`
                : String(Math.round(value))
            };
          })
          .filter((entry) => entry.value > 0)
          .sort((a, b) => b.value - a.value);
        body = entries.length
          ? entries.map((entry) => `<div>${escapeHtml(entry.name)}: ${escapeHtml(entry.displayValue)}</div>`).join('')
          : '<div>No visible stack effects</div>';
      }

      tooltip.innerHTML = `<div><b>${timeLabel}</b></div>${body}`;
      tooltip.style.left = `${pointerX + 12}px`;
      tooltip.style.top = `${pointerY + 12}px`;
      tooltip.style.display = 'block';
    };
  };

  for (const input of chartTogglesEl?.querySelectorAll<HTMLInputElement>('input') || []) {
    input.onchange = redraw;
  }
  for (const button of chartTogglesEl?.querySelectorAll<HTMLButtonElement>(
    '[data-role="chart-toggle-group"] [data-toggle-action]'
  ) || []) {
    button.onclick = () => {
      const group = button.closest('[data-role="chart-toggle-group"]');
      if (!group) return;
      const checked = button.dataset.toggleAction === 'all';
      for (const input of group.querySelectorAll<HTMLInputElement>('input[type="checkbox"]')) {
        input.checked = checked;
      }
      redraw();
    };
  }
  for (const button of chartPhaseTogglesEl?.querySelectorAll<HTMLButtonElement>('button') || []) {
    button.onclick = () => {
      if (button.disabled) return;
      activePhaseId = button.dataset.chartPhase || 'full';
      for (const phaseButton of chartPhaseTogglesEl?.querySelectorAll<HTMLButtonElement>('button') || []) {
        phaseButton.setAttribute('aria-pressed', String(phaseButton.dataset.chartPhase === activePhaseId));
      }
      redraw();
    };
  }
  bindHover('dps-canvas', 'dps-tooltip', 'dps');
  bindHover('effects-canvas', 'effects-tooltip', 'effects');
  bindHitTimelineHover(
    container.querySelector<HTMLCanvasElement>('[data-role="dps-hit-canvas"]'),
    container.querySelector<HTMLElement>('[data-role="dps-hit-tooltip"]'),
    {
      layout: () => chartState.hitStripLayout,
      hits: () => chartState.hitStripHits,
      durationMs: () => chartState.hitStripDurationMs,
      label: () => chartState.hitStripLabel
    }
  );
  redraw();

  let redrawFrame: number | null = null;
  const requestRedraw = (): void => {
    if (redrawFrame !== null || ACTIVE_MOUNTS.get(container)?.token !== mountToken) {
      return;
    }
    const requestFrame =
      container.ownerDocument?.defaultView?.requestAnimationFrame?.bind(container.ownerDocument.defaultView) ||
      globalThis.requestAnimationFrame;
    if (!requestFrame) {
      redraw();
      return;
    }
    redrawFrame = requestFrame(() => {
      redrawFrame = null;
      redraw();
    });
  };

  const observedCanvas = container.querySelector<HTMLCanvasElement>('[data-role="dps-canvas"]');
  const observedContainer = observedCanvas?.parentElement;
  const ResizeObserverConstructor = container.ownerDocument?.defaultView?.ResizeObserver || globalThis.ResizeObserver;
  if (ResizeObserverConstructor && observedContainer) {
    activeMount.resizeObserver = new ResizeObserverConstructor(() => {
      const visibleWidth = Math.floor(observedContainer.clientWidth);
      if (visibleWidth > 0 && visibleWidth !== chartState.dpsLayout?.cssWidth) {
        requestRedraw();
      }
    });
    activeMount.resizeObserver.observe(observedContainer);
  }
  requestRedraw();
  const setSelectedSkill = (key: string | null): void => {
    const next = key && resolvedSeries.skillDamage?.[key]?.length ? key : null;
    if (next === selectedSkillKey) return;
    selectedSkillKey = next;
    redraw();
  };
  return { redraw, setSelectedSkill };
}

export interface HitTimelineMountOptions {
  readonly durationMs: number;
  readonly color?: string;
  readonly label?: string;
  readonly height?: number;
  readonly emptyText?: string;
}

/**
 * Mounts a standalone damage-events timeline (used inline in the skill table
 * when a row is selected). Renders one marker per hit along a time axis with a
 * hover tooltip; redraws itself on container resize.
 */
export function mountHitTimeline(
  container: HTMLElement | null | undefined,
  hits: readonly SkillHit[],
  { durationMs, color, label, height = 72, emptyText }: HitTimelineMountOptions
): { redraw: () => void } | null {
  if (!container) return null;
  ACTIVE_MOUNTS.get(container)?.resizeObserver?.disconnect();
  const mountToken = {};
  const activeMount: ActiveChartMount = { token: mountToken };
  ACTIVE_MOUNTS.set(container, activeMount);
  container.innerHTML = `<div class="chart-canvas-wrap">
      <canvas class="chart-canvas" data-role="hit-timeline-canvas"></canvas>
      <div class="chart-tooltip" data-role="hit-timeline-tooltip"></div>
    </div>`;
  const canvas = container.querySelector<HTMLCanvasElement>('[data-role="hit-timeline-canvas"]');
  const tooltip = container.querySelector<HTMLElement>('[data-role="hit-timeline-tooltip"]');
  const resolvedDuration = Math.max(1, Number(durationMs) || 0);
  let layout: ChartLayout | null = null;
  const redraw = (): void => {
    if (ACTIVE_MOUNTS.get(container)?.token !== mountToken) return;
    layout = drawHitTimeline(canvas, hits, resolvedDuration, {
      height,
      color,
      label,
      emptyText,
      showAxis: true
    });
  };
  bindHitTimelineHover(canvas, tooltip, {
    layout: () => layout,
    hits: () => hits,
    durationMs: () => resolvedDuration,
    // The owning table row already names the skill, so the tooltip stays terse.
    label: () => ''
  });
  redraw();

  const wrap = canvas?.parentElement;
  const ResizeObserverConstructor = container.ownerDocument?.defaultView?.ResizeObserver || globalThis.ResizeObserver;
  if (ResizeObserverConstructor && wrap) {
    activeMount.resizeObserver = new ResizeObserverConstructor(() => {
      const visibleWidth = Math.floor(wrap.clientWidth);
      if (visibleWidth > 0 && visibleWidth !== layout?.cssWidth) redraw();
    });
    activeMount.resizeObserver.observe(wrap);
  }
  return { redraw };
}
