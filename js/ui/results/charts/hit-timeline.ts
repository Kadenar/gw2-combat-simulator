import { escapeHtml } from '#ui/shared/html.js';

// One resolved hit/tick: time (ms, relative to the DPS window), damage, and
// whether it critically struck (null when deterministic runs use expected crits).
export interface SkillHit {
  readonly t: number;
  readonly v: number;
  readonly crit?: boolean | null;
  readonly activationId?: string;
}

/** Keeps activation packets together, then merges nearby uses within this skill's timeline into readable bursts. */
export function groupSkillHits(hits: readonly SkillHit[]): SkillHit[][] {
  const groups = new Map<string | SkillHit, SkillHit[]>();
  for (const hit of [...hits].sort((left, right) => left.t - right.t)) {
    if (!(hit.v > 0)) continue;
    const key = hit.activationId || hit;
    const group = groups.get(key) || [];
    group.push(hit);
    groups.set(key, group);
  }

  // ponytail: a fixed 1.5s gap defines a burst; add a user control only if skills need different grouping windows.
  const bursts: SkillHit[][] = [];
  let burstEnd = -Infinity;
  for (const group of groups.values()) {
    if (group[0]!.t - burstEnd > 1500) bursts.push([...group]);
    else bursts.at(-1)!.push(...group);
    burstEnd = Math.max(burstEnd, group.at(-1)!.t);
  }

  return bursts.map((burst) => burst.sort((left, right) => left.t - right.t));
}

const hitTime = (timeMs: number): string => `${(timeMs / 1000).toFixed(2)}s`;
const hitGroupLabel = (hits: readonly SkillHit[], offsetMs: number): string =>
  `${hitTime(hits[0]!.t + offsetMs)} · ${hits.length} ${hits.length === 1 ? 'hit' : 'hits'}`;

export interface HitTimelineLayout {
  readonly groups: readonly (readonly SkillHit[])[];
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
  readonly timeOffsetMs?: number;
  readonly groupHits?: boolean;
}

interface ActiveHitTimelineMount {
  readonly token: object;
  resizeObserver?: ResizeObserver;
}

export interface HitTimelineMountOptions extends HitTimelineOptions {
  readonly durationMs: number;
}

// Shared horizontal padding keeps standalone and embedded hit strips aligned
// with the time-series chart's left axis gutter and right margin.
const HIT_TIMELINE_PAD = { right: 16, left: 54 } as const;
const ACTIVE_HIT_TIMELINE_MOUNTS = new WeakMap<HTMLElement, ActiveHitTimelineMount>();

/** Draws damage-weighted hit markers and returns the cast groups used by inspection controls. */
export function drawHitTimeline(
  canvas: HTMLCanvasElement | null | undefined,
  hits: readonly SkillHit[],
  durationMs: number,
  {
    height = 92,
    color = '#b57ce0',
    label = '',
    emptyText = '',
    showAxis = true,
    timeOffsetMs = 0,
    groupHits = true
  }: HitTimelineOptions = {}
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
    bottom: (showAxis ? 18 : 8) + 28,
    left: HIT_TIMELINE_PAD.left
  };
  const plotWidth = Math.max(1, cssWidth - pad.left - pad.right);
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
      context.fillText(
        `${((timeOffsetMs + durationMs * ratio) / 1000).toFixed(durationMs < 10_000 ? 1 : 0)}s`,
        x,
        baseY + 33
      );
    }

    context.textBaseline = 'middle';
  }

  const maxValue = Math.max(1, ...hits.map((hit) => Number(hit.v || 0)));
  const minMarker = Math.min(plotHeight, 8);
  context.strokeStyle = color;
  context.lineWidth = 2;
  context.fillStyle = color;
  context.textAlign = 'left';
  context.textBaseline = 'top';
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

  // One label per burst makes rapid repeated casts readable while preserving every damage marker.
  const groups = groupHits ? groupSkillHits(hits) : hits.filter((hit) => hit.v > 0).map((hit) => [hit]);
  const labelEnds = [-Infinity, -Infinity];
  for (const group of groups) {
    const x = pad.left + (group[0]!.t / durationMs) * plotWidth;
    const timestamp = groupHits ? hitGroupLabel(group, timeOffsetMs) : hitTime(group[0]!.t + timeOffsetMs);
    const labelWidth = context.measureText(timestamp).width;
    const labelX = Math.max(0, Math.min(cssWidth - labelWidth, x - labelWidth / 2));
    // Crowded labels remain available through focus/hover and the expanded hit list.
    const lane = labelEnds.findIndex((end) => labelX >= end + 4);
    if (lane >= 0) {
      context.fillText(timestamp, labelX, baseY + 4 + lane * 13);
      labelEnds[lane] = labelX + labelWidth;
    }
  }

  if (!hits.length && emptyText) {
    context.fillStyle = '#8d8d9f';
    context.textAlign = 'center';
    context.textBaseline = 'middle';
    context.fillText(emptyText, pad.left + plotWidth / 2, pad.top + plotHeight / 2);
  }

  return { cssWidth, height, pad, plotWidth, plotHeight, groups };
}

/** Windows discrete hits to a fight phase and rebases them to the phase start. */
export function filterHitsToPhase(hits: readonly SkillHit[], startMs: number, endMs: number): SkillHit[] {
  if (!hits.length || !(endMs > startMs)) return [];
  return hits.filter((hit) => hit.t >= startMs && hit.t < endMs).map((hit) => ({ ...hit, t: hit.t - startMs }));
}

/** Mounts cast groups with native keyboard controls and an expandable, precise hit breakdown. */
export function mountHitTimeline(
  container: HTMLElement | null | undefined,
  hits: readonly SkillHit[],
  { durationMs, color, label, height = 100, emptyText, showAxis = true, timeOffsetMs = 0 }: HitTimelineMountOptions
): { redraw: () => void } | null {
  if (!container) return null;
  ACTIVE_HIT_TIMELINE_MOUNTS.get(container)?.resizeObserver?.disconnect();
  const mountToken = {};
  const activeMount: ActiveHitTimelineMount = { token: mountToken };
  ACTIVE_HIT_TIMELINE_MOUNTS.set(container, activeMount);
  container.innerHTML = `<div class="chart-canvas-wrap">
      <canvas class="chart-canvas" data-role="hit-timeline-canvas" aria-hidden="true"></canvas>
      <div data-role="hit-groups"></div>
      <div class="chart-tooltip" data-role="hit-timeline-tooltip"></div>
    </div>
    <div class="hit-timeline-detail" data-role="hit-detail" hidden></div>`;
  const canvas = container.querySelector<HTMLCanvasElement>('[data-role="hit-timeline-canvas"]');
  const tooltip = container.querySelector<HTMLElement>('[data-role="hit-timeline-tooltip"]');
  const controls = container.querySelector<HTMLElement>('[data-role="hit-groups"]');
  const detail = container.querySelector<HTMLElement>('[data-role="hit-detail"]');
  const resolvedDuration = Math.max(1, Number(durationMs) || 0);
  let layout: HitTimelineLayout | null = null;
  let selectedGroup: number | null = null;

  const drawDetail = (): void => {
    const group = selectedGroup == null ? null : layout?.groups[selectedGroup];
    if (!group || !detail) return;
    const start = group[0]!.t;
    const duration = Math.max(1, group.at(-1)!.t - start);
    drawHitTimeline(
      detail.querySelector('canvas'),
      group.map((hit) => ({ ...hit, t: hit.t - start })),
      duration,
      {
        color,
        label: 'Individual hits · fight time',
        timeOffsetMs: timeOffsetMs + start,
        groupHits: false
      }
    );
  };

  const selectGroup = (index: number | null): void => {
    if (!detail || !controls) return;
    selectedGroup = index;
    if (tooltip) tooltip.style.display = 'none';
    for (const button of controls.querySelectorAll('button')) {
      button.setAttribute('aria-expanded', String(Number(button.dataset.group) === index));
    }

    const group = index == null ? null : layout?.groups[index];
    detail.hidden = !group;
    if (!group) {
      detail.innerHTML = '';
      return;
    }

    // Expected-crit runs have no per-hit verdict, so omit the otherwise empty critical column.
    const showCritical = group.some((hit) => hit.crit != null);
    detail.innerHTML = `<div class="hit-detail-header"><b>${escapeHtml(hitGroupLabel(group, timeOffsetMs))}</b>
      <button type="button" class="hit-detail-close" data-role="close-hit-detail" aria-label="Close hit details">Close</button></div>
      <div><canvas class="chart-canvas" aria-hidden="true"></canvas></div>
      <div class="hit-detail-table"><table>
        <caption>Individual hits · fight time</caption>
        <thead><tr><th scope="col">Hit</th><th scope="col">Time</th><th scope="col">Damage</th>${showCritical ? '<th scope="col">Critical</th>' : ''}</tr></thead>
        <tbody>${group
          .map(
            (hit, hitIndex) => `<tr><td>${hitIndex + 1}</td><td>${hitTime(hit.t + timeOffsetMs)}</td>
          <td>${Math.round(hit.v).toLocaleString()}</td>${showCritical ? `<td>${hit.crit == null ? '—' : hit.crit ? 'Yes' : 'No'}</td>` : ''}</tr>`
          )
          .join('')}</tbody>
      </table></div>`;
    const close = (): void => {
      selectGroup(null);
      controls.querySelector<HTMLButtonElement>(`[data-group="${index}"]`)?.focus();
    };

    detail.querySelector<HTMLButtonElement>('[data-role="close-hit-detail"]')!.onclick = close;
    detail.onkeydown = (event) => {
      if (event.key === 'Escape') close();
    };

    drawDetail();
    detail.querySelector<HTMLButtonElement>('[data-role="close-hit-detail"]')!.focus({ preventScroll: true });
  };

  const redraw = (): void => {
    if (ACTIVE_HIT_TIMELINE_MOUNTS.get(container)?.token !== mountToken) return;
    layout = drawHitTimeline(canvas, hits, resolvedDuration, {
      height,
      color,
      label,
      emptyText,
      showAxis,
      timeOffsetMs
    });
    if (!layout || !controls) return;
    // Native buttons cover each group's full hit span, supporting mouse, touch, and keyboard inspection.
    if (!controls.children.length) {
      controls.innerHTML = layout.groups
        .map(
          (group, index) =>
            `<button type="button" class="hit-group" data-group="${index}" aria-expanded="false"
          aria-label="${escapeHtml(hitGroupLabel(group, timeOffsetMs))}"></button>`
        )
        .join('');
    }

    for (const button of controls.querySelectorAll<HTMLButtonElement>('button')) {
      const index = Number(button.dataset.group);
      const group = layout.groups[index]!;
      const first = group[0]!;
      const last = group.at(-1)!;
      const left = layout.pad.left + (first.t / resolvedDuration) * layout.plotWidth - 7;
      const width = Math.max(14, ((last.t - first.t) / resolvedDuration) * layout.plotWidth + 14);
      button.style.left = `${left}px`;
      button.style.top = `${layout.pad.top}px`;
      button.style.width = `${width}px`;
      button.style.height = `${layout.plotHeight}px`;
      const hideTooltip = (): void => {
        if (tooltip) tooltip.style.display = 'none';
      };

      const showTooltip = (): void => {
        if (!tooltip || !layout) return;
        tooltip.innerHTML = `<div><b>${escapeHtml(hitGroupLabel(group, timeOffsetMs))}</b></div>
          <div>First hit: ${hitTime(first.t + timeOffsetMs)}</div>
          <div>Last hit: ${hitTime(last.t + timeOffsetMs)}</div>
          <div>Total damage: ${Math.round(group.reduce((sum, hit) => sum + hit.v, 0)).toLocaleString()}</div>`;
        tooltip.style.display = 'block';
        tooltip.style.left = `${Math.max(0, Math.min(left, layout.cssWidth - tooltip.offsetWidth))}px`;
        tooltip.style.top = `${layout.pad.top + layout.plotHeight + 4}px`;
      };

      button.onmouseenter = showTooltip;
      button.onfocus = showTooltip;
      button.onmouseleave = hideTooltip;
      button.onblur = hideTooltip;
      button.onclick = () => selectGroup(selectedGroup === index ? null : index);
      button.onkeydown = (event) => {
        if (event.key === 'Escape') {
          selectGroup(null);
          hideTooltip();
        }
      };
    }

    drawDetail();
  };

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
