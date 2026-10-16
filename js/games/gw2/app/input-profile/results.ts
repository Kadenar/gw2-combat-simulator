import { INPUT_MODIFIER_CODES } from '#gw2/input/bindings.js';
import { escapeHtml as html } from '#ui/shared/html.js';
import { formatInputBinding, INPUT_CONTROLS } from '#gw2/input/bindings.js';
import { type InputControlId } from '#gw2/platform/skills/input-controls.js';
import { InputProfileError } from '#gw2/input/profile.js';
import { analyzeInputTrace, type InputAnalysis } from '#gw2/input/analysis.js';
import { parseInputBinding } from '#gw2/input/bindings.js';
import type { InputTrace } from '#gw2/platform/results/input-trace.js';
import { activeInputProfile, subscribeInputProfile } from '#gw2/app/input-profile/store.js';
import { ensureInputProfileStyles } from '#gw2/app/input-profile/styles.js';
import {
  summarizeInputAnalysis,
  type InputAnalysisSummary,
  type InputKeyRow,
  type InputTransitionRow
} from '#gw2/app/input-profile/summary.js';
import { inputKeyboardSvg, offKeyboardUsage } from '#gw2/app/input-profile/keyboard.js';
import { drawInputPaceChart, markInputPaceChart, placeInputTooltip } from '#gw2/app/input-profile/pace-chart.js';

type Selection =
  | { readonly kind: 'section'; readonly index: number }
  | { readonly kind: 'key'; readonly binding: string }
  | { readonly kind: 'transition'; readonly index: number };
type Focus =
  | { readonly kind: 'key'; readonly binding: string }
  | { readonly kind: 'code'; readonly code: string }
  | { readonly kind: 'transition'; readonly index: number };
interface Emphasis {
  readonly codes: ReadonlySet<string>;
  readonly bindings: ReadonlySet<string>;
  readonly transition: number | null;
  readonly times: readonly number[];
  readonly tone: 'key' | 'transition';
}

const disclosureState = new WeakMap<Document, boolean>();
const REACH_GROUPS = [
  { id: 'near', label: 'Nearby / mouse', note: 'WASD area and mouse buttons' },
  { id: 'stretch', label: 'Stretch', note: 'T, G, B, 5 and F1–F4' },
  { id: 'far', label: 'Far', note: 'Other keyboard keys' },
  { id: 'unknown', label: 'Unknown', note: 'Unbound or unresolved inputs' }
] as const;

const KEY_ROWS = 6;
const TRANSITION_ROWS = 5;

const controlLabel = (control: InputControlId | null): string =>
  INPUT_CONTROLS.find((action) => action.id === control)?.label ?? 'Unresolved control';
const controlsLabel = (controls: readonly InputControlId[]): string => controls.map(controlLabel).join(' / ');
const percent = (share: number): string => {
  const value = share * 100;
  return `${value > 0 && value < 9.95 ? value.toFixed(1) : Math.round(value)}%`;
};

const plural = (count: number, noun: string, many = `${noun}s`): string => `${count} ${count === 1 ? noun : many}`;

/** Render a binding as keycaps so modifiers read as separate keys held together. */
function keycaps(binding: string): string {
  const parsed = parseInputBinding(binding);

  if (!parsed) return `<kbd class="input-key">${html(formatInputBinding(binding))}</kbd>`;

  return [
    ...parsed.modifiers.map((modifier) => `<kbd class="input-key is-modifier">${modifier}</kbd>`),
    `<kbd class="input-key">${html(formatInputBinding(parsed.key))}</kbd>`
  ].join('<span class="input-key-plus">+</span>');
}

const bindingCodes = (binding: string): string[] => {
  const parsed = parseInputBinding(binding);
  return parsed ? [parsed.key, ...parsed.modifiers.map((modifier) => INPUT_MODIFIER_CODES[modifier])] : [];
};

/** Rotation indices a selection highlights; transitions include both ends of every occurrence. */
function selectionIndices(data: InputAnalysisSummary, selection: Selection): readonly number[] {
  switch (selection.kind) {
    case 'section':
      return data.sections[selection.index]?.rotationIndices ?? [];
    case 'key':
      return data.keys.find((row) => row.binding === selection.binding)?.rotationIndices ?? [];
    case 'transition':
      return data.transitions[selection.index]?.rotationIndices ?? [];
  }
}

function keyCause(row: InputKeyRow): string {
  return [
    plural(row.count, 'action'),
    `${row.reach === 'near' ? 'nearby / mouse' : row.reach + ' reach'}`,
    ...(row.usesModifier ? ['uses modifier'] : [])
  ].join(' · ');
}

const gapLabel = (gap: number): string => (gap < 1 ? `${Math.round(gap * 1000)} ms` : `${gap.toFixed(2)} s`);
function transitionDetail(row: InputTransitionRow): string {
  // Unknown positions, including mouse buttons, add no distance description to the measured timing details.
  const move = row.sameKey ? 'same key' : row.distance == null ? '' : `${row.distance.toFixed(1)} key widths apart`;
  return [plural(row.count, 'occurrence'), `shortest ${gapLabel(row.closestGap)}`, move].filter(Boolean).join(' · ');
}

/** Show counts, reach groups and measured timing in the existing keyboard and timeline views. */
export function mountInputActivity(container: HTMLElement, trace: InputTrace): void {
  let analysis: InputAnalysis | null = null;
  let analysisError: unknown;
  // Analyze once per result/profile so the collapsed label is useful; defer evidence and SVG construction.
  const reanalyze = (): void => {
    analysis = null;
    analysisError = undefined;
    try {
      analysis = analyzeInputTrace(trace, activeInputProfile());
    } catch (error) {
      analysisError = error;
    }
  };

  const summaryHtml = (error: unknown = analysisError): string => {
    if (error)
      return `<summary>Input activity &middot; ${error instanceof InputProfileError ? 'profile unavailable' : 'analysis unavailable'}</summary>`;

    if (!analysis) return '<summary>Input activity &middot; analysis unavailable</summary>';

    const duration = trace.end - trace.start;
    const pace = duration > 0 ? `${(analysis.coverage.actions / duration).toFixed(2)} actions/s` : 'no combat duration';
    return `<summary>Input activity &middot; ${pace}</summary>`;
  };

  reanalyze();
  // Publish the summary as markup before attaching browser behavior, like the other result sections.
  container.insertAdjacentHTML(
    'beforeend',
    `<details class="input-activity rotation-procs-wrap">${summaryHtml()}</details>`
  );
  const mountedPanel = container.querySelector<HTMLDetailsElement>('.input-activity');

  if (!mountedPanel) return;

  const panel = mountedPanel;
  const document = container.ownerDocument;
  ensureInputProfileStyles(document);
  panel.open = disclosureState.get(document) ?? false;
  panel.addEventListener('toggle', () => {
    disclosureState.set(document, panel.open);

    if (panel.open) render();
  });
  let summary: InputAnalysisSummary | null = null;
  let rendered = false;
  let selected: Selection | null = null;
  let hovered: Focus | null = null;

  const clearHighlights = (): void => {
    const timeline = document.getElementById('rotation-timeline');
    timeline?.classList.remove('input-activity-selection');
    timeline?.style.removeProperty('--input-activity-scroll-inset');
    document
      .querySelectorAll('.input-activity-highlight')
      .forEach((node) => node.classList.remove('input-activity-highlight', 'input-activity-start'));
  };

  const highlightTimeline = (indices: ReadonlySet<number>): void => {
    const nodes = [...document.querySelectorAll<HTMLElement>('#rotation-timeline .rot-skill[data-idx]')].filter(
      (node) => indices.has(Number(node.dataset.idx))
    );
    nodes.forEach((node) => node.classList.add('input-activity-highlight'));
    const first = nodes[0];
    const timeline = document.getElementById('rotation-timeline');

    if (!first || !timeline) return;

    first.classList.add('input-activity-start');
    timeline.classList.add('input-activity-selection');
    // Align below the visible clip edge and sticky header without moving any ancestor scroll position.
    const bounds = timeline.getBoundingClientRect();
    const timelineTop = bounds.top + timeline.clientTop;
    let clipTop = 0;
    for (let ancestor = timeline.parentElement; ancestor; ancestor = ancestor.parentElement) {
      const overflow = document.defaultView?.getComputedStyle(ancestor).overflowY;

      if (overflow && /auto|scroll|hidden|clip/.test(overflow))
        clipTop = Math.max(clipTop, ancestor.getBoundingClientRect().top + ancestor.clientTop);
    }

    const header = document.body.hasAttribute('data-rotation-focus')
      ? null
      : document.querySelector<HTMLElement>('#app > header');
    const headerBottom = header?.getBoundingClientRect().bottom ?? 0;
    const visibleTop = Math.max(timelineTop, clipTop, headerBottom);

    // Early inputs cannot scroll above zero. When a sticky header covers the top of an otherwise visible timeline,
    // reserve that strip inside the bounded timeline so they can sit below it, without changing the timeline's outer
    // height or page position. A timeline already scrolled out of view gains no blank space.
    const internalScroll = /auto|scroll/.test(document.defaultView?.getComputedStyle(timeline).overflowY ?? '');

    if (
      internalScroll &&
      timelineTop >= clipTop &&
      headerBottom > timelineTop &&
      bounds.bottom - visibleTop >= first.getBoundingClientRect().height + 40
    )
      timeline.style.setProperty('--input-activity-scroll-inset', `${headerBottom - timelineTop + 20}px`);

    timeline.scrollTo({
      top: timeline.scrollTop + first.getBoundingClientRect().top - visibleTop - 20,
      behavior: document.defaultView?.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'instant' : 'smooth'
    });
  };

  // Hover previews a key or transition; with no hover, a key or transition selection stays emphasised.
  const emphasis = (focus: Focus | null): Emphasis | null => {
    if (!summary || !focus) return null;

    if (focus.kind === 'transition') {
      const row = summary.transitions[focus.index];

      if (!row) return null;

      return {
        codes: new Set([...bindingCodes(row.fromBinding), ...bindingCodes(row.toBinding)]),
        bindings: new Set(),
        transition: focus.index,
        times: row.times,
        tone: 'transition'
      };
    }

    const rows = summary.keys.filter((row) =>
      focus.kind === 'key' ? row.binding === focus.binding : bindingCodes(row.binding).includes(focus.code)
    );
    return {
      codes: new Set([
        ...(focus.kind === 'code' ? [focus.code] : []),
        ...rows.flatMap((row) => bindingCodes(row.binding))
      ]),
      bindings: new Set(rows.map((row) => row.binding)),
      transition: null,
      times: rows.flatMap((row) => row.times),
      tone: 'key'
    };
  };

  const paint = (): void => {
    const focus: Focus | null =
      hovered ??
      (selected?.kind === 'key'
        ? { kind: 'key', binding: selected.binding }
        : selected?.kind === 'transition'
          ? { kind: 'transition', index: selected.index }
          : null);
    const current = emphasis(focus);
    panel.querySelector('.input-kb-svg')?.classList.toggle('has-emphasis', !!current);
    panel
      .querySelectorAll<SVGGElement>('.input-kb-key')
      .forEach((key) => key.classList.toggle('is-emphasis', !!current?.codes.has(key.dataset.keyCode ?? '')));
    panel
      .querySelectorAll<HTMLElement>('[data-select-key]')
      .forEach((row) => row.classList.toggle('is-emphasis', !!current?.bindings.has(row.dataset.selectKey ?? '')));
    panel
      .querySelectorAll<HTMLElement>('[data-select-transition]')
      .forEach((row) =>
        row.classList.toggle('is-emphasis', current?.transition === Number(row.dataset.selectTransition))
      );
    const chart = panel.querySelector<HTMLElement>('[data-input-chart]');

    if (chart) markInputPaceChart(chart, current?.times ?? [], current?.tone ?? 'key');
  };

  const drawChart = (): void => {
    const chart = panel.querySelector<HTMLElement>('[data-input-chart]');

    if (!chart || !summary || !panel.open) return;

    drawInputPaceChart(chart, summary, selected?.kind === 'section' ? selected.index : null, (index) =>
      select({ kind: 'section', index })
    );
    paint();
  };

  // Selecting the active item again clears it, matching a toggle button.
  const select = (next: Selection): void => {
    selected = JSON.stringify(next) === JSON.stringify(selected) ? null : next;
    clearHighlights();

    // Selection updates reuse the analysis, keyboard, and evidence DOM until the profile changes.
    if (summary) {
      for (const button of panel.querySelectorAll<HTMLElement>(
        '[data-select-key], [data-select-transition], [data-select-section]'
      )) {
        const pressed =
          selected?.kind === 'key'
            ? button.dataset.selectKey === selected.binding
            : selected?.kind === 'transition'
              ? button.dataset.selectTransition === String(selected.index)
              : selected?.kind === 'section'
                ? button.dataset.selectSection === String(selected.index)
                : false;
        button.setAttribute('aria-pressed', String(pressed));
      }

      drawChart();
    }

    if (summary && selected) highlightTimeline(new Set(selectionIndices(summary, selected)));
  };

  // Reach groups partition the bar; modifiers share the legend styling but report overlapping usage separately.
  const splitHtml = (data: InputAnalysisSummary): string => {
    if (!data.totalActions) return '';

    const groups = REACH_GROUPS.filter(({ id }) => id !== 'unknown' || data.reachCounts.unknown > 0);
    const share = (id: keyof InputAnalysis['reachCounts']): number => data.reachCounts[id] / data.totalActions;
    return `<div><h4>Key reach</h4>
      <div class="input-split" role="img" aria-label="${groups.map(({ id, label }) => `${label} ${percent(share(id))}`).join(', ')}">${groups
        .filter(({ id }) => data.reachCounts[id] > 0)
        .map(({ id }) => `<i data-component="${id}" style="width:${share(id) * 100}%"></i>`)
        .join('')}</div>
      <div class="input-split-legend">${groups.map(({ id, label, note }) => `<div class="${data.reachCounts[id] ? '' : 'is-zero'}"><i data-component="${id}"></i><span>${label}</span><b>${percent(share(id))}</b><small>${note}</small></div>`).join('')}
        <div class="${data.modifierActions ? '' : 'is-zero'}" data-modifier-usage title="Modifier usage overlaps the reach groups above."><i data-component="modifier"></i><span>Modifiers</span><b>${percent(data.modifierActions / data.totalActions)}</b><small>Shift, Ctrl or Alt &middot; ${plural(data.modifierActions, 'action')}${data.reachCounts.unknown ? ' with known bindings' : ''}</small></div>
      </div></div>`;
  };

  const keyboardHtml = (data: InputAnalysisSummary): string => {
    const offBoard = offKeyboardUsage(data.keyUsage);
    return `<div class="input-kb"><h4>Your keyboard</h4>${inputKeyboardSvg(data.keyUsage)}
      ${offBoard.length ? `<p class="input-muted">Also used: ${offBoard.map((key) => `${keycaps(key.code)} &times;${key.count}`).join(', ')}</p>` : ''}
      <div class="input-kb-legend"><span><i class="is-reach-0"></i>Nearby / mouse</span><span><i class="is-reach-1"></i>Stretch</span><span><i class="is-reach-2"></i>Far</span></div>
      <div class="chart-tooltip"></div></div>`;
  };

  const keysHtml = (data: InputAnalysisSummary): string => {
    const rows = data.keys.slice(0, KEY_ROWS);

    if (!rows.length) return '<div><h4>Keys used most</h4><p class="input-muted">No bound inputs.</p></div>';

    // Relative bars make usage easy to compare; the adjacent percentage still reports the share of all actions.
    const maxCount = Math.max(...rows.map((row) => row.count));
    return `<div><h4>Keys used most</h4>
      <div class="input-rows"><div class="input-rows-head"><span>Key</span><span>Control</span><span>Share of actions</span></div>${rows
        .map(
          (
            row
          ) => `<button type="button" class="input-row" data-select-key="${html(row.binding)}" aria-pressed="${selected?.kind === 'key' && selected.binding === row.binding}">
        <span class="input-row-keys">${keycaps(row.binding)}</span>
        <span class="input-row-name">${html(controlsLabel(row.controls))}<small>${html(keyCause(row))}</small></span>
        <span class="input-row-bar" title="Usage relative to the most-used key"><i data-component="${row.reach}" style="width:${(row.count / maxCount) * 100}%"></i></span>
        <span class="input-row-value">${percent(row.share)}</span>
      </button>`
        )
        .join('')}</div></div>`;
  };

  const transitionsHtml = (data: InputAnalysisSummary): string => {
    const rows = data.transitions.slice(0, TRANSITION_ROWS);
    const simultaneous = data.sameInstantTransitions
      ? `<p class="input-muted">${plural(data.sameInstantTransitions, 'same-instant transition')} excluded from timing ranks.</p>`
      : '';

    if (!rows.length)
      return `<div><h4>Fastest transitions</h4><p class="input-muted">No repeated transitions with a positive gap.</p>${simultaneous}</div>`;

    // Rank recurring timed pairs; simultaneous inputs are noted separately instead of implying fast finger movement.
    const maxCount = Math.max(...rows.map((row) => row.count));
    return `<div><h4>Fastest transitions</h4><div class="input-rows"><div class="input-rows-head input-transition-head"><span>Keys</span><span>Transition</span><span>Count</span><span>Median gap</span></div>${rows
      .map(
        (
          row,
          index
        ) => `<button type="button" class="input-row" data-select-transition="${index}" aria-pressed="${selected?.kind === 'transition' && selected.index === index}">
      <span class="input-row-keys">${keycaps(row.fromBinding)}<span class="input-key-arrow">&rarr;</span>${keycaps(row.toBinding)}</span>
      <span class="input-row-name">${html(controlsLabel(row.fromControls))} &rarr; ${html(controlsLabel(row.toControls))}<small>${html(transitionDetail(row))}</small></span>
      <span class="input-row-bar" title="${plural(row.count, 'occurrence')}"><i data-component="transition" style="width:${(row.count / maxCount) * 100}%"></i></span>
      <span class="input-row-value">${gapLabel(row.medianGap)}</span>
    </button>`
      )
      .join('')}</div>${simultaneous}</div>`;
  };

  const timelineHtml = (data: InputAnalysisSummary): string => {
    if (data.duration <= 0) return '';

    const empty = data.sections.length
      ? ''
      : `<p class="input-muted">${data.duration < 5 ? 'Highlighted sections need a rotation of at least 5 seconds.' : 'No manual inputs to highlight.'}</p>`;
    return `<section><h4>Actions over the rotation</h4>
      <div class="input-chart" data-input-chart></div>${empty}</section>`;
  };

  function render(): void {
    // Closed panels retain the action rate without constructing their evidence DOM.
    if (!panel.open) {
      panel.innerHTML = summaryHtml();
      return;
    }

    if (rendered) {
      drawChart();
      return;
    }

    // Re-rendering replaces the scrollable body; keep its position so selecting near the bottom does not jump.
    const scrollTop = panel.querySelector('.input-activity-body')?.scrollTop ?? 0;
    try {
      if (!analysis) throw analysisError;

      const data = summarizeInputAnalysis(trace, analysis);
      summary = data;
      const missingBindings = analysis.coverage.missing.filter((item) => item.control != null);
      const unresolved = analysis.coverage.missing.filter((item) => item.control == null);
      const missing = [
        missingBindings.length
          ? `Set bindings for ${missingBindings.map((item) => html(controlLabel(item.control))).join(', ')} to identify their keys. They still count toward action pace.`
          : '',
        unresolved.length
          ? `The simulator could not identify the control for ${unresolved.reduce((count, item) => count + item.count, 0)} inputs. This needs a simulator mapping fix; editing your bindings cannot resolve it.`
          : ''
      ]
        .filter(Boolean)
        .join(' ');
      // Keep only actionable mapping messages beside the profile button; the disclosure already shows pace.
      panel.innerHTML = `${summaryHtml()}
        <div class="input-activity-body">
          <section class="input-overview">
            <div>${missing ? `<p>${missing}</p>` : ''}</div>
            <button type="button" class="btn btn-io" data-edit-profile>Keybind profile</button>
          </section>
          ${timelineHtml(data)}
          ${
            data.duration > 0
              ? `<div class="input-evidence"><section>${splitHtml(data)}${keyboardHtml(data)}</section><section>${keysHtml(data)}${transitionsHtml(data)}</section></div>`
              : ''
          }
        </div>`;
      panel.querySelector('.input-activity-body')!.scrollTop = scrollTop;
      rendered = true;
      drawChart();
    } catch (error) {
      summary = null;
      rendered = true;
      panel.innerHTML = `${summaryHtml(error)}<div class="input-activity-body"><p>${html(String(error))}</p>${error instanceof InputProfileError ? '<button type="button" class="btn" data-edit-profile>Reset keybind profile</button>' : ''}</div>`;
    }
  }

  // Delegate once on the persistent disclosure; its contents are replaced on every render.
  const focusOf = (target: EventTarget | null): Focus | null => {
    if (!(target instanceof Element)) return null;

    const key = target.closest<HTMLElement>('[data-select-key]');

    if (key) return { kind: 'key', binding: key.dataset.selectKey ?? '' };

    const transition = target.closest<HTMLElement>('[data-select-transition]');

    if (transition) return { kind: 'transition', index: Number(transition.dataset.selectTransition) };

    const code = target.closest<SVGGElement>('.input-kb-key.is-used');
    return code ? { kind: 'code', code: code.dataset.keyCode ?? '' } : null;
  };

  const sameFocus = (left: Focus | null, right: Focus | null): boolean =>
    JSON.stringify(left) === JSON.stringify(right);
  const keyTooltip = (code: string): string => {
    const usage = summary?.keyUsage.get(code);

    if (!usage || !summary) return '';

    const rows = summary.keys.filter((row) => bindingCodes(row.binding).includes(code));
    return `<div><b>${html(formatInputBinding(code))}</b></div>${rows
      .map(
        (row) =>
          `<div>${html(controlsLabel(row.controls))} &middot; ${plural(row.count, 'press', 'presses')} &middot; ${percent(row.share)} of actions</div>`
      )
      .join('')}${usage.modifier ? '<div>Held as a modifier</div>' : ''}`;
  };

  const enter = (event: Event): void => {
    const focus = focusOf(event.target);

    if (!focus || sameFocus(focus, hovered)) return;

    hovered = focus;
    paint();
  };

  const leave = (event: Event): void => {
    const focus = focusOf(event.target);

    if (!focus || sameFocus(focus, focusOf((event as FocusEvent).relatedTarget))) return;

    hovered = null;
    paint();

    if (focus.kind === 'code') {
      const tooltip = panel.querySelector<HTMLElement>('.input-kb .chart-tooltip');

      if (tooltip) tooltip.style.display = 'none';
    }
  };

  panel.addEventListener('pointerover', enter);
  panel.addEventListener('focusin', enter);
  panel.addEventListener('pointerout', leave);
  panel.addEventListener('focusout', leave);
  panel.addEventListener('pointermove', (event) => {
    const key = (event.target as Element | null)?.closest?.<SVGGElement>('.input-kb-key.is-used');
    const wrapper = panel.querySelector<HTMLElement>('.input-kb');
    const tooltip = wrapper?.querySelector<HTMLElement>('.chart-tooltip');

    if (key && wrapper && tooltip)
      placeInputTooltip(wrapper, tooltip, event.clientX, event.clientY, keyTooltip(key.dataset.keyCode ?? ''));
  });
  panel.addEventListener('click', async (event) => {
    const target = event.target as Element;
    const restore = (selector: string): void =>
      panel.querySelector<HTMLElement>(selector)?.focus({ preventScroll: true });
    const key = target.closest<HTMLElement>('[data-select-key]');
    const transition = target.closest<HTMLElement>('[data-select-transition]');
    const section = target.closest<HTMLElement>('[data-select-section]');

    if (key) {
      select({ kind: 'key', binding: key.dataset.selectKey ?? '' });
      restore(`[data-select-key="${key.dataset.selectKey}"]`);
    } else if (transition) {
      select({ kind: 'transition', index: Number(transition.dataset.selectTransition) });
      restore(`[data-select-transition="${transition.dataset.selectTransition}"]`);
    } else if (section) {
      select({ kind: 'section', index: Number(section.dataset.selectSection) });
      restore(`[data-select-section="${section.dataset.selectSection}"]`);
    } else if (target.closest('[data-edit-profile]')) {
      const { showInputProfileDialog } = await import('#gw2/app/input-profile/view.js');
      showInputProfileDialog(document);
    }
  });

  // The chart measures its container, so redraw when the workspace resizes or the disclosure opens.
  const observer = new ResizeObserver(() => {
    if (!panel.isConnected) observer.disconnect();
    else if (panel.open) drawChart();
  });
  observer.observe(panel);

  // A new result retires the previous selection even when timeline tiles are reused.
  clearHighlights();
  render();
  subscribeInputProfile(() => {
    reanalyze();
    summary = null;
    rendered = false;
    selected = null;
    hovered = null;
    clearHighlights();
    render();
  }, panel);
}
