import type { InputAnalysisSummary } from '#gw2/app/input-profile/summary.js';

interface ChartScale {
  readonly x: (at: number) => number;
  readonly y: (rate: number) => number;
}

const scales = new WeakMap<HTMLElement, ChartScale>();
/** Keep a hover tooltip inside its positioned wrapper, flipping to the pointer's left near the right edge. */
export function placeInputTooltip(
  wrapper: HTMLElement,
  tooltip: HTMLElement,
  clientX: number,
  clientY: number,
  content: string
): void {
  tooltip.innerHTML = content;
  tooltip.style.display = 'block';
  const bounds = wrapper.getBoundingClientRect();
  const x = clientX - bounds.left;
  const y = clientY - bounds.top;
  const left = x + 14 + tooltip.offsetWidth > bounds.width ? x - tooltip.offsetWidth - 14 : x + 14;
  tooltip.style.left = `${Math.max(0, left)}px`;
  tooltip.style.top = `${Math.max(0, Math.min(y + 14, bounds.height - tooltip.offsetHeight))}px`;
}

/**
 * Plot manual action pace; persistent bracket labels identify each busy section without bubbles above the curve.
 * Brackets align section controls with their time ranges; both the plot and brackets select the same inputs.
 */
export function drawInputPaceChart(
  host: HTMLElement,
  summary: InputAnalysisSummary,
  selectedSection: number | null,
  onSelectSection: (index: number) => void
): void {
  const width = host.clientWidth;
  if (width <= 0 || summary.duration <= 0) return;
  const compact = width < 520;
  const margin = { left: 28, right: 12, top: 24, bottom: 74 };
  const duration = summary.duration;
  const peak = Math.max(0, ...summary.samples.map((sample) => sample.rate));
  const top = Math.max(3, Math.ceil(peak + 0.2));
  const x = (at: number): number => margin.left + (at / duration) * (width - margin.left - margin.right);
  // Keep labels visible beneath their ranges; stagger nearby labels when they would overlap on narrow charts.
  const labelWidth = Math.min(174, width - 8);
  const rowEnds: number[] = [];
  const labels = summary.sections.map((section) => {
    const middle = (x(section.start) + x(section.end)) / 2;
    const center = Math.max(labelWidth / 2 + 4, Math.min(width - labelWidth / 2 - 4, middle));
    let row = rowEnds.findIndex((end) => center - labelWidth / 2 >= end + 8);
    if (row < 0) row = rowEnds.length;
    rowEnds[row] = center + labelWidth / 2;
    return { center, row };
  });
  margin.bottom += Math.max(0, rowEnds.length - 1) * 36;
  const height = (compact ? 146 : 166) + margin.bottom;
  const y = (rate: number): number => margin.top + (1 - rate / top) * (height - margin.top - margin.bottom);
  scales.set(host, { x, y });

  let grid = '';
  for (let rate = 0; rate <= top; rate++)
    grid += `<line class="is-grid" x1="${margin.left}" x2="${width - margin.right}" y1="${y(rate)}" y2="${y(rate)}"></line><text class="input-chart-tick" x="${margin.left - 6}" y="${y(rate) + 3}" text-anchor="end">${rate}</text>`;
  const step = duration > 120 ? 30 : duration > 60 ? 15 : duration > 20 ? 10 : 5;
  for (let at = 0; at <= duration; at += step)
    grid += `<text class="input-chart-tick" x="${x(at)}" y="${height - 6}" text-anchor="middle">${at}${at ? ' s' : ''}</text>`;
  const sections = summary.sections
    .map((section, index) => {
      const selected = index === selectedSection;
      return `<rect class="input-chart-section${selected ? ' is-selected' : ''}" x="${x(section.start)}" y="${margin.top}" width="${x(section.end) - x(section.start)}" height="${height - margin.top - margin.bottom}"></rect>`;
    })
    .join('');
  const points = summary.samples.map((sample) => `${x(sample.at).toFixed(1)},${y(sample.rate).toFixed(1)}`);
  const line = points.length ? `M${points.join('L')}` : '';
  const area = line ? `${line}L${x(duration)},${y(0)}L${x(0)},${y(0)}Z` : '';
  // Put selection handles and persistent details beneath their ranges, above the separate time tick row.
  const brackets = summary.sections
    .map((section, index) => {
      const left = x(section.start),
        right = x(section.end),
        middle = (left + right) / 2;
      const baseline = y(0) + 5,
        radius = Math.min(5, (right - left) / 4);
      const label = `Section ${index + 1}: ${section.start.toFixed(1)} to ${section.end.toFixed(1)} seconds, ${section.rate.toFixed(1)} actions per second, ${section.count} inputs`;
      const labelX = labels[index].center;
      const labelY = y(0) + 34 + labels[index].row * 36;
      return `<g class="input-chart-bracket" data-select-section="${index}" role="button" tabindex="0" aria-pressed="${index === selectedSection}" aria-label="${label}">
      <rect x="${left}" y="${baseline - 3}" width="${right - left}" height="24" fill="transparent"></rect>
      <path d="M${left},${baseline} v3 q0,${radius} ${radius},${radius} H${right - radius} q${radius},0 ${radius},-${radius} v-3 M${middle},${baseline + radius + 3} v5"></path>
      <rect x="${labelX - labelWidth / 2}" y="${labelY - 12}" width="${labelWidth}" height="30" fill="transparent"></rect>
      <text class="input-chart-range-label" x="${labelX}" y="${labelY}" text-anchor="middle">Section ${index + 1} &middot; ${section.start.toFixed(1)}&ndash;${section.end.toFixed(1)} s</text>
      <text class="input-chart-range-detail" x="${labelX}" y="${labelY + 14}" text-anchor="middle">${section.rate.toFixed(1)} actions/s &middot; ${section.count} inputs</text>
    </g>`;
    })
    .join('');
  const active = host.ownerDocument.activeElement;
  const focusedSection = active && host.contains(active) ? active.getAttribute('data-select-section') : null;
  host.innerHTML = `<svg width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" role="group" aria-label="Manual actions per second over the rotation, with busy sections labeled below">
      ${grid}${sections}<path class="input-chart-area" d="${area}"></path><path class="input-chart-line" d="${line}"></path>
      <g data-chart-marks></g>
      <g data-chart-cross style="display:none"><line class="input-chart-cross" y1="${margin.top}" y2="${height - margin.bottom}"></line><circle class="input-chart-cross-dot" r="3.5"></circle></g>
      <rect data-chart-hit x="${margin.left}" y="${margin.top}" width="${Math.max(0, width - margin.left - margin.right)}" height="${height - margin.top - margin.bottom}" fill="transparent"></rect>
      ${brackets}
    </svg><div class="chart-tooltip"></div>`;

  const hit = host.querySelector<SVGRectElement>('[data-chart-hit]')!;
  const cross = host.querySelector<SVGGElement>('[data-chart-cross]')!;
  const tooltip = host.querySelector<HTMLElement>('.chart-tooltip')!;
  const timeAt = (clientX: number): number => {
    const bounds = hit.getBoundingClientRect();
    return Math.max(0, Math.min(duration, ((clientX - bounds.left) / bounds.width) * duration));
  };

  const sectionAt = (at: number): number =>
    summary.sections.findIndex((section) => at >= section.start && at <= section.end);
  hit.addEventListener('pointermove', (event) => {
    const at = timeAt(event.clientX);
    const sample = summary.samples.reduce((best, candidate) =>
      Math.abs(candidate.at - at) < Math.abs(best.at - at) ? candidate : best
    );
    cross.style.display = '';
    cross.querySelector('line')!.setAttribute('x1', String(x(sample.at)));
    cross.querySelector('line')!.setAttribute('x2', String(x(sample.at)));
    cross.querySelector('circle')!.setAttribute('cx', String(x(sample.at)));
    cross.querySelector('circle')!.setAttribute('cy', String(y(sample.rate)));
    const section = sectionAt(sample.at);
    placeInputTooltip(
      host,
      tooltip,
      event.clientX,
      event.clientY,
      `<div><b>${sample.at.toFixed(1)} s</b></div><div>${sample.rate.toFixed(2)} actions/s</div>${section >= 0 ? `<div>Section ${section + 1} &middot; click to select</div>` : ''}`
    );
  });
  hit.addEventListener('pointerleave', () => {
    cross.style.display = 'none';
    tooltip.style.display = 'none';
  });
  hit.addEventListener('click', (event) => {
    const section = sectionAt(timeAt(event.clientX));
    if (section >= 0) onSelectSection(section);
  });
  for (const bracket of host.querySelectorAll<SVGGElement>('[data-select-section]')) {
    const index = Number(bracket.dataset.selectSection);
    bracket.addEventListener('keydown', (event) => {
      if (event.key !== 'Enter' && event.key !== ' ') return;
      event.preventDefault();
      event.stopPropagation();
      onSelectSection(index);
      host.querySelector<SVGGElement>(`[data-select-section="${index}"]`)?.focus({ preventScroll: true });
    });
  }

  // Selection and resizing replace the SVG; preserve keyboard focus on its corresponding range control.
  if (focusedSection != null)
    host.querySelector<SVGGElement>(`[data-select-section="${focusedSection}"]`)?.focus({ preventScroll: true });
}

/** Tick the chart baseline at each emphasised input, coloured by whether it marks a key or a transition. */
export function markInputPaceChart(host: HTMLElement, times: readonly number[], tone: 'key' | 'transition'): void {
  const scale = scales.get(host);
  const marks = host.querySelector('[data-chart-marks]');
  if (!scale || !marks) return;
  marks.innerHTML = times
    .map(
      (at) =>
        `<line class="input-chart-mark is-${tone}" x1="${scale.x(at)}" x2="${scale.x(at)}" y1="${scale.y(0)}" y2="${scale.y(0) - 12}"></line>`
    )
    .join('');
}
