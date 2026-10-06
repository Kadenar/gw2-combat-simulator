import { escapeHtml } from '#ui/shared/html.js';
import { PRESENTATION_ALLIED_PLAYER_COUNT } from '#gw2/platform/results/boon-generation.js';
import {
  buildPhaseDpsSeries,
  buildContributionDamageSeries,
  chartAxisMaximum,
  buildRollingDpsSeries,
  buildPhaseEffectSeries,
  type ChartEffectType,
  type ChartPoint,
  type ChartSeries
} from '#gw2/app/results/charts/time-series-model.js';
import { bindTimeSeriesInteractions } from '#gw2/app/results/charts/time-series-interactions.js';

// Mounts chart data as interactive DOM and canvas output without owning simulation transforms.
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
  readonly targetStartingHealthPercent: number;
  readonly targetDied: boolean;
  readonly healthBreakpointColor: string;
}

interface ChartLine {
  readonly name: string;
  readonly effectName?: string;
  readonly color: string;
  readonly points: readonly ChartPoint[];
  readonly dash?: readonly number[];
  readonly stepped?: boolean;
  readonly unit?: string;
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

const DEFAULT_OPTIONS: ChartOptions = {
  title: 'DPS & Effects Over Time',
  dpsLabel: 'DPS',
  dpsColor: '#54c96b',
  colors: {},
  defaultVisibleEffectLimit: 8,
  emptyEffectsText: 'No timed effects in this rotation',
  healthBreakpoints: [],
  targetStartingHealthPercent: 100,
  targetDied: false,
  healthBreakpointColor: '#e1c070'
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
  { id: '100-80', label: '100-80%', startHealth: 100, endHealth: 80 },
  { id: '80-60', label: '80-60%', startHealth: 80, endHealth: 60 },
  { id: '60-40', label: '60-40%', startHealth: 60, endHealth: 40 },
  { id: '40-20', label: '40-20%', startHealth: 40, endHealth: 20 },
  { id: '20-0', label: '20-0%', startHealth: 20, endHealth: 0 }
] as const;

function fightPhases(series: ChartSeries, markers: readonly ChartMarker[], options: ChartOptions): ChartFightPhase[] {
  const cumulativeDamage = series.cumulativeDamage || [];
  const finalDamage = Number(cumulativeDamage.at(-1)?.v);
  const boundaries = new Map<number, { readonly timeMs: number; readonly damage: number }>([
    [options.targetStartingHealthPercent, { timeMs: 0, damage: 0 }]
  ]);
  for (const marker of markers) {
    if (Number.isFinite(marker.damage)) {
      boundaries.set(marker.healthPercent, {
        timeMs: marker.timeMs,
        damage: marker.damage
      });
    }
  }

  // Only recorded death completes the final health range; observation end may leave the target alive.
  if (options.targetDied && Number.isFinite(finalDamage)) {
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
    markers = [],
    timeOffsetMs = 0,
    highlightedEffect = null,
    tightScale = false
  }: {
    readonly height?: number;
    readonly emptyText?: string;
    readonly markers?: readonly ChartMarker[];
    readonly timeOffsetMs?: number;
    readonly highlightedEffect?: string | null;
    readonly tightScale?: boolean;
  } = {}
): ChartLayout | null {
  if (!canvas?.getContext) return null;
  const cssWidth = Math.max(
    1,
    Math.floor(canvas.parentElement?.clientWidth || canvas.closest?.('.chart-wrap')?.clientWidth || 760)
  );
  const dpr = Math.max(1, Number(globalThis.window?.devicePixelRatio) || 1);
  // Keep layout width fluid so a hidden or stale measurement cannot widen the
  // mobile viewport; only the backing store uses the measured pixel width.
  canvas.width = Math.round(cssWidth * dpr);
  canvas.height = Math.round(height * dpr);
  canvas.style.width = '100%';
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
  const maxValue = chartAxisMaximum(
    lines.flatMap((line) => line.points.map((point) => point.v)),
    tightScale
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
      `${((timeOffsetMs + durationMs * ratio) / 1000).toFixed(durationMs < 10_000 ? 1 : 0)}s`,
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

  // Emphasize both audience curves for a visible effect without changing the scale or checkbox selection.
  const hasHighlight = lines.some((line) => line.effectName === highlightedEffect);
  const orderedLines = hasHighlight
    ? [...lines].sort(
        (left, right) => Number(left.effectName === highlightedEffect) - Number(right.effectName === highlightedEffect)
      )
    : lines;
  for (const line of orderedLines) {
    if (!line.points.length) continue;
    context.save();
    context.setLineDash([...(line.dash || [])]);
    context.strokeStyle = line.color;
    const highlighted = hasHighlight && line.effectName === highlightedEffect;
    context.globalAlpha = hasHighlight && !highlighted ? 0.2 : 1;
    context.lineWidth = highlighted ? 3.5 : 2;
    context.beginPath();
    line.points.forEach((point, index) => {
      const x = pad.left + (Number(point.t || 0) / durationMs) * plotWidth;
      const y = pad.top + (1 - Number(point.v || 0) / maxValue) * plotHeight;
      if (index === 0) context.moveTo(x, y);
      else {
        // Stack counts hold until the next sample changes them; countdowns and DPS retain continuous segments.
        if (line.stepped) {
          const previousY = pad.top + (1 - line.points[index - 1]!.v / maxValue) * plotHeight;
          context.lineTo(x, previousY);
        }

        context.lineTo(x, y);
      }
    });
    context.stroke();
    context.restore();
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

/** Shows time-averaged stacks for each audience alongside boon supply coverage and personal uptime. */
function effectSummaryHtml(series: ChartSeries): string {
  const priority = ['Might', 'Fury', 'Protection', 'Quickness', 'Alacrity'];
  const summaries = series.effectSummaries || {};
  const generation = series.boonGeneration || {};
  const primaryBoons = priority.filter((name) => {
    if (name !== 'Quickness' && name !== 'Alacrity') return true;
    const boon = generation[name];
    return boon && boon.self.generatedStackSeconds + boon.allies.generatedStackSeconds > 0;
  });
  const names = [...new Set([...Object.keys(summaries), ...Object.keys(generation)])];
  if (!names.length) return '';
  const supplementaryBoons = names.filter((name) => generation[name] && !priority.includes(name)).sort();
  const supplementaryBuffs = names.filter((name) => summaries[name] && !generation[name]).sort();
  const duration = series.durationMs / 1000;
  const percent = (value: number): string => `${(value * 100).toFixed(1)}%`;
  // Normalize intensity supply against its cap so excess generation is not mistaken for obtainable stacks.
  const coverage = (average: number, intensity: boolean, maximum?: number): string =>
    intensity && maximum != null ? `${percent(average / maximum)} of cap` : percent(average);
  const rows = (effects: readonly string[]): string =>
    effects
      .map((name) => {
        const summary = summaries[name];
        const boon = generation[name];
        const intensity = Boolean(boon?.intensityStacking || name === 'Might');
        const maximum = summary?.maximumStacks ?? boon?.maximumStacks ?? (name === 'Might' ? 25 : undefined);
        const own = boon?.self;
        const alliedGenerated = boon?.allies.generatedStackSeconds || 0;
        const alliedPerPlayer = alliedGenerated / PRESENTATION_ALLIED_PLAYER_COUNT;
        const generatedAverage = duration > 0 ? (own?.generatedStackSeconds || 0) / duration : 0;
        const alliedAverage = duration > 0 ? alliedGenerated / (duration * PRESENTATION_ALLIED_PLAYER_COUNT) : 0;
        const target = intensity ? maximum : 1;
        const isBoon = Boolean(boon) || priority.includes(name);
        const selfState = intensity
          ? `Self uptime: ${percent(summary?.uptime || 0)}${summary?.maximumStackUptime == null ? '' : ` · ${percent(summary.maximumStackUptime)} at cap`}`
          : `Self uptime: ${percent(summary?.uptime || 0)}`;
        const overTarget =
          isBoon && target != null && alliedAverage > target
            ? `<small>+${percent(alliedAverage / target - 1)} over ${intensity ? 'cap' : 'target'}</small>`
            : '';
        const selfGeneration = own?.generatedStackSeconds || 0;
        // Identical per-player values add no self-specific information, so only differences stay visible.
        const selfDiffersFromAllies = Math.abs(selfGeneration - alliedPerPlayer) > 1e-9;
        const selfCoverage =
          selfGeneration && selfDiffersFromAllies
            ? `<small>Self: ${coverage(generatedAverage, intensity, maximum)}</small>`
            : '';
        const coverageDetails = isBoon
          ? `${coverage(alliedAverage, intensity, maximum)}${overTarget}${selfCoverage}<small>${selfState}</small>`
          : selfState;
        return `<tr>
      <th scope="row">${escapeHtml(name)}</th>
      <td>Ally: ${(series.alliedAverageStacks?.[name] || 0).toFixed(2)}<small>Self: ${(summary?.averageStacks || 0).toFixed(2)}</small></td>
      <td>${coverageDetails}</td>
    </tr>`;
      })
      .join('');
  const table = (effects: readonly string[], label: string, showCaption = true): string => `
    <div class="effect-summary-scroll" tabindex="0" role="region" aria-label="${label}">
      <table>
        ${showCaption ? `<caption>${label} · ${PRESENTATION_ALLIED_PLAYER_COUNT} allies · full benchmark (${duration.toFixed(3)}s)</caption>` : ''}
        <thead><tr><th scope="col">Effect</th><th scope="col">Average stacks</th><th scope="col">Coverage</th></tr></thead>
        <tbody>${rows(effects)}</tbody>
      </table>
    </div>`;
  const buffTable = (effects: readonly string[]): string => `
    <div class="effect-summary-scroll" tabindex="0" role="region" aria-label="Other buffs">
      <table>
        <thead><tr><th scope="col">Effect</th><th scope="col">Average stacks</th><th scope="col">Player uptime</th></tr></thead>
        <tbody>${effects
          .map(
            (name) => `<tr>
      <th scope="row">${escapeHtml(name)}</th>
      <td>${(summaries[name]?.averageStacks || 0).toFixed(2)}</td>
      <td>${percent(summaries[name]?.uptime || 0)}</td>
    </tr>`
          )
          .join('')}</tbody>
      </table>
    </div>`;
  return `<div class="effect-summary" data-role="effect-summary">
    ${table(primaryBoons, 'Boons')}
    ${supplementaryBoons.length ? `<details data-role="supplementary-boons"><summary>Other boons (${supplementaryBoons.length})</summary>${table(supplementaryBoons, 'Other boons', false)}</details>` : ''}
    ${supplementaryBuffs.length ? `<details data-role="supplementary-buffs"><summary>Other buffs (${supplementaryBuffs.length})</summary>${buffTable(supplementaryBuffs)}</details>` : ''}
  </div>`;
}

function chartHtml(
  series: ChartSeries,
  options: ChartOptions,
  healthMarkers: readonly ChartMarker[],
  phases: readonly ChartFightPhase[]
): string {
  const effects = [...new Set([...Object.keys(series.effects || {}), ...Object.keys(series.alliedEffects || {})])];
  // Give each chart its own initial selection so conditions cannot crowd out boons or buffs.
  const visibleEffects = new Set(
    [false, true].flatMap((condition) =>
      effects
        .filter((name) => (series.effectTypes?.[name] === 'condition') === condition)
        .slice(0, Math.max(0, options.defaultVisibleEffectLimit))
    )
  );
  const effectIndexes = new Map(effects.map((name, index) => [name, index]));
  const effectGroups: readonly {
    type: ChartEffectType;
    label: string;
  }[] = [
    { type: 'boon', label: 'Boons' },
    { type: 'condition', label: 'Conditions' },
    { type: 'buff', label: 'Buffs' }
  ];
  // Keep each effect control beside the chart it changes.
  const effectTogglesMarkup = (conditions: boolean): string => `<div class="chart-toggles" data-role="chart-toggles">
      ${effectGroups
        .filter(({ type }) => (type === 'condition') === conditions)
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
      healthMarkers.length || phases.some((phase) => phase.id !== 'full' && phase.enabled)
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
    <div class="chart-phase-toggles">
      <span data-role="chart-zoom-label" aria-live="polite">Full range</span>
      <button type="button" data-role="chart-reset-zoom" disabled>Reset zoom</button>
    </div>
    <div class="chart-panels">
      <div class="chart-panel">
        <div class="chart-panel-title" data-role="dps-panel-title">${escapeHtml(options.dpsLabel)} Over Time</div>
        <div class="chart-toggles chart-dps-controls" role="group" aria-label="Damage sources">
          <span class="chart-toggle-label">Damage</span>
          <label><input type="checkbox" data-dps-source="total" checked /><span class="swatch" style="background:${escapeHtml(options.dpsColor)}"></span>Total</label>
          <label><input type="checkbox" data-dps-source="strike" /><span class="swatch" style="background:#65b9ff"></span>Strike</label>
          <label><input type="checkbox" data-dps-source="condition" /><span class="swatch" style="background:#e889c8"></span>Condition</label>
        </div>
        <div class="chart-toggles chart-dps-controls" role="group" aria-label="DPS averaging">
          <span class="chart-toggle-label">Average</span>
          <label><input type="checkbox" data-dps-window="cumulative" checked />Average so far</label>
          <label><input type="checkbox" data-dps-window="rolling-1s" />Last 1s</label>
          <label><input type="checkbox" data-dps-window="rolling-5s" />Last 5s</label>
        </div>
        <div class="chart-toggles" data-role="dps-legend"></div>
        <div class="chart-canvas-wrap">
          <canvas class="chart-canvas" data-role="dps-canvas" tabindex="0" aria-label="DPS chart"></canvas>
          <div class="chart-crosshair" hidden></div><div class="chart-selection" hidden></div>
          <div class="chart-tooltip" data-role="dps-tooltip"></div>
        </div>
      </div>
      <div class="chart-panel">
        <div class="chart-panel-title" data-role="effects-panel-title">Boons &amp; Buffs Over Time</div>
        <div class="chart-phase-toggles" data-role="boon-audience" role="group" aria-label="Boon audience">
          <span class="chart-toggle-label">Boons</span>
          <button type="button" data-boon-audience="self" aria-pressed="true">Self</button>
          <button type="button" data-boon-audience="allies" aria-pressed="false">Allies</button>
          <button type="button" data-boon-audience="both" aria-pressed="false">Both</button>
          <span>Self: solid · Allies: dashed</span>
        </div>
        ${effectTogglesMarkup(false)}
        <div class="chart-canvas-wrap">
          <canvas class="chart-canvas" data-role="effects-canvas" tabindex="0" aria-label="Boons and buffs chart"></canvas>
          <div class="chart-crosshair" hidden></div><div class="chart-selection" hidden></div>
          <div class="chart-tooltip" data-role="effects-tooltip"></div>
        </div>
      </div>
      <div class="chart-panel">
        <div class="chart-panel-title" data-role="conditions-panel-title">Conditions Over Time</div>
        ${effectTogglesMarkup(true)}
        <div class="chart-canvas-wrap">
          <canvas class="chart-canvas" data-role="conditions-canvas" tabindex="0" aria-label="Conditions chart"></canvas>
          <div class="chart-crosshair" hidden></div><div class="chart-selection" hidden></div>
          <div class="chart-tooltip" data-role="conditions-tooltip"></div>
        </div>
      </div>
      ${effectSummaryHtml(series)}
    </div>
  </div>`;
}

/**
 * Replaces `container` with a complete, container-scoped time-series chart.
 * Replacing the contents also makes repeated mounts safe from duplicate
 * handlers. Controls and resize observers own redraws within this mount.
 */
export function mountTimeSeriesCharts(
  container: HTMLElement | null | undefined,
  series: ChartSeries,
  options: Partial<ChartOptions> = {}
): void {
  if (!container) return;
  // A token makes a queued animation-frame redraw from an older mount harmless.
  ACTIVE_MOUNTS.get(container)?.resizeObserver?.disconnect();
  const mountToken = {};
  const activeMount: ActiveChartMount = { token: mountToken };
  ACTIVE_MOUNTS.set(container, activeMount);
  const resolvedDps = series?.dps || [];
  const resolvedSeries: ChartSeries = {
    durationMs: Math.max(1, Number(series?.durationMs || 0)),
    dps: resolvedDps,
    damageContributions: series.damageContributions,
    effects: series?.effects || {},
    alliedEffects: series?.alliedEffects || {},
    alliedAverageStacks: series?.alliedAverageStacks || {},
    effectTypes: series?.effectTypes || {},
    effectUnits: series?.effectUnits || {},
    effectSummaries: series?.effectSummaries || {},
    boonGeneration: series?.boonGeneration || {},
    alliedPlayerCount: series?.alliedPlayerCount || 0,
    cumulativeDamage:
      series?.cumulativeDamage ||
      resolvedDps.map((point) => ({
        t: point.t,
        v: Number(point.v) * (Number(point.t) / 1000)
      }))
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
  const phases = fightPhases(resolvedSeries, healthMarkers, resolvedOptions);
  let activePhaseId = 'full';
  let boonAudience = 'self';
  const effectNames = [
    ...new Set([...Object.keys(resolvedSeries.effects), ...Object.keys(resolvedSeries.alliedEffects!)])
  ];
  container.innerHTML = chartHtml(resolvedSeries, resolvedOptions, healthMarkers, phases);

  const chartPhaseTogglesEl = container.querySelector<HTMLElement>('[data-role="chart-phase-toggles"]');
  const resetButton = container.querySelector<HTMLButtonElement>('[data-role="chart-reset-zoom"]');
  const zoomLabel = container.querySelector<HTMLElement>('[data-role="chart-zoom-label"]');
  const panels: { kind: string; layout: ChartLayout | null; lines: ChartLine[] }[] = [
    { kind: 'dps', layout: null, lines: [] },
    { kind: 'effects', layout: null, lines: [] },
    { kind: 'conditions', layout: null, lines: [] }
  ];
  const dpsWindows = new Set(['cumulative']);
  const dpsSources = new Set(['total']);
  let hoveredEffect: string | null = null;
  let focusedEffect: string | null = null;
  let zoomRange: { start: number; end: number } | null = null;
  let viewRange = { start: 0, end: resolvedSeries.durationMs, offset: 0 };
  let clearInteraction = (): void => {};

  const redraw = (): void => {
    if (ACTIVE_MOUNTS.get(container)?.token !== mountToken) return;
    clearInteraction();
    const selected = new Set(
      [...container.querySelectorAll<HTMLInputElement>('[data-series]:checked')].map((input) => input.dataset.series)
    );
    const activePhase = phases.find((phase) => phase.id === activePhaseId && phase.enabled) || phases[0]!;
    const dpsView = dpsViewForPhase(resolvedSeries, healthMarkers, activePhase);
    const effectsView = effectsViewForPhase(resolvedSeries, activePhase);
    const alliedView = effectsViewForPhase({ ...resolvedSeries, effects: resolvedSeries.alliedEffects! }, activePhase);
    // Zoom only crops the view: neither cumulative DPS nor the rolling window restarts at its left edge.
    viewRange = {
      start: zoomRange?.start ?? 0,
      end: zoomRange?.end ?? dpsView.durationMs,
      offset: activePhase.startMs
    };
    if (resetButton) resetButton.disabled = !zoomRange;
    if (zoomLabel)
      zoomLabel.textContent = `${zoomRange ? 'Zoom: ' : ''}${((viewRange.offset + viewRange.start) / 1000).toFixed(3)}s – ${((viewRange.offset + viewRange.end) / 1000).toFixed(3)}s`;
    const cumulativeDamage =
      activePhase.id === 'full'
        ? resolvedSeries.cumulativeDamage!
        : dpsView.dps.map((point) => ({ t: point.t, v: (point.v * point.t) / 1000 }));
    for (const panel of panels) {
      const title = container.querySelector<HTMLElement>(`[data-role="${panel.kind}-panel-title"]`);
      const label =
        panel.kind === 'dps' ? resolvedOptions.dpsLabel : panel.kind === 'conditions' ? 'Conditions' : 'Boons & Buffs';
      if (title) title.textContent = `${label} Over Time${activePhase.id === 'full' ? '' : ` — ${activePhase.label}`}`;
      if (panel.kind === 'dps') {
        // Every source uses the same phase origin and rolling denominator, so contributions sum to total DPS.
        const sources = [
          ...(dpsSources.has('total')
            ? [{ label: 'Total', color: resolvedOptions.dpsColor, damage: cumulativeDamage }]
            : []),
          ...(['strike', 'condition'] as const)
            .filter((kind) => dpsSources.has(kind))
            .map((kind) => ({
              label: kind === 'strike' ? 'Strike' : 'Condition',
              color: kind === 'strike' ? '#65b9ff' : '#e889c8',
              damage: buildContributionDamageSeries(
                resolvedSeries.damageContributions[kind],
                dpsView.dps,
                activePhase.startMs,
                activePhase.id === 'full'
              )
            }))
        ];
        panel.lines = sources.flatMap((source): ChartLine[] => {
          const name = (window: string): string =>
            `${window}${source.label ? ` ${source.label}` : ''} ${resolvedOptions.dpsLabel}`;
          return [
            ...(dpsWindows.has('cumulative')
              ? [
                  {
                    name: name('Average so far'),
                    color: source.color,
                    points:
                      source.label !== 'Total'
                        ? source.damage.map(({ t, v }) => ({ t, v: t > 0 ? v / (t / 1000) : 0 }))
                        : dpsView.dps
                  }
                ]
              : []),
            ...(dpsWindows.has('rolling-1s')
              ? [
                  {
                    name: name('Last 1s'),
                    color: source.color,
                    dash: [2, 3],
                    points: buildRollingDpsSeries(source.damage, 1000)
                  }
                ]
              : []),
            ...(dpsWindows.has('rolling-5s')
              ? [
                  {
                    name: name('Last 5s'),
                    color: source.color,
                    dash: [6, 4],
                    points: buildRollingDpsSeries(source.damage, 5000)
                  }
                ]
              : [])
          ];
        });
        const legend = container.querySelector<HTMLElement>('[data-role="dps-legend"]');
        if (legend)
          legend.innerHTML = panel.lines
            .map(
              (line) =>
                `<span><span class="swatch" style="background:${escapeHtml(line.color)}"></span> ${escapeHtml(line.name)}${line.dash ? (line.dash[0] === 2 ? ' (dotted)' : ' (dashed)') : ''}</span>`
            )
            .join('');
      } else {
        // Target conditions own a separate scale; only boons participate in the audience selector.
        panel.lines = effectNames
          .filter(
            (name) =>
              selected.has(name) &&
              (resolvedSeries.effectTypes?.[name] === 'condition') === (panel.kind === 'conditions')
          )
          .flatMap((name) => {
            const boon = resolvedSeries.effectTypes?.[name] === 'boon';
            const color = resolvedOptions.colors[name] || fallbackColor(effectNames.indexOf(name));
            const unit = resolvedSeries.effectUnits?.[name];
            const stepped = unit !== 's';
            const lines: ChartLine[] = [];
            const own = effectsView.effects[name];
            if (own && (!boon || boonAudience !== 'allies'))
              lines.push({ name: boon ? `${name} (Self)` : name, effectName: name, points: own, color, unit, stepped });
            const allied = alliedView.effects[name];
            if (boon && allied && boonAudience !== 'self')
              lines.push({
                name: `${name} (Allies avg)`,
                effectName: name,
                points: allied,
                color,
                unit,
                stepped,
                dash: [6, 4]
              });
            return lines;
          });
      }

      panel.layout = drawLineChart(
        container.querySelector<HTMLCanvasElement>(`[data-role="${panel.kind}-canvas"]`),
        panel.lines.map((line) => ({
          ...line,
          points: buildPhaseEffectSeries(line.points, viewRange.start, viewRange.end)
        })),
        viewRange.end - viewRange.start,
        {
          height: panel.kind === 'dps' ? 280 : 260,
          tightScale: panel.kind === 'dps',
          highlightedEffect: hoveredEffect ?? focusedEffect,
          emptyText:
            panel.kind === 'dps'
              ? 'Select a damage source and averaging window'
              : panel.kind === 'conditions'
                ? 'No visible conditions'
                : resolvedOptions.emptyEffectsText,
          timeOffsetMs: viewRange.offset + viewRange.start,
          markers:
            panel.kind === 'dps'
              ? dpsView.markers
                  .filter((marker) => marker.timeMs >= viewRange.start && marker.timeMs <= viewRange.end)
                  .map((marker) => ({ ...marker, timeMs: marker.timeMs - viewRange.start }))
              : []
        }
      );
    }
  };

  const resetZoom = (): void => {
    zoomRange = null;
    redraw();
  };

  if (resetButton) resetButton.onclick = resetZoom;
  // Only keyboard focus sustains inspection; mouse clicks keep native focus without pinning the highlight.
  for (const input of container.querySelectorAll<HTMLInputElement>('[data-series]')) {
    input.onchange = redraw;
    const label = input.closest('label');
    if (!label) continue;
    label.onpointerenter = (event) => {
      if (event.pointerType === 'touch') return;
      hoveredEffect = input.dataset.series!;
      redraw();
    };

    label.onpointerleave = () => {
      hoveredEffect = null;
      redraw();
    };

    label.onpointerdown = () => {
      focusedEffect = null;
      redraw();
    };

    input.onfocus = () => {
      focusedEffect = input.matches(':focus-visible') ? input.dataset.series! : null;
      redraw();
    };

    input.onkeydown = () => {
      focusedEffect = input.dataset.series!;
      redraw();
    };

    input.onblur = () => {
      focusedEffect = null;
      redraw();
    };
  }

  // Independent checkboxes make every curve combination explicit and preserve selections across phase and zoom changes.
  for (const input of container.querySelectorAll<HTMLInputElement>('[data-dps-source], [data-dps-window]')) {
    input.onchange = () => {
      const selected = input.dataset.dpsSource ? dpsSources : dpsWindows;
      const key = input.dataset.dpsSource ?? input.dataset.dpsWindow!;
      if (input.checked) selected.add(key);
      else selected.delete(key);
      redraw();
    };
  }

  for (const button of container.querySelectorAll<HTMLButtonElement>('[data-boon-audience]')) {
    button.onclick = () => {
      boonAudience = button.dataset.boonAudience!;
      for (const control of container.querySelectorAll<HTMLButtonElement>('[data-boon-audience]'))
        control.setAttribute('aria-pressed', String(control.dataset.boonAudience === boonAudience));
      redraw();
    };
  }

  for (const button of container.querySelectorAll<HTMLButtonElement>('[data-toggle-action]')) {
    button.onclick = () => {
      const group = button.closest('[data-role="chart-toggle-group"]');
      if (!group) return;
      for (const input of group.querySelectorAll<HTMLInputElement>('input'))
        input.checked = button.dataset.toggleAction === 'all';
      redraw();
    };
  }

  for (const button of chartPhaseTogglesEl?.querySelectorAll<HTMLButtonElement>('button') || []) {
    button.onclick = () => {
      if (button.disabled) return;
      activePhaseId = button.dataset.chartPhase!;
      for (const control of chartPhaseTogglesEl?.querySelectorAll<HTMLButtonElement>('button') || [])
        control.setAttribute('aria-pressed', String(control.dataset.chartPhase === activePhaseId));
      resetZoom();
    };
  }

  redraw();
  clearInteraction = bindTimeSeriesInteractions(
    container,
    () => panels,
    () => viewRange,
    (start, end) => {
      zoomRange = { start, end };
      redraw();
    },
    () => {
      if (zoomRange) resetZoom();
    }
  );

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
      if (visibleWidth > 0 && visibleWidth !== panels[0]?.layout?.cssWidth) {
        requestRedraw();
      }
    });
    activeMount.resizeObserver.observe(observedContainer);
  }

  requestRedraw();
}
