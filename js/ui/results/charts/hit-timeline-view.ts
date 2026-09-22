import { escapeHtml } from '#ui/shared/html.js';
import {
  conditionWindow,
  groupSkillHits,
  hitGroupLabel,
  hitTime,
  type ConditionTickContribution,
  type SkillHit
} from '#ui/results/charts/hit-timeline-model.js';
import { clamp } from '#kernel/core/numeric.js';

/** Combine all sources into one payout row; tick counts represent stacks, not application rows. */
function conditionTickTotalsHtml(hits: readonly SkillHit[], offsetMs: number): string {
  const hasUnknown = hits.some((hit) => hit.contributions?.some((entry) => entry.fraction == null));
  return `<div class="condition-attribution-table condition-tick-totals"><table>
    <caption>Combined condition payouts</caption>
    <thead><tr><th scope="col">Damage dealt at</th><th scope="col">Full ticks</th><th scope="col">Full damage</th><th scope="col">Partial ticks</th><th scope="col">Partial damage</th>${hasUnknown ? '<th scope="col">Unknown ticks</th><th scope="col">Unknown damage</th>' : ''}<th scope="col">Total damage</th></tr></thead>
    <tbody>${hits
      .map((hit) => {
        const totals = {
          full: { count: 0, damage: 0 },
          partial: { count: 0, damage: 0 },
          unknown: { count: 0, damage: 0 }
        };
        for (const entry of hit.contributions || []) {
          const bucket = totals[entry.fraction == null ? 'unknown' : entry.fraction === 1 ? 'full' : 'partial'];
          bucket.count += entry.stacks;
          bucket.damage += entry.damage;
        }

        const values = [
          totals.full.count,
          totals.full.damage,
          totals.partial.count,
          totals.partial.damage,
          ...(hasUnknown ? [totals.unknown.count, totals.unknown.damage] : []),
          hit.v
        ];
        return `<tr><th scope="row">${hitTime(hit.t + offsetMs)}</th>${values.map((value) => `<td>${value.toLocaleString()}</td>`).join('')}</tr>`;
      })
      .join('')}</tbody></table></div>`;
}

/** Show the payout timestamp separately from application time, preserving each source's buffered share. */
function tickAttributionHtml(
  contributions: readonly ConditionTickContribution[],
  dealtAtMs: number,
  damage: number
): string {
  const full = contributions.filter((entry) => entry.fraction === 1).length;
  const partial = contributions.filter((entry) => entry.fraction != null && entry.fraction < 1).length;
  const unknown = contributions.length - full - partial;
  return `<details class="condition-tick-attribution"><summary><strong>Damage dealt at ${hitTime(dealtAtMs)} · ${Math.round(damage).toLocaleString()} damage</strong><span>${full} full · ${partial} partial${unknown ? ` · ${unknown} unknown` : ''}</span></summary>
    <div class="condition-attribution-table">
    <table><thead><tr><th scope="col">Source</th><th scope="col">Actor</th><th scope="col">Applied at</th><th scope="col">Damage dealt at</th><th scope="col">Stacks</th><th scope="col">Buffered</th><th scope="col">Damage</th></tr></thead>
    <tbody>${contributions.map((entry) => `<tr><td>${escapeHtml(entry.source)}</td><td>${escapeHtml(entry.actor)}</td><td>${hitTime(entry.appliedAtMs)}</td><td>${hitTime(dealtAtMs)}</td><td>${entry.stacks}</td><td>${entry.fraction == null ? 'Unknown' : `${entry.fraction === 1 ? 'Full' : 'Partial'} · ${Math.round(entry.fraction * 1000)}ms`}</td><td>${Math.round(entry.damage).toLocaleString()}</td></tr>`).join('')}</tbody></table>
    </div></details>`;
}

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
  readonly timeOffsetMs?: number;
  readonly groupHits?: boolean;
}

interface ActiveHitTimelineMount {
  readonly token: object;
  resizeObserver?: ResizeObserver;
}

export interface HitTimelineMountOptions extends HitTimelineOptions {
  readonly durationMs: number;
  readonly timeLabel?: string;
  readonly inspectAllTicks?: boolean;
}

// Shared horizontal padding aligns hit timelines with the time-series chart's axis gutter.
const HIT_TIMELINE_PAD = { right: 16, left: 54 } as const;
const ACTIVE_HIT_TIMELINE_MOUNTS = new WeakMap<HTMLElement, ActiveHitTimelineMount>();

/** Draws damage-weighted hit markers and returns the cast groups used by inspection controls. */
export function drawHitTimeline(
  canvas: HTMLCanvasElement | null | undefined,
  hits: readonly SkillHit[],
  durationMs: number,
  { height = 92, color, label = '', emptyText = '', timeOffsetMs = 0, groupHits = true }: HitTimelineOptions = {}
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
    bottom: 46,
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

  // Every timeline keeps a time axis so both overview and detail markers retain their fight timestamps.
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
  const groups = groupHits ? groupSkillHits(hits, timeOffsetMs) : hits.filter((hit) => hit.v > 0).map((hit) => [hit]);
  const conditionOverview = groupHits && hits.some((hit) => hit.damageType === 'condition');
  const markers = conditionOverview
    ? groups.flatMap((group) =>
        group[0]!.damageType === 'condition' ? [{ ...group[0]!, v: group.reduce((sum, hit) => sum + hit.v, 0) }] : group
      )
    : hits;
  const maxValue = Math.max(1, ...markers.map((hit) => Number(hit.v || 0)));
  const minMarker = Math.min(plotHeight, 8);
  // Resolve the active profession accent for both overview markers and individual tick inspection.
  const markerColor =
    color ||
    canvas.ownerDocument?.defaultView?.getComputedStyle(canvas).getPropertyValue('--accent').trim() ||
    '#b57ce0';
  context.strokeStyle = markerColor;
  context.lineWidth = 2;
  context.fillStyle = markerColor;
  context.textAlign = 'left';
  context.textBaseline = 'top';
  for (const hit of markers) {
    const value = Number(hit.v || 0);
    if (!(value > 0)) continue;
    const x = pad.left + (Number(hit.t || 0) / durationMs) * plotWidth;
    const markerHeight = minMarker + (plotHeight - minMarker) * (value / maxValue);
    // Condition bars summarize window damage; the detail view groups ticks by time and condition.
    if (conditionOverview && hit.damageType === 'condition') {
      const [start, end] = conditionWindow([hit], timeOffsetMs, durationMs);
      context.fillRect(
        pad.left + (start / durationMs) * plotWidth,
        baseY - markerHeight,
        Math.max(1, ((end - start) / durationMs) * plotWidth - 2),
        markerHeight
      );
      continue;
    }

    context.beginPath();
    context.moveTo(x, baseY);
    context.lineTo(x, baseY - markerHeight);
    context.stroke();
  }

  // One label per burst makes rapid repeated casts readable while preserving every damage marker.
  const labelEnds = [-Infinity, -Infinity];
  for (const group of groups) {
    // Dense tick timestamps belong in the detail table; keep its chart axis readable.
    if (!groupHits && group[0]!.damageType === 'condition') continue;
    const [start, end] =
      conditionOverview && group[0]!.damageType === 'condition'
        ? conditionWindow(group, timeOffsetMs, durationMs)
        : [group[0]!.t, group[0]!.t];
    const x = pad.left + ((start + end) / 2 / durationMs) * plotWidth;
    const timestamp = groupHits ? hitGroupLabel(group, timeOffsetMs, durationMs) : hitTime(group[0]!.t + timeOffsetMs);
    const labelWidth = context.measureText(timestamp).width;
    const labelX = clamp(x - labelWidth / 2, 0, cssWidth - labelWidth);
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

/** Separates lingering condition damage from strike bursts on aligned, independently inspectable lanes. */
export function mountHitTimeline(
  container: HTMLElement | null | undefined,
  hits: readonly SkillHit[],
  options: HitTimelineMountOptions
): void {
  if (!container) return;
  for (const previous of [container, ...container.querySelectorAll<HTMLElement>('[data-role="hit-lane"]')]) {
    ACTIVE_HIT_TIMELINE_MOUNTS.get(previous)?.resizeObserver?.disconnect();
    ACTIVE_HIT_TIMELINE_MOUNTS.delete(previous);
  }

  const strikes = hits.filter((hit) => hit.damageType !== 'condition');
  const conditions = hits.filter((hit) => hit.damageType === 'condition');
  if (!strikes.length || !conditions.length) {
    return mountHitTimelineLane(container, hits, {
      ...options,
      label: conditions.length ? [options.label, 'Conditions'].filter(Boolean).join(' · ') : options.label
    });
  }

  container.innerHTML = `<div data-role="hit-lane" role="group" aria-label="Strike damage"></div>
    <div data-role="hit-lane" role="group" aria-label="Condition damage"></div>`;
  [...container.querySelectorAll<HTMLElement>('[data-role="hit-lane"]')].forEach((lane, index) =>
    mountHitTimelineLane(lane, index === 0 ? strikes : conditions, {
      ...options,
      label: [options.label, index === 0 ? 'Strikes' : 'Conditions'].filter(Boolean).join(' · ')
    })
  );
}

/** Mounts native keyboard controls and an expandable, precise hit or tick breakdown for one lane. */
function mountHitTimelineLane(
  container: HTMLElement | null | undefined,
  hits: readonly SkillHit[],
  {
    durationMs,
    color,
    label,
    height = 100,
    emptyText,
    timeOffsetMs = 0,
    timeLabel = 'fight time',
    inspectAllTicks = false
  }: HitTimelineMountOptions
): void {
  if (!container) return;
  ACTIVE_HIT_TIMELINE_MOUNTS.get(container)?.resizeObserver?.disconnect();
  const mountToken = {};
  const activeMount: ActiveHitTimelineMount = { token: mountToken };
  ACTIVE_HIT_TIMELINE_MOUNTS.set(container, activeMount);
  const allTicks = hits.filter((hit) => hit.v > 0).sort((left, right) => left.t - right.t);
  const isCondition = hits[0]?.damageType === 'condition';
  container.innerHTML = `${inspectAllTicks && isCondition ? '<div class="condition-tick-toolbar"><label>View <select data-role="condition-tick-view"><option value="totals">Tick totals</option><option value="sources">Source attribution</option></select></label><span>Select a chart window to filter; select it again to show all ticks.</span></div>' : ''}<div class="chart-canvas-wrap">
      <canvas class="chart-canvas" data-role="hit-timeline-canvas" aria-hidden="true"></canvas>
      <div data-role="hit-groups"></div>
      <div class="chart-tooltip" data-role="hit-timeline-tooltip"></div>
    </div>
    <div class="hit-timeline-detail" data-role="hit-detail" hidden></div>`;
  const canvas = container.querySelector<HTMLCanvasElement>('[data-role="hit-timeline-canvas"]');
  const tooltip = container.querySelector<HTMLElement>('[data-role="hit-timeline-tooltip"]');
  const controls = container.querySelector<HTMLElement>('[data-role="hit-groups"]');
  const detail = container.querySelector<HTMLElement>('[data-role="hit-detail"]');
  const tickView = container.querySelector<HTMLSelectElement>('[data-role="condition-tick-view"]');
  const resolvedDuration = Math.max(1, Number(durationMs) || 0);
  const noun = isCondition ? 'tick' : 'hit';
  const detailLabel = `${isCondition ? 'Ticks by time and condition' : 'Individual hits'} · ${timeLabel}`;
  let layout: HitTimelineLayout | null = null;
  let selectedGroup: number | null = null;
  let detailHits: readonly SkillHit[] = [];

  const drawDetail = (): void => {
    const group = selectedGroup == null ? (tickView ? allTicks : null) : layout?.groups[selectedGroup];
    if (!group?.length || !detail) return;
    const start = group[0]!.t;
    const duration = Math.max(1, group.at(-1)!.t - start);
    drawHitTimeline(
      detail.querySelector('canvas'),
      detailHits.map((hit) => ({ ...hit, t: hit.t - start })),
      duration,
      {
        color,
        label: detailLabel,
        timeOffsetMs: timeOffsetMs + start,
        groupHits: false
      }
    );
  };

  const selectGroup = (index: number | null, focus = true): void => {
    if (!detail || !controls) return;
    selectedGroup = index;
    if (tooltip) tooltip.style.display = 'none';
    for (const button of controls.querySelectorAll('button')) {
      button.setAttribute('aria-expanded', String(Number(button.dataset.group) === index));
    }

    // No selected window means the full fight in the condition inspector; skill timelines still collapse.
    const group = index == null ? (tickView ? allTicks : null) : layout?.groups[index];
    detail.hidden = !group;
    if (!group?.length) {
      detail.hidden = true;
      detail.innerHTML = '';
      return;
    }

    // Sum simultaneous ticks of the same condition across applications for one readable detail entry.
    detailHits = group;
    if (isCondition) {
      const ticks = new Map<string, SkillHit>();
      for (const hit of group) {
        const key = JSON.stringify([hit.t, hit.conditionType || '']);
        const previous = ticks.get(key);
        ticks.set(key, {
          ...hit,
          v: (previous?.v || 0) + hit.v,
          contributions: [...(previous?.contributions || []), ...(hit.contributions || [])]
        });
      }

      detailHits = [...ticks.values()];
    }

    // Show pulse state beside its hit instead of adding a second timeline to the skill details.
    const showEmpowered = group.some((hit) => hit.empowered != null);
    // Expected-crit runs have no per-hit verdict, so omit the otherwise empty critical column.
    const showCritical = group.some((hit) => hit.crit != null);
    const showAttribution = detailHits.some((hit) => hit.contributions?.length);
    const showTriggeredBy = detailHits.some((hit) => hit.triggeredBy);
    const heading =
      index == null
        ? `All ticks · ${detailHits.length} ${noun}${detailHits.length === 1 ? '' : 's'} · ${Math.round(detailHits.reduce((sum, hit) => sum + hit.v, 0)).toLocaleString()} damage`
        : hitGroupLabel(group, timeOffsetMs, resolvedDuration);
    detail.innerHTML = `<div class="hit-detail-header"><b>${escapeHtml(heading)}</b>
      ${index != null ? `<button type="button" class="hit-detail-close" data-role="close-hit-detail" aria-label="${tickView ? 'Clear time selection' : `Close ${noun} details`}">${tickView ? 'Clear selection' : 'Close'}</button>` : ''}</div>
      <div><canvas class="chart-canvas" aria-hidden="true"></canvas></div>
      ${
        showAttribution
          ? tickView?.value === 'totals'
            ? conditionTickTotalsHtml(detailHits, timeOffsetMs)
            : `<p class="condition-tick-note">Buffered time is per stack. Damage includes all stacks and shared rounding.</p>
        <div class="condition-payouts">${detailHits.map((hit) => tickAttributionHtml(hit.contributions || [], hit.t + timeOffsetMs, hit.v)).join('')}</div>`
          : `<div class="hit-detail-table"><table>
        <caption>${escapeHtml(detailLabel)}</caption>
        <thead><tr><th scope="col">${isCondition ? 'Tick' : 'Hit'}</th><th scope="col">Time</th>${isCondition ? '<th scope="col">Condition type</th>' : ''}<th scope="col">Damage</th>${showEmpowered ? '<th scope="col">Pulse</th>' : ''}${showCritical ? '<th scope="col">Critical</th>' : ''}${showTriggeredBy ? '<th scope="col">Triggered by</th>' : ''}${showAttribution ? '<th scope="col">Attribution</th>' : ''}</tr></thead>
        <tbody>${detailHits
          .map(
            (hit, hitIndex) => `<tr><td>${hitIndex + 1}</td><td>${hitTime(hit.t + timeOffsetMs)}</td>
          ${isCondition ? `<td>${escapeHtml(hit.conditionType || 'Unknown')}</td>` : ''}
          <td>${Math.round(hit.v).toLocaleString()}</td>${showEmpowered ? `<td>${hit.empowered == null ? '—' : hit.empowered ? 'Empowered' : 'Normal'}</td>` : ''}${showCritical ? `<td>${hit.crit == null ? '—' : hit.crit ? 'Yes' : 'No'}</td>` : ''}${showTriggeredBy ? `<td>${escapeHtml(hit.triggeredBy || '—')}</td>` : ''}</tr>`
          )
          .join('')}</tbody>
      </table></div>`
      }`;
    const close = (): void => {
      selectGroup(null);
      controls.querySelector<HTMLButtonElement>(`[data-group="${index}"]`)?.focus();
    };

    const closeButton = detail.querySelector<HTMLButtonElement>('[data-role="close-hit-detail"]');
    if (closeButton) closeButton.onclick = close;
    detail.onkeydown = (event) => {
      if (event.key === 'Escape' && selectedGroup != null) {
        event.preventDefault();
        event.stopPropagation();
        close();
      }
    };

    drawDetail();
    if (focus) closeButton?.focus({ preventScroll: true });
  };

  const redraw = (): void => {
    if (ACTIVE_HIT_TIMELINE_MOUNTS.get(container)?.token !== mountToken) return;
    layout = drawHitTimeline(canvas, hits, resolvedDuration, {
      height,
      color,
      label,
      emptyText,
      timeOffsetMs
    });
    if (!layout || !controls) return;
    // A single condition payout still needs a drill-down when it carries application attribution.
    if (!controls.children.length) {
      controls.innerHTML = layout.groups
        .map((group, index) => {
          const attributes = `class="hit-group" data-group="${index}"
            aria-label="${escapeHtml(hitGroupLabel(group, timeOffsetMs, resolvedDuration))}"`;
          return group.length > 1 || group.some((hit) => hit.contributions?.length)
            ? `<button type="button" ${attributes} aria-expanded="false"></button>`
            : `<span ${attributes} tabindex="0" role="img"></span>`;
        })
        .join('');
    }

    for (const button of controls.querySelectorAll<HTMLElement>('[data-group]')) {
      const index = Number(button.dataset.group);
      const group = layout.groups[index]!;
      const first = group[0]!;
      const last = group.at(-1)!;
      const [start, end] = isCondition ? conditionWindow(group, timeOffsetMs, resolvedDuration) : [first.t, last.t];
      const left = layout.pad.left + (start / resolvedDuration) * layout.plotWidth - (isCondition ? 0 : 7);
      const width = isCondition
        ? Math.max(1, ((end - start) / resolvedDuration) * layout.plotWidth)
        : Math.max(14, ((end - start) / resolvedDuration) * layout.plotWidth + 14);
      button.style.left = `${left}px`;
      button.style.top = `${layout.pad.top}px`;
      button.style.width = `${width}px`;
      button.style.height = `${layout.plotHeight}px`;
      const hideTooltip = (): void => {
        if (tooltip) tooltip.style.display = 'none';
      };

      const showTooltip = (): void => {
        if (!tooltip || !layout) return;
        tooltip.innerHTML = `<div><b>${escapeHtml(hitGroupLabel(group, timeOffsetMs, resolvedDuration))}</b></div>
          ${group.length > 1 ? `<div>First ${noun}: ${hitTime(first.t + timeOffsetMs)}</div><div>Last ${noun}: ${hitTime(last.t + timeOffsetMs)}</div>` : ''}
          <div>Total damage: ${Math.round(group.reduce((sum, hit) => sum + hit.v, 0)).toLocaleString()}</div>
          ${isCondition && group.length === 1 ? `<div>Condition type: ${escapeHtml(first.conditionType || 'Unknown')}</div>` : ''}
          ${group.length === 1 && first.empowered != null ? `<div>Pulse: ${first.empowered ? 'Empowered' : 'Normal'}</div>` : ''}
          ${group.length === 1 && first.crit != null ? `<div>Critical: ${first.crit ? 'Yes' : 'No'}</div>` : ''}
          ${group.length === 1 && first.triggeredBy ? `<div>Triggered by: ${escapeHtml(first.triggeredBy)}</div>` : ''}`;
        tooltip.style.display = 'block';
        tooltip.style.left = `${clamp(layout.cssWidth - tooltip.offsetWidth, 0, left)}px`;
        tooltip.style.top = `${layout.pad.top + layout.plotHeight + 4}px`;
      };

      // Keep keyboard inspection stable when scrolling or layout changes move another group under the pointer.
      button.onmouseenter = () => {
        if (!controls.contains(container.ownerDocument.activeElement)) showTooltip();
      };

      button.onfocus = showTooltip;
      button.onmouseleave = () => {
        if (!controls.contains(container.ownerDocument.activeElement)) hideTooltip();
      };

      button.onblur = hideTooltip;
      if (group.length > 1 || group.some((hit) => hit.contributions?.length))
        button.onclick = () => selectGroup(selectedGroup === index ? null : index);
      button.onkeydown = (event) => {
        if (event.key === 'Escape') {
          if (selectedGroup != null) {
            event.preventDefault();
            event.stopPropagation();
          }

          selectGroup(null);
          hideTooltip();
        }
      };
    }

    drawDetail();
  };

  redraw();
  if (tickView) {
    tickView.onchange = () => selectGroup(selectedGroup, false);
    // Open the complete ledger without moving focus from the dialog's initial control.
    selectGroup(null, false);
  }

  const wrap = canvas?.parentElement;
  const ResizeObserverConstructor = container.ownerDocument?.defaultView?.ResizeObserver || globalThis.ResizeObserver;
  if (ResizeObserverConstructor && wrap) {
    activeMount.resizeObserver = new ResizeObserverConstructor(() => {
      const visibleWidth = Math.floor(wrap.clientWidth);
      if (visibleWidth > 0 && visibleWidth !== layout?.cssWidth) redraw();
    });
    activeMount.resizeObserver.observe(wrap);
  }
}
