import type { Gw2ResolverEvent, Gw2ResolverResult } from "../gw2/types.js";
import { escapeHtml } from "./html.js";

export interface ChartPoint {
  readonly t: number;
  readonly v: number;
}

export interface ChartSeries {
  readonly durationMs: number;
  readonly dps: readonly ChartPoint[];
  readonly effects: Readonly<Record<string, readonly ChartPoint[]>>;
  readonly cumulativeDamage?: readonly ChartPoint[];
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
}

export interface BuildChartSeriesOptions {
  readonly effectName?: (value: unknown) => string;
  readonly stackCaps?: Readonly<Record<string, number>>;
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

function eventDamageTicks(
  event: Gw2ResolverEvent,
): Array<{ at: number; damage: number }> {
  return Array.isArray(event.damageTicks)
    ? (event.damageTicks as Array<{ at: number; damage: number }>)
    : [];
}

export function chartValueAt(
  points: readonly ChartPoint[],
  time: number,
): number {
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
    effectName = (value) => String(value || ""),
    stackCaps = {},
  }: BuildChartSeriesOptions = {},
): ChartSeries {
  // Chart time is relative to the DPS window, while simulation events use
  // absolute seconds. Keep the conversion at this boundary.
  const dpsStartMs = Math.max(
    0,
    Number(result.dpsStartTime ?? result.firstHitTime ?? 0) * 1000,
  );
  const endMs = Math.max(
    dpsStartMs,
    Math.round(
      Number(
        result.deathTime ??
          (result.dpsWindow != null
            ? Number(result.dpsStartTime || 0) + Number(result.dpsWindow)
            : Number(result.duration || 0)),
      ) * 1000,
    ),
  );
  const durationMs = Math.max(1, endMs - dpsStartMs);
  const interval = Math.max(50, Math.min(1000, Number(sampleStepMs) || 250));
  const times: number[] = [];
  for (let time = 0; time < durationMs; time += interval) times.push(time);
  times.push(durationMs);
  const resolved = result.resolvedEvents || [];
  const damageEvents = resolved.filter(
    (event) =>
      (event.type === "damage" || event.type === "condition") &&
      (Number(event.damage || 0) > 0 ||
        eventDamageTicks(event).some((tick) => Number(tick.damage || 0) > 0)),
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
  const applications: Array<{
    name: string;
    start: number;
    end: number;
    stacks: number;
  }> = [];
  // Convert conditions and buffs to half-open [start, end) stack intervals.
  for (const event of resolved) {
    if (event.type !== "condition") continue;
    const start = Number(event.at || 0) * 1000 - dpsStartMs;
    const end =
      Number(
        event.naturalExpiresAt ??
          event.expiresAt ??
          Number(event.at || 0) +
            Number(event.effectiveDuration ?? event.duration ?? 0),
      ) *
        1000 -
      dpsStartMs;
    if (end > start) {
      applications.push({
        name: effectName(event.condition),
        start,
        end,
        stacks: Number(event.stacks || 1),
      });
    }
  }
  for (const event of result.events || []) {
    if (
      event.type !== "buff" ||
      event.affectsSelf === false ||
      !Number(event.duration || 0)
    )
      continue;
    const start = Number(event.at || 0) * 1000 - dpsStartMs;
    applications.push({
      name: effectName(event.kind),
      start,
      end: start + Number(event.duration) * 1000,
      stacks: Number(event.stacks || 1),
    });
  }
  const effects: Record<string, ChartPoint[]> = {};
  for (const name of new Set(applications.map((entry) => entry.name))) {
    const matching = applications.filter((entry) => entry.name === name);
    effects[name] = times.map((time) => ({
      t: time,
      v: Math.min(
        stackCaps[name] ?? Infinity,
        matching.reduce(
          (sum, entry) =>
            sum + (entry.start <= time && entry.end > time ? entry.stacks : 0),
          0,
        ),
      ),
    }));
  }
  const cumulativeDamage = dps.map((point) => ({
    t: point.t,
    v: point.v * (point.t / 1000),
  }));
  return {
    durationMs,
    dps,
    effects,
    cumulativeDamage,
  };
}

const DEFAULT_OPTIONS: ChartOptions = {
  title: "DPS & Effects Over Time",
  dpsLabel: "DPS",
  dpsColor: "#54c96b",
  colors: {},
  defaultVisibleEffectLimit: 8,
  emptyEffectsText: "No timed effects in this rotation",
  healthBreakpoints: [],
  healthBreakpointColor: "#e1c070",
};
const ACTIVE_MOUNTS = new WeakMap<HTMLElement, object>();

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
  const rounded =
    normalized <= 1 ? 1 : normalized <= 2 ? 2 : normalized <= 5 ? 5 : 10;
  return rounded * magnitude;
}

function fallbackColor(index: number): string {
  return `hsl(${(index * 61 + 210) % 360} 62% 62%)`;
}

function healthBreakpointMarkers(
  breakpoints: readonly ChartHealthBreakpoint[],
  durationMs: number,
  color: string,
): ChartMarker[] {
  const seen = new Set<number>();
  return breakpoints
    .map((breakpoint) => ({
      healthPercent: Number(breakpoint.healthPercent),
      timeMs: Number(breakpoint.elapsed) * 1000,
      damage: Number(breakpoint.damage),
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
      timeMs: Math.min(durationMs, breakpoint.timeMs),
    }))
    .sort((left, right) => left.timeMs - right.timeMs)
    .map(({ healthPercent, timeMs, damage }) => ({
      label: `${chartNumber(healthPercent)}%`,
      color,
      healthPercent,
      timeMs,
      damage,
    }));
}

const FIGHT_PHASE_RANGES = [
  { id: "100-80", label: "100–80%", startHealth: 100, endHealth: 80 },
  { id: "80-60", label: "80–60%", startHealth: 80, endHealth: 60 },
  { id: "60-40", label: "60–40%", startHealth: 60, endHealth: 40 },
  { id: "40-20", label: "40–20%", startHealth: 40, endHealth: 20 },
  { id: "20-0", label: "20–0%", startHealth: 20, endHealth: 0 },
] as const;

function fightPhases(
  series: ChartSeries,
  markers: readonly ChartMarker[],
): ChartFightPhase[] {
  const cumulativeDamage = series.cumulativeDamage || [];
  const finalDamage = Number(cumulativeDamage.at(-1)?.v);
  const boundaries = new Map<
    number,
    { readonly timeMs: number; readonly damage: number }
  >([[100, { timeMs: 0, damage: 0 }]]);
  for (const marker of markers) {
    if (Number.isFinite(marker.damage)) {
      boundaries.set(marker.healthPercent, {
        timeMs: marker.timeMs,
        damage: marker.damage,
      });
    }
  }
  if (Number.isFinite(finalDamage)) {
    boundaries.set(0, {
      timeMs: series.durationMs,
      damage: finalDamage,
    });
  }

  return [
    {
      id: "full",
      label: "Full Fight",
      enabled: true,
      startMs: 0,
      endMs: series.durationMs,
      startDamage: 0,
      endDamage: Number.isFinite(finalDamage) ? finalDamage : 0,
    },
    ...FIGHT_PHASE_RANGES.map((range) => {
      const start = boundaries.get(range.startHealth);
      const end = boundaries.get(range.endHealth);
      const enabled = Boolean(
        start && end && end.timeMs > start.timeMs && end.damage >= start.damage,
      );
      return {
        id: range.id,
        label: range.label,
        enabled,
        startMs: start?.timeMs || 0,
        endMs: end?.timeMs || 0,
        startDamage: start?.damage || 0,
        endDamage: end?.damage || 0,
      };
    }),
  ];
}

export function buildPhaseDpsSeries(
  cumulativeDamage: readonly ChartPoint[],
  startMs: number,
  endMs: number,
  startDamage: number,
  endDamage: number,
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
      v:
        Math.max(0, Number(point.v) - startDamage) /
        Math.max(0.001, elapsedMs / 1000),
    });
  }
  points.push({
    t: durationMs,
    v:
      Math.max(0, endDamage - startDamage) / Math.max(0.001, durationMs / 1000),
  });
  return points;
}

function dpsViewForPhase(
  series: ChartSeries,
  markers: readonly ChartMarker[],
  phase: ChartFightPhase,
): ChartDpsView {
  if (phase.id === "full") {
    return {
      label: phase.label,
      durationMs: series.durationMs,
      dps: series.dps,
      markers,
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
      phase.endDamage,
    ),
    markers: markers
      .filter(
        (marker) =>
          marker.timeMs >= phase.startMs && marker.timeMs <= phase.endMs,
      )
      .map((marker) => ({
        ...marker,
        timeMs: marker.timeMs - phase.startMs,
      })),
  };
}

function drawLineChart(
  canvas: HTMLCanvasElement | null | undefined,
  lines: readonly ChartLine[],
  durationMs: number,
  {
    height = 260,
    emptyText = "",
    markers = [],
  }: {
    readonly height?: number;
    readonly emptyText?: string;
    readonly markers?: readonly ChartMarker[];
  } = {},
): ChartLayout | null {
  if (!canvas?.getContext) return null;
  const cssWidth = Math.max(
    360,
    Math.floor(
      canvas.parentElement?.clientWidth ||
        canvas.closest?.(".chart-wrap")?.clientWidth ||
        760,
    ),
  );
  const dpr = globalThis.window?.devicePixelRatio || 1;
  // Separate backing-store pixels from CSS dimensions for sharp HiDPI lines.
  canvas.width = Math.round(cssWidth * dpr);
  canvas.height = Math.round(height * dpr);
  canvas.style.height = `${height}px`;
  const context = canvas.getContext("2d");
  if (!context) return null;
  context.setTransform(dpr, 0, 0, dpr, 0, 0);
  context.clearRect(0, 0, cssWidth, height);

  const pad = {
    top: markers.length ? 28 : 16,
    right: 16,
    bottom: 28,
    left: 54,
  };
  const plotWidth = cssWidth - pad.left - pad.right;
  const plotHeight = height - pad.top - pad.bottom;
  const maxValue = niceAxisMaximum(
    Math.max(
      0,
      ...lines.flatMap((line) =>
        line.points.map((point) => Number(point.v || 0)),
      ),
    ),
  );
  context.font = "10px sans-serif";
  context.lineWidth = 1;
  context.textBaseline = "middle";

  for (let index = 0; index <= 5; index += 1) {
    const ratio = index / 5;
    const y = pad.top + plotHeight * (1 - ratio);
    context.strokeStyle = "rgba(255,255,255,.08)";
    context.beginPath();
    context.moveTo(pad.left, y);
    context.lineTo(cssWidth - pad.right, y);
    context.stroke();
    context.fillStyle = "#8d8d9f";
    context.textAlign = "right";
    context.fillText(chartNumber(maxValue * ratio), pad.left - 7, y);

    const x = pad.left + plotWidth * ratio;
    context.textAlign = "center";
    context.textBaseline = "top";
    context.fillText(
      `${((durationMs * ratio) / 1000).toFixed(durationMs < 10_000 ? 1 : 0)}s`,
      x,
      height - pad.bottom + 8,
    );
    context.textBaseline = "middle";
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
    context.font = "bold 10px sans-serif";
    context.textBaseline = "middle";
    context.textAlign =
      x < pad.left + 24
        ? "left"
        : x > cssWidth - pad.right - 24
          ? "right"
          : "center";
    context.fillText(
      group.map((marker) => marker.label).join(" / "),
      x,
      pad.top - 10,
    );
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
    context.fillStyle = "#8d8d9f";
    context.textAlign = "center";
    context.fillText(
      emptyText,
      pad.left + plotWidth / 2,
      pad.top + plotHeight / 2,
    );
  }

  return {
    cssWidth,
    height,
    pad,
    plotWidth,
    plotHeight,
  };
}

function chartHtml(
  series: ChartSeries,
  options: ChartOptions,
  healthMarkers: readonly ChartMarker[],
  phases: readonly ChartFightPhase[],
): string {
  const effects = Object.keys(series.effects || {});
  return `<div class="chart-wrap">
    <div class="chart-title">${escapeHtml(options.title)}</div>
    <div class="chart-toggles" data-role="chart-toggles">
      <label><input type="checkbox" data-series="dps" checked />
        <span class="swatch" style="background:${escapeHtml(options.dpsColor)}"></span>${escapeHtml(options.dpsLabel)}</label>
      ${effects
        .map(
          (name, index) => `<label>
        <input type="checkbox" data-series="${escapeHtml(name)}" ${index < options.defaultVisibleEffectLimit ? "checked" : ""} />
        <span class="swatch" style="background:${escapeHtml(options.colors[name] || fallbackColor(index))}"></span>
        ${escapeHtml(name)}
      </label>`,
        )
        .join("")}
    </div>
    ${
      healthMarkers.length
        ? `<div class="chart-phase-toggles" data-role="chart-phase-toggles">
      <span class="chart-toggle-label">DPS range</span>
      ${phases
        .map(
          (phase) => `<button type="button"
        data-chart-phase="${escapeHtml(phase.id)}"
        aria-pressed="${phase.id === "full" ? "true" : "false"}"
        ${phase.enabled ? "" : 'disabled title="Target health range not reached"'}>
        ${escapeHtml(phase.label)}
      </button>`,
        )
        .join("")}
    </div>`
        : ""
    }
    <div class="chart-panels">
      <div class="chart-panel">
        <div class="chart-panel-title" data-role="dps-panel-title">${escapeHtml(options.dpsLabel)} Over Time</div>
        <div class="chart-canvas-wrap">
          <canvas class="chart-canvas" data-role="dps-canvas"></canvas>
          <div class="chart-tooltip" data-role="dps-tooltip"></div>
        </div>
      </div>
      <div class="chart-panel">
        <div class="chart-panel-title">Effects Over Time</div>
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
  options: Partial<ChartOptions> = {},
): { redraw: () => void } | null {
  if (!container) return null;
  // A token makes a queued animation-frame redraw from an older mount harmless.
  const mountToken = {};
  ACTIVE_MOUNTS.set(container, mountToken);
  const resolvedDps = series?.dps || [];
  const resolvedSeries: ChartSeries = {
    durationMs: Math.max(1, Number(series?.durationMs || 0)),
    dps: resolvedDps,
    effects: series?.effects || {},
    cumulativeDamage:
      series?.cumulativeDamage ||
      resolvedDps.map((point) => ({
        t: point.t,
        v: Number(point.v) * (Number(point.t) / 1000),
      })),
  };
  const resolvedOptions: ChartOptions = {
    ...DEFAULT_OPTIONS,
    ...options,
    colors: { ...DEFAULT_OPTIONS.colors, ...(options.colors || {}) },
    healthBreakpoints: options.healthBreakpoints || [],
  };
  const healthMarkers = healthBreakpointMarkers(
    resolvedOptions.healthBreakpoints,
    resolvedSeries.durationMs,
    resolvedOptions.healthBreakpointColor,
  );
  const phases = fightPhases(resolvedSeries, healthMarkers);
  let activePhaseId = "full";
  container.innerHTML = chartHtml(
    resolvedSeries,
    resolvedOptions,
    healthMarkers,
    phases,
  );

  const chartState: {
    dpsLayout: ChartLayout | null;
    dpsView: ChartDpsView;
    effectsLayout: ChartLayout | null;
    effectLines: ChartLine[];
  } = {
    dpsLayout: null,
    dpsView: dpsViewForPhase(resolvedSeries, healthMarkers, phases[0]!),
    effectsLayout: null,
    effectLines: [],
  };
  const effectEntries = Object.entries(resolvedSeries.effects);

  const redraw = (): void => {
    if (ACTIVE_MOUNTS.get(container) !== mountToken) return;
    const selected = new Set(
      [
        ...container.querySelectorAll<HTMLInputElement>(
          '[data-role="chart-toggles"] input:checked',
        ),
      ].map((input) => input.dataset.series),
    );
    const activePhase =
      phases.find((phase) => phase.id === activePhaseId && phase.enabled) ||
      phases[0]!;
    chartState.dpsView = dpsViewForPhase(
      resolvedSeries,
      healthMarkers,
      activePhase,
    );
    const dpsTitle = container.querySelector<HTMLElement>(
      '[data-role="dps-panel-title"]',
    );
    if (dpsTitle) {
      dpsTitle.textContent =
        `${resolvedOptions.dpsLabel} Over Time` +
        (activePhase.id === "full" ? "" : ` — ${activePhase.label}`);
    }
    chartState.dpsLayout = drawLineChart(
      container.querySelector<HTMLCanvasElement>('[data-role="dps-canvas"]'),
      selected.has("dps")
        ? [
            {
              name: resolvedOptions.dpsLabel,
              color: resolvedOptions.dpsColor,
              points: chartState.dpsView.dps,
            },
          ]
        : [],
      chartState.dpsView.durationMs,
      {
        height: 280,
        emptyText: resolvedOptions.emptyEffectsText,
        markers: chartState.dpsView.markers,
      },
    );
    chartState.effectLines = effectEntries
      .filter(([name]) => selected.has(name))
      .map(([name, points], index) => ({
        name,
        points,
        color: resolvedOptions.colors[name] || fallbackColor(index),
      }));
    chartState.effectsLayout = drawLineChart(
      container.querySelector<HTMLCanvasElement>(
        '[data-role="effects-canvas"]',
      ),
      chartState.effectLines,
      resolvedSeries.durationMs,
      { height: 260, emptyText: resolvedOptions.emptyEffectsText },
    );
  };

  const bindHover = (
    canvasRole: string,
    tooltipRole: string,
    kind: "dps" | "effects",
  ): void => {
    const canvas = container.querySelector<HTMLCanvasElement>(
      `[data-role="${canvasRole}"]`,
    );
    const tooltip = container.querySelector<HTMLElement>(
      `[data-role="${tooltipRole}"]`,
    );
    if (!canvas || !tooltip) return;

    canvas.onmouseleave = () => {
      tooltip.style.display = "none";
    };
    canvas.onmousemove = (event) => {
      const layout =
        kind === "dps" ? chartState.dpsLayout : chartState.effectsLayout;
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
        tooltip.style.display = "none";
        return;
      }

      const time = Math.max(
        0,
        Math.min(
          kind === "dps"
            ? chartState.dpsView.durationMs
            : resolvedSeries.durationMs,
          ((chartX - minX) / layout.plotWidth) *
            (kind === "dps"
              ? chartState.dpsView.durationMs
              : resolvedSeries.durationMs),
        ),
      );
      const timeLabel = `${(time / 1000).toFixed(2)}s`;
      let body: string;
      if (kind === "dps") {
        const dps = Math.round(chartValueAt(chartState.dpsView.dps, time));
        body =
          `<div>${escapeHtml(chartState.dpsView.label)}</div>` +
          `<div>${escapeHtml(resolvedOptions.dpsLabel)}: ${dps.toLocaleString()}</div>`;
      } else {
        const entries = chartState.effectLines
          .map((line) => ({
            name: line.name,
            value: Math.round(chartValueAt(line.points, time)),
          }))
          .filter((entry) => entry.value > 0)
          .sort((a, b) => b.value - a.value);
        body = entries.length
          ? entries
              .map(
                (entry) =>
                  `<div>${escapeHtml(entry.name)}: ${entry.value}</div>`,
              )
              .join("")
          : "<div>No visible stack effects</div>";
      }

      tooltip.innerHTML = `<div><b>${timeLabel}</b></div>${body}`;
      tooltip.style.left = `${pointerX + 12}px`;
      tooltip.style.top = `${pointerY + 12}px`;
      tooltip.style.display = "block";
    };
  };

  for (const input of container.querySelectorAll<HTMLInputElement>(
    '[data-role="chart-toggles"] input',
  )) {
    input.onchange = redraw;
  }
  for (const button of container.querySelectorAll<HTMLButtonElement>(
    '[data-role="chart-phase-toggles"] button',
  )) {
    button.onclick = () => {
      if (button.disabled) return;
      activePhaseId = button.dataset.chartPhase || "full";
      for (const phaseButton of container.querySelectorAll<HTMLButtonElement>(
        '[data-role="chart-phase-toggles"] button',
      )) {
        phaseButton.setAttribute(
          "aria-pressed",
          String(phaseButton.dataset.chartPhase === activePhaseId),
        );
      }
      redraw();
    };
  }
  bindHover("dps-canvas", "dps-tooltip", "dps");
  bindHover("effects-canvas", "effects-tooltip", "effects");
  redraw();
  globalThis.requestAnimationFrame?.(redraw);
  return { redraw };
}
