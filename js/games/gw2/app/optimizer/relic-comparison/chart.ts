// Share the comparison model without loading simulation code into the chart.
import type {
  RelicComparisonModel,
  RelicComparisonPoint,
  RelicKillResult
} from '#gw2/app/optimizer/relic-comparison/relic-comparison.js';
import { clamp } from '#kernel/core/numeric.js';
import { escapeHtml } from '#ui/shared/html.js';

const WIDTH = 640;
const HEIGHT = 260;
const PAD = Object.freeze({ top: 18, right: 18, bottom: 34, left: 60 });
const PLOT_WIDTH = WIDTH - PAD.left - PAD.right;
const PLOT_HEIGHT = HEIGHT - PAD.top - PAD.bottom;
// Match colors and stroke patterns across curves, table rows and hover values.
const COLORS = ['#ffb02e', '#2ee6c4', '#bd9cff', '#ff85ba', '#a8d66d', '#6cbcff', '#ff8965', '#e1d57a'];
function curveStyle(index: number) {
  return {
    color: COLORS[index] ?? `hsl(${Math.round(index * 137.5) % 360} 75% 70%)`,
    dash: index === 0 ? '7 4' : index < COLORS.length ? 'none' : '3 3',
    border: index === 0 || index >= COLORS.length ? 'dashed' : 'solid'
  };
}

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
  const values = points.flatMap((point) => point.samples.map((sample) => sample.gainedDps));
  const rawMin = Math.min(0, ...values);
  const rawMax = Math.max(1, ...values);
  // Pad the value range so both curves and the crossover sit clear of the axes.
  // Include zero so positive and negative gains have a visible reference.
  const span = Math.max(1, rawMax - rawMin);
  const yMin = rawMin - span * 0.12;
  const yMax = rawMax + span * 0.12;
  const yRange = Math.max(1, yMax - yMin);
  const xRange = Math.max(1, endMs - startMs);
  return {
    xFor: (tMs) => PAD.left + (clamp(tMs - startMs, 0, xRange) / xRange) * PLOT_WIDTH,
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

/** Mark each alternative's final crossover against the equipped relic without overlapping text labels. */
function crossoverMarkup(
  model: RelicComparisonModel,
  plotPoints: readonly RelicComparisonPoint[],
  scale: Scale
): string {
  return model.relics
    .map((entry, index) => {
      if (index === 0 || entry.crossoverMs == null) return '';

      const x = scale.xFor(entry.crossoverMs);
      const y = scale.yFor(valueAt(plotPoints, entry.crossoverMs, (point) => point.samples[0].gainedDps));
      const { color } = curveStyle(index);
      return `<g><title>${escapeHtml(entry.relic)} catches the equipped relic at ${formatSeconds(entry.crossoverMs)}</title>
      <line x1="${x}" y1="${PAD.top}" x2="${x}" y2="${PAD.top + PLOT_HEIGHT}" stroke="${color}" stroke-width="1" stroke-dasharray="4 3" />
      <circle cx="${x}" cy="${y}" r="3" fill="${color}" /></g>`;
    })
    .join('');
}

function axisMarkup(plotPoints: readonly RelicComparisonPoint[], startMs: number, endMs: number, scale: Scale): string {
  const values = plotPoints.flatMap((point) => point.samples.map((sample) => sample.gainedDps));
  const rawMin = Math.min(0, ...values);
  const rawMax = Math.max(1, ...values);
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

/** One sampled timestamp supplies every table cell and the hover tooltip. */
function resultsMarkup(model: RelicComparisonModel, point: RelicComparisonPoint | undefined): string {
  return `<table class="relic-cmp-damage">
    <caption>Results at ${formatSeconds(point?.tMs ?? model.durationMs)}</caption>
    <thead><tr><th scope="col">Relic</th><th scope="col">Build DPS</th><th scope="col">Direct relic DPS</th><th scope="col">Total DPS gained</th></tr></thead>
    <tbody>${model.relics
      .map((entry, index) => {
        const { color, border } = curveStyle(index);
        const sample = point?.samples[index];
        return `<tr><th scope="row"><span class="relic-cmp-key"><span class="relic-cmp-swatch" aria-hidden="true" style="border-top-color:${color};border-top-style:${border}"></span>${escapeHtml(relicLabel(entry.relic))}${index === 0 ? '<small class="relic-cmp-equipped">Equipped</small>' : ''}</span></th><td>${sample ? formatDps(sample.buildDps) : '-'}</td><td>${sample ? formatDps(sample.directDps) : '-'}</td><td>${sample ? formatDps(sample.gainedDps) : '-'}</td></tr>`;
      })
      .join('')}</tbody>
  </table>`;
}

/** Kill times retain the original target settings and never use the fixed-health comparison. */
function killMarkup(model: RelicComparisonModel): string {
  const value = (result: RelicKillResult) =>
    result.killTimeMs == null
      ? `No kill within ${formatSeconds(result.observedMs)}`
      : `${(result.killTimeMs / 1000).toFixed(2)}s`;
  return `<section class="relic-cmp-kills" aria-label="Time to kill">
    <div><h5>Time to kill</h5><p>Original target and encounter settings</p></div>
    <dl>${model.relics.map((entry) => `<div><dt>${escapeHtml(relicLabel(entry.relic))}</dt><dd>${value(entry.kill)}</dd></div>`).join('')}</dl>
  </section>`;
}

/** Plot every relic against one baseline, with shared-time results and separate kill times. */
export function relicComparisonChartSvg(model: RelicComparisonModel): string {
  const damageSummary = `<div class="relic-cmp-table-wrap" data-role="relic-comparison-results" role="region" aria-label="Relic comparison results" tabindex="0">${resultsMarkup(model, model.points.at(-1))}</div>
    <p class="relic-cmp-note">Direct relic DPS counts its strikes and conditions. Total DPS gained also includes buffs and interactions, measured against the same build without a relic.</p>`;

  if (model.points.length < 2) {
    return `${damageSummary}<p class="relic-cmp-empty">Not enough time in this rotation to compare relics.</p>${killMarkup(model)}`;
  }

  const plotPoints = comparisonPlotPoints(model);
  const startMs = plotPoints[0].tMs;
  const endMs = model.durationMs;
  const scale = createScale(plotPoints, startMs, endMs);
  return `<figure class="relic-cmp-figure">
    <div class="relic-cmp-plot-heading"><h5>DPS gained from relic</h5>
      <p>Comparison ends when the first rotation finishes. Target health held at ${formatDps(model.targetHealthPercent)}%; encounter phases excluded.</p></div>
    <div class="chart-canvas-wrap">
      <svg class="relic-cmp-svg" data-role="relic-comparison-chart" viewBox="0 0 ${WIDTH} ${HEIGHT}" role="img" tabindex="0" preserveAspectRatio="xMidYMid meet"
        aria-label="DPS gained versus fight duration for ${escapeHtml(model.relics.map((entry) => entry.relic).join(', '))}. Use left and right arrow keys to inspect durations.">
        ${axisMarkup(plotPoints, startMs, endMs, scale)}
        <line x1="${PAD.left}" y1="${scale.yFor(0)}" x2="${PAD.left + PLOT_WIDTH}" y2="${scale.yFor(0)}" stroke="#3a3a48" stroke-dasharray="3 3" />
        ${crossoverMarkup(model, plotPoints, scale)}
        ${model.relics
          .map((_entry, index) => {
            const { color, dash } = curveStyle(index);
            return polyline(plotPoints, color, (point) => point.samples[index].gainedDps, scale, dash);
          })
          .join('')}
        <line data-role="relic-comparison-cursor" x1="${scale.xFor(endMs)}" x2="${scale.xFor(endMs)}" y1="${PAD.top}" y2="${PAD.top + PLOT_HEIGHT}" stroke="#c9c9d6" stroke-width="1" stroke-dasharray="2 3" />
      </svg>
      <div class="chart-tooltip" data-role="relic-comparison-tooltip"></div>
    </div>
    <figcaption class="relic-cmp-caption">
      ${damageSummary}
    </figcaption>
  </figure>${killMarkup(model)}`;
}

/** Hover and keyboard inspection select actual samples, so the graph, tooltip and table agree. */
export function bindRelicComparisonChartHover(
  container: HTMLElement | null | undefined,
  model: RelicComparisonModel
): void {
  const svg = container?.querySelector<SVGSVGElement>('[data-role="relic-comparison-chart"]');
  const tooltip = container?.querySelector<HTMLElement>('[data-role="relic-comparison-tooltip"]');

  if (!svg || !tooltip || model.points.length < 2) return;

  const table = container?.querySelector<HTMLElement>('[data-role="relic-comparison-results"]');
  const cursor = container?.querySelector<SVGLineElement>('[data-role="relic-comparison-cursor"]');
  const plotPoints = comparisonPlotPoints(model);
  const startMs = plotPoints[0].tMs;
  const endMs = model.durationMs;
  const scale = createScale(plotPoints, startMs, endMs);
  let selectedIndex = plotPoints.length - 1;
  const show = (index: number) => {
    const point = plotPoints[index];

    if (table) table.innerHTML = resultsMarkup(model, point);

    cursor?.setAttribute('x1', String(scale.xFor(point.tMs)));
    cursor?.setAttribute('x2', String(scale.xFor(point.tMs)));
    return point;
  };

  const reset = () => {
    tooltip.style.display = 'none';
    show(selectedIndex);
  };

  svg.onkeydown = (event) => {
    if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) return;

    event.preventDefault();
    selectedIndex =
      event.key === 'Home'
        ? 0
        : event.key === 'End'
          ? plotPoints.length - 1
          : clamp(selectedIndex + (event.key === 'ArrowLeft' ? -1 : 1), 0, plotPoints.length - 1);
    reset();
  };

  svg.onmouseleave = reset;
  svg.onmousemove = (event) => {
    const rect = svg.getBoundingClientRect();
    const pointerX = event.clientX - rect.left;
    const pointerY = event.clientY - rect.top;
    const chartX = (pointerX / Math.max(1, rect.width)) * WIDTH;
    const chartY = (pointerY / Math.max(1, rect.height)) * HEIGHT;

    if (chartX < PAD.left || chartX > PAD.left + PLOT_WIDTH || chartY < PAD.top || chartY > PAD.top + PLOT_HEIGHT) {
      reset();
      return;
    }

    const time = startMs + ((chartX - PAD.left) / PLOT_WIDTH) * Math.max(0, endMs - startMs);
    const index = plotPoints.reduce(
      (best, point, candidate) =>
        Math.abs(point.tMs - time) < Math.abs(plotPoints[best].tMs - time) ? candidate : best,
      0
    );
    const point = show(index);
    tooltip.innerHTML = `<div><b>${(point.tMs / 1000).toFixed(3)}s</b></div>${model.relics
      .map(
        (entry, index) =>
          `<div><span style="color:${curveStyle(index).color}">${escapeHtml(relicLabel(entry.relic))}</span>: ${formatDps(point.samples[index].gainedDps)} DPS gained</div>`
      )
      .join('')}`;
    tooltip.style.left = '0px';
    tooltip.style.display = 'block';
    tooltip.style.left = `${clamp(pointerX + 12, 0, rect.width - tooltip.offsetWidth - 4)}px`;
    tooltip.style.top = `${pointerY + 12}px`;
  };
}
