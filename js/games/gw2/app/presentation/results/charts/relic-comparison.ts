import { escapeHtml } from '#gw2/app/presentation/shared/html.js';

// Structural shapes matching the app-layer break-even model. Declared locally so
// this platform-layer chart does not depend on the app layer; any object with
// these fields (e.g. RelicComparisonModel) can be passed in.
export interface RelicComparisonPoint {
  readonly tMs: number;
  readonly opponentDps: number;
  readonly thornsDps: number;
}

export interface RelicComparisonModel {
  readonly opponentRelic: string;
  readonly targetRelic: string;
  readonly durationMs: number;
  readonly points: readonly RelicComparisonPoint[];
  readonly crossoverMs: number | null;
  readonly thornsAlwaysAhead: boolean;
  readonly evaluationStartMs: number;
  readonly opponentFinalDps: number;
  readonly thornsFinalDps: number;
}

export interface RelicComparisonChartOptions {
  /** Colour for the equipped (opponent) relic curve. */
  readonly opponentColor?: string;
  /** Colour for the Relic of Thorns curve. */
  readonly thornsColor?: string;
  /** Human label for the opponent relic (defaults to "Relic of <key>"). */
  readonly opponentLabel?: string;
}

const WIDTH = 640;
const HEIGHT = 260;
const PAD = Object.freeze({ top: 18, right: 18, bottom: 34, left: 60 });
const PLOT_WIDTH = WIDTH - PAD.left - PAD.right;
const PLOT_HEIGHT = HEIGHT - PAD.top - PAD.bottom;
// High-contrast, clearly distinct pair on the dark chart card: warm amber for
// the equipped relic, cool cyan for Thorns. Different in both hue and lightness
// so the two lines never blur together.
const DEFAULT_OPPONENT_COLOR = '#ffb02e';
const DEFAULT_THORNS_COLOR = '#2ee6c4';
const LINE_WIDTH = 2;

function relicLabel(relic: string): string {
  return `Relic of ${relic}`;
}

function formatSeconds(ms: number): string {
  return `${(ms / 1000).toFixed(1)}s`;
}

function formatDps(value: number): string {
  return Math.round(value).toLocaleString();
}

interface Scale {
  readonly xFor: (tMs: number) => number;
  readonly yFor: (value: number) => number;
}

function createScale(points: readonly RelicComparisonPoint[], startMs: number, endMs: number): Scale {
  const values = points.flatMap((point) => [point.opponentDps, point.thornsDps]);
  const rawMin = values.length ? Math.min(...values) : 0;
  const rawMax = values.length ? Math.max(...values) : 1;
  // Pad the value range so both curves and the crossover sit clear of the axes.
  // A tight (non-zero-based) range keeps the crossover legible when the two
  // relics are within a few percent of each other.
  const span = Math.max(1, rawMax - rawMin);
  const yMin = rawMin - span * 0.12;
  const yMax = rawMax + span * 0.12;
  const yRange = Math.max(1, yMax - yMin);
  const xRange = Math.max(1, endMs - startMs);
  return {
    xFor: (tMs) => PAD.left + (Math.max(0, Math.min(xRange, tMs - startMs)) / xRange) * PLOT_WIDTH,
    yFor: (value) => PAD.top + (1 - (value - yMin) / yRange) * PLOT_HEIGHT
  };
}

function polyline(
  points: readonly RelicComparisonPoint[],
  color: string,
  pick: (point: RelicComparisonPoint) => number,
  scale: Scale,
  dashArray: string
): string {
  const coordinates = points
    .map((point) => `${scale.xFor(point.tMs).toFixed(1)},${scale.yFor(pick(point)).toFixed(1)}`)
    .join(' ');
  // Fixed-width dashed/solid strokes stay crisp and distinguishable when the curves converge.
  return `<polyline fill="none" stroke="${color}" stroke-width="${LINE_WIDTH}" stroke-dasharray="${dashArray}" stroke-linejoin="round" stroke-linecap="round" vector-effect="non-scaling-stroke" points="${coordinates}" />`;
}

/** Linearly samples one curve at an arbitrary time, for the crossover marker. */
function valueAt(
  points: readonly RelicComparisonPoint[],
  tMs: number,
  pick: (point: RelicComparisonPoint) => number
): number {
  if (!points.length) return 0;
  for (let index = 1; index < points.length; index += 1) {
    const previous = points[index - 1];
    const current = points[index];
    if (tMs <= current.tMs) {
      const span = current.tMs - previous.tMs;
      const fraction = span > 0 ? (tMs - previous.tMs) / span : 0;
      return pick(previous) + (pick(current) - pick(previous)) * fraction;
    }
  }

  return pick(points[points.length - 1]);
}

function comparisonPlotPoints(model: RelicComparisonModel): readonly RelicComparisonPoint[] {
  const clamped = model.points.filter((point) => point.tMs >= model.evaluationStartMs);
  return clamped.length >= 2 ? clamped : model.points;
}

function crossoverMarkup(
  model: RelicComparisonModel,
  plotPoints: readonly RelicComparisonPoint[],
  scale: Scale
): string {
  if (model.crossoverMs == null) return '';
  const x = scale.xFor(model.crossoverMs);
  const y = scale.yFor(valueAt(plotPoints, model.crossoverMs, (point) => point.opponentDps));
  const labelAnchor = model.crossoverMs > model.durationMs * 0.7 ? 'end' : 'start';
  const labelX = labelAnchor === 'end' ? x - 8 : x + 8;
  return `<line x1="${x.toFixed(1)}" y1="${PAD.top}" x2="${x.toFixed(1)}" y2="${PAD.top + PLOT_HEIGHT}" stroke="#c9c9d6" stroke-width="1" stroke-dasharray="4 3" />
    <circle cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="4" fill="#ffffff" stroke="#1c1c24" stroke-width="1.5" />
    <text x="${labelX.toFixed(1)}" y="${(PAD.top + 12).toFixed(1)}" text-anchor="${labelAnchor}" class="relic-cmp-crossover-label">Thorns overtakes at ${formatSeconds(model.crossoverMs)}</text>`;
}

function axisMarkup(plotPoints: readonly RelicComparisonPoint[], startMs: number, endMs: number, scale: Scale): string {
  const values = plotPoints.flatMap((point) => [point.opponentDps, point.thornsDps]);
  const rawMin = values.length ? Math.min(...values) : 0;
  const rawMax = values.length ? Math.max(...values) : 1;
  const yTicks = [rawMax, (rawMax + rawMin) / 2, rawMin].map(
    (value) =>
      `<text x="${PAD.left - 8}" y="${(scale.yFor(value) + 3).toFixed(1)}" text-anchor="end" class="relic-cmp-axis-label">${formatDps(value)}</text>`
  );
  const xTicks = [startMs, (startMs + endMs) / 2, endMs].map(
    (tMs) =>
      `<text x="${scale.xFor(tMs).toFixed(1)}" y="${(PAD.top + PLOT_HEIGHT + 20).toFixed(1)}" text-anchor="middle" class="relic-cmp-axis-label">${formatSeconds(tMs)}</text>`
  );
  return `<line x1="${PAD.left}" y1="${PAD.top}" x2="${PAD.left}" y2="${PAD.top + PLOT_HEIGHT}" stroke="#3a3a48" stroke-width="1" />
    <line x1="${PAD.left}" y1="${PAD.top + PLOT_HEIGHT}" x2="${PAD.left + PLOT_WIDTH}" y2="${PAD.top + PLOT_HEIGHT}" stroke="#3a3a48" stroke-width="1" />
    ${yTicks.join('')}
    ${xTicks.join('')}`;
}

/**
 * Renders the fight-duration break-even chart as a self-contained SVG string:
 * the equipped relic's and Relic of Thorns' cumulative average-DPS curves, with
 * the crossover point marked. Returns a short empty-state note when there are no
 * comparable samples.
 */
export function relicComparisonChartSvg(
  model: RelicComparisonModel,
  options: RelicComparisonChartOptions = {}
): string {
  const opponentColor = options.opponentColor || DEFAULT_OPPONENT_COLOR;
  const thornsColor = options.thornsColor || DEFAULT_THORNS_COLOR;
  const opponentLabel = options.opponentLabel || relicLabel(model.opponentRelic);
  const thornsLabel = relicLabel(model.targetRelic);

  if (model.points.length < 2) {
    return `<p class="relic-cmp-empty">Not enough damage in this rotation to compare relics.</p>`;
  }

  // Clamp the view to the post-opener window so the volatile first-few-seconds
  // average (a tall spike that plunges) does not dominate the axes. Fall back to
  // the full set if clamping would leave too little to draw.
  const plotPoints = comparisonPlotPoints(model);
  const startMs = plotPoints[0].tMs;
  const endMs = model.durationMs;
  const scale = createScale(plotPoints, startMs, endMs);
  const opponent = escapeHtml(opponentLabel);
  const verdict =
    model.crossoverMs != null
      ? `Relic of Thorns overtakes ${opponent} at <b>${formatSeconds(model.crossoverMs)}</b>. Longer fights favour Thorns; shorter fights favour ${opponent}.`
      : model.thornsAlwaysAhead
        ? `Relic of Thorns matches or beats ${opponent} for the entire ${formatSeconds(model.durationMs)} window.`
        : `Relic of Thorns does not overtake ${opponent} within this ${formatSeconds(model.durationMs)} rotation.`;

  return `<figure class="relic-cmp-figure">
    <div class="chart-canvas-wrap">
      <svg class="relic-cmp-svg" data-role="relic-comparison-chart" viewBox="0 0 ${WIDTH} ${HEIGHT}" role="img" preserveAspectRatio="xMidYMid meet"
        aria-label="Average DPS versus fight duration for ${escapeHtml(opponentLabel)} and ${escapeHtml(thornsLabel)}">
        ${axisMarkup(plotPoints, startMs, endMs, scale)}
        ${crossoverMarkup(model, plotPoints, scale)}
        ${polyline(plotPoints, opponentColor, (point) => point.opponentDps, scale, '7 4')}
        ${polyline(plotPoints, thornsColor, (point) => point.thornsDps, scale, 'none')}
      </svg>
      <div class="chart-tooltip" data-role="relic-comparison-tooltip"></div>
    </div>
    <figcaption class="relic-cmp-caption">
      <div class="relic-cmp-legend">
        <span class="relic-cmp-key"><span class="relic-cmp-swatch" style="background:${opponentColor}"></span>${escapeHtml(opponentLabel)} <b>${formatDps(model.opponentFinalDps)}</b></span>
        <span class="relic-cmp-key"><span class="relic-cmp-swatch" style="background:${thornsColor}"></span>${escapeHtml(thornsLabel)} <b>${formatDps(model.thornsFinalDps)}</b></span>
      </div>
      <p class="relic-cmp-verdict">${verdict}</p>
    </figcaption>
  </figure>`;
}

/** Shows both relic curves at the fight duration nearest the hovered chart position. */
export function bindRelicComparisonChartHover(
  container: HTMLElement | null | undefined,
  model: RelicComparisonModel,
  options: RelicComparisonChartOptions = {}
): void {
  const svg = container?.querySelector<SVGSVGElement>('[data-role="relic-comparison-chart"]');
  const tooltip = container?.querySelector<HTMLElement>('[data-role="relic-comparison-tooltip"]');
  if (!svg || !tooltip || model.points.length < 2) return;

  const plotPoints = comparisonPlotPoints(model);
  const startMs = plotPoints[0].tMs;
  const endMs = model.durationMs;
  const opponentLabel = options.opponentLabel || relicLabel(model.opponentRelic);
  const thornsLabel = relicLabel(model.targetRelic);

  svg.onmouseleave = () => {
    tooltip.style.display = 'none';
  };

  svg.onmousemove = (event) => {
    const rect = svg.getBoundingClientRect();
    const pointerX = event.clientX - rect.left;
    const pointerY = event.clientY - rect.top;
    const chartX = (pointerX / Math.max(1, rect.width)) * WIDTH;
    const chartY = (pointerY / Math.max(1, rect.height)) * HEIGHT;
    if (chartX < PAD.left || chartX > PAD.left + PLOT_WIDTH || chartY < PAD.top || chartY > PAD.top + PLOT_HEIGHT) {
      tooltip.style.display = 'none';
      return;
    }

    const time = startMs + ((chartX - PAD.left) / PLOT_WIDTH) * Math.max(0, endMs - startMs);
    tooltip.innerHTML = `<div><b>${(time / 1000).toFixed(2)}s</b></div>
      <div>${escapeHtml(opponentLabel)}: ${formatDps(valueAt(plotPoints, time, (point) => point.opponentDps))} DPS</div>
      <div>${escapeHtml(thornsLabel)}: ${formatDps(valueAt(plotPoints, time, (point) => point.thornsDps))} DPS</div>`;
    tooltip.style.left = `${pointerX + 12}px`;
    tooltip.style.top = `${pointerY + 12}px`;
    tooltip.style.display = 'block';
  };
}

/** Mounts the existing SVG comparison chart as a bounded imperative React leaf. */
export function mountRelicComparisonChart(
  container: HTMLElement | null | undefined,
  model: RelicComparisonModel,
  options: RelicComparisonChartOptions = {}
): (() => void) | null {
  if (!container) return null;
  container.innerHTML = relicComparisonChartSvg(model, options);
  bindRelicComparisonChartHover(container, model, options);
  return () => container.replaceChildren();
}
