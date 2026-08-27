import { escapeHtml } from '../../shared/html.js';

// One resolved hit/tick: time (ms, relative to the DPS window), damage, and
// whether it critically struck (null when deterministic runs use expected crits).
export interface SkillHit {
  readonly t: number;
  readonly v: number;
  readonly crit?: boolean | null;
}

export interface HitTimelineLayout {
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

interface HitTimelineOptions {
  readonly height?: number;
  readonly color?: string;
  readonly label?: string;
  readonly emptyText?: string;
  readonly showAxis?: boolean;
}

interface ActiveHitTimelineMount {
  readonly token: object;
  resizeObserver?: ResizeObserver;
}

export interface HitTimelineMountOptions {
  readonly durationMs: number;
  readonly color?: string;
  readonly label?: string;
  readonly height?: number;
  readonly emptyText?: string;
}

// Shared horizontal padding keeps standalone and embedded hit strips aligned
// with the time-series chart's left axis gutter and right margin.
const HIT_TIMELINE_PAD = { right: 16, left: 54 } as const;
const ACTIVE_HIT_TIMELINE_MOUNTS = new WeakMap<HTMLElement, ActiveHitTimelineMount>();

/** Draws damage-weighted hit markers and returns the layout used for hover hit-testing. */
export function drawHitTimeline(
  canvas: HTMLCanvasElement | null | undefined,
  hits: readonly SkillHit[],
  durationMs: number,
  { height = 64, color = '#b57ce0', label = '', emptyText = '', showAxis = true }: HitTimelineOptions = {}
): HitTimelineLayout | null {
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
  canvas.style.width = '100%';
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

/** Windows discrete hits to a fight phase and rebases them to the phase start. */
export function filterHitsToPhase(hits: readonly SkillHit[], startMs: number, endMs: number): SkillHit[] {
  if (!hits.length || !(endMs > startMs)) return [];
  return hits
    .filter((hit) => hit.t >= startMs && hit.t < endMs)
    .map((hit) => ({ t: hit.t - startMs, v: hit.v, crit: hit.crit }));
}

/** Binds nearest-marker hover behavior shared by embedded and standalone hit timelines. */
export function bindHitTimelineHover(
  canvas: HTMLCanvasElement | null | undefined,
  tooltip: HTMLElement | null | undefined,
  state: {
    readonly layout: () => HitTimelineLayout | null;
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

/** Mounts a standalone damage-events timeline for a selected skill table row. */
export function mountHitTimeline(
  container: HTMLElement | null | undefined,
  hits: readonly SkillHit[],
  { durationMs, color, label, height = 72, emptyText }: HitTimelineMountOptions
): { redraw: () => void } | null {
  if (!container) return null;
  ACTIVE_HIT_TIMELINE_MOUNTS.get(container)?.resizeObserver?.disconnect();
  const mountToken = {};
  const activeMount: ActiveHitTimelineMount = { token: mountToken };
  ACTIVE_HIT_TIMELINE_MOUNTS.set(container, activeMount);
  container.innerHTML = `<div class="chart-canvas-wrap">
      <canvas class="chart-canvas" data-role="hit-timeline-canvas"></canvas>
      <div class="chart-tooltip" data-role="hit-timeline-tooltip"></div>
    </div>`;
  const canvas = container.querySelector<HTMLCanvasElement>('[data-role="hit-timeline-canvas"]');
  const tooltip = container.querySelector<HTMLElement>('[data-role="hit-timeline-tooltip"]');
  const resolvedDuration = Math.max(1, Number(durationMs) || 0);
  let layout: HitTimelineLayout | null = null;
  const redraw = (): void => {
    if (ACTIVE_HIT_TIMELINE_MOUNTS.get(container)?.token !== mountToken) return;
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
