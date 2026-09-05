/** Reconciles rendered timeline rows and binds editing, insertion, and preview interactions. */
import { renderRotationComparison } from '#gw2/app/rotation/comparison.js';
import { timelineInteractionOptions } from '#gw2/app/rotation/editing/timeline.js';
import { renderPalette } from '#gw2/app/rotation/palette/view.js';
import { renderRotationStateSnapshot } from '#gw2/app/rotation/state-snapshot/view.js';
import { bindTimelineInteractions } from '#gw2/app/rotation/timeline/interactions.js';
import { currentTimelineResults, procFilterKey } from '#gw2/app/rotation/timeline/model.js';
import { timelineRowsView, type TimelineRowRender } from '#gw2/app/rotation/timeline/rows.js';
import { renderTimingAnalysis } from '#gw2/app/rotation/timeline/timing/view.js';
import type { ProfessionAppResult, ProfessionAppState } from '#gw2/app/types.js';
import type { Gw2ApplicationBuild } from '#gw2/platform/builds/types.js';
import type { Gw2ProcStep } from '#gw2/platform/resolver/types.js';
import { closeFloatingEditor } from '#ui/rotation/editors/floating-editor.js';
import { mountRotationInsertionCursor } from '#ui/rotation/insertion-cursor.js';

interface RetainedTimelineRow {
  readonly html: string;
  readonly node: HTMLElement;
}

const timelineRowsByRoot = new WeakMap<HTMLElement, Map<string, RetainedTimelineRow>>();
function createTimelineRow(root: HTMLElement, html: string): HTMLElement {
  const template = root.ownerDocument.createElement('template');
  template.innerHTML = html.trim();
  const row = template.content.firstElementChild;
  if (!(row instanceof HTMLElement)) throw new Error('Timeline row rendering produced no element.');
  return row;
}

/** Reuses unchanged keyed rows and changes only DOM positions whose rendered HTML differs. */
export function reconcileTimelineRows(
  root: HTMLElement,
  rows: readonly TimelineRowRender[],
  createRow: (html: string) => HTMLElement = (html) => createTimelineRow(root, html)
): void {
  // Row replacement can activate browser scroll anchoring on the trailing insertion cursor,
  // so retain the user's timeline viewport while updating the rendered rows.
  const scrollTop = root.scrollTop;
  const previous = timelineRowsByRoot.get(root) || new Map<string, RetainedTimelineRow>();
  const next = new Map<string, RetainedTimelineRow>();
  const nodes = rows.map(({ key, html }) => {
    const retained = previous.get(key);
    const entry = retained?.html === html ? retained : { html, node: createRow(html) };
    next.set(key, entry);
    return entry.node;
  });

  nodes.forEach((node, index) => {
    const current = root.children[index] || null;
    if (current !== node) root.insertBefore(node, current);
  });
  while (root.children.length > nodes.length) root.removeChild(root.lastElementChild!);
  root.scrollTop = scrollTop;
  timelineRowsByRoot.set(root, next);
}

/** Converts a DPS-window preview time back to scheduler time for authored-step highlighting. */
export function rotationPreviewSchedulerTimeMs(result: ProfessionAppResult, previewTimeMs: number): number {
  return Number(result.dpsStartTime ?? result.firstHitTime ?? 0) * 1000 + Math.max(0, Number(previewTimeMs) || 0);
}

/** Finds every authored action active at a preview point, falling back to the latest action already started. */
export function authoredStepIndexesAtPreviewTime(
  result: ProfessionAppResult | null | undefined,
  previewTimeMs: number | null | undefined
): number[] {
  if (!result || previewTimeMs == null) return [];
  const schedulerTimeMs = rotationPreviewSchedulerTimeMs(result, previewTimeMs);
  const authored = (result.steps || []).filter((step) => Number(step.ri) >= 0 && !step.invalid);
  const active = authored.filter((step) => {
    const start = Number(step.start || 0);
    const end = Math.max(start, Number(step.end ?? step.start ?? 0));
    return start <= schedulerTimeMs && schedulerTimeMs <= end;
  });
  if (active.length) return [...new Set(active.map((step) => Number(step.ri)))];

  const latestStart = Math.max(
    ...authored.filter((step) => Number(step.start || 0) <= schedulerTimeMs).map((step) => Number(step.start || 0)),
    -Infinity
  );
  return Number.isFinite(latestStart)
    ? [...new Set(authored.filter((step) => Number(step.start || 0) === latestStart).map((step) => Number(step.ri)))]
    : [];
}

/** Applies point-in-time emphasis without rebuilding either timeline or scheduling simulation work. */
export function applyTimelinePreviewHighlight(
  root: HTMLElement | null | undefined,
  result: ProfessionAppResult | null | undefined,
  previewTimeMs: number | null | undefined
): void {
  if (!root) return;
  const indexes = new Set(authoredStepIndexesAtPreviewTime(result, previewTimeMs));
  root.querySelectorAll<HTMLElement>('.rot-skill[data-idx]').forEach((skill) => {
    skill.classList.toggle('rot-preview-active', indexes.has(Number(skill.dataset.idx)));
  });
}

// Merges new proc keys into the visible set. New procs auto-show; previously
// hidden procs stay hidden; procs that disappeared are dropped.
export function syncProcVisibility(app: ProfessionAppState, procSteps: readonly Gw2ProcStep[]): Set<string> {
  const procKeys = new Set(procSteps.map(procFilterKey));
  const current = app.procVisibility instanceof Set ? app.procVisibility : null;
  const knownKeys = app.procVisibilityKeys instanceof Set ? app.procVisibilityKeys : null;
  app.procVisibility = new Set([...procKeys].filter((key) => !knownKeys || !knownKeys.has(key) || current?.has(key)));
  app.procVisibilityKeys = procKeys;
  return app.procVisibility as Set<string>;
}

export interface TimelineRenderOptions {
  readonly root?: HTMLElement | null;
  readonly procRoot?: HTMLElement | null;
  readonly build?: Gw2ApplicationBuild;
  readonly result?: ProfessionAppResult | null;
  readonly readOnly?: boolean;
  readonly previewTimeMs?: number | null;
}

export function renderTimeline(app: ProfessionAppState, options: TimelineRenderOptions = {}): void {
  const readOnly = options.readOnly === true;
  const build = options.build || app.build;
  const rotation = build.rotation;
  const resultIsExplicit = Object.hasOwn(options, 'result');
  const results = resultIsExplicit ? options.result || null : currentTimelineResults(app);
  if (!readOnly && options.root === undefined) renderTimingAnalysis(app, results);
  // Keyed reconciliation retains unchanged rows and may replace changed editor anchors.
  if (!readOnly) closeFloatingEditor();
  const element = options.root === undefined ? document.getElementById('rotation-timeline') : options.root;
  const procElement = options.procRoot === undefined ? document.getElementById('rotation-procs') : options.procRoot;
  if (!element) return;
  element.dataset.buildRevision = String(app.buildRevision);
  element.dataset.resultRevision = String(app.resultRevision);
  element.toggleAttribute('aria-busy', !resultIsExplicit && app.resultRevision !== app.buildRevision);
  element.toggleAttribute('aria-readonly', readOnly);
  const procPanel = procElement?.querySelector<HTMLDetailsElement>('.rotation-procs-wrap') || null;
  // Capture open state before rebuilding the proc panel so it stays open after rendering.
  const procPanelWasOpen = procPanel?.open ?? false;
  element.ondragover = null;
  element.ondragleave = null;
  element.ondrop = null;
  if (!rotation.length) {
    if (!readOnly) app.rotationSkillHighlightKey = null;
    element.classList.add('is-empty');
    element.innerHTML = `<div class="rot-empty">
            <strong>Build your rotation</strong>
            <span>Click or drag skills from the palette above</span>
        </div>`;
    timelineRowsByRoot.delete(element);
    if (procElement) procElement.innerHTML = '';
    if (!readOnly) {
      app.rotationInsertionIndex = mountRotationInsertionCursor({
        root: element,
        insertionIndex: app.rotationInsertionIndex,
        rotationLength: 0,
        onSelect(index) {
          app.rotationInsertionIndex = index;
          renderPalette(app);
          renderTimeline(app);
          renderRotationStateSnapshot(app);
          renderRotationComparison(app);
        },
        onClear() {
          app.rotationInsertionIndex = null;
          renderPalette(app);
          renderTimeline(app);
          renderRotationStateSnapshot(app);
          renderRotationComparison(app);
        }
      });
      bindTimelineInteractions(element, timelineInteractionOptions(app));
    }

    return;
  }

  element.classList.remove('is-empty');
  const procSteps = results?.procSteps || [];
  const procVisibility = procSteps.length
    ? readOnly
      ? new Set(procSteps.map(procFilterKey))
      : syncProcVisibility(app, procSteps)
    : new Set<string>();
  const { rows: timelineRows, procHtml } = timelineRowsView(
    app,
    build,
    results,
    readOnly,
    procVisibility,
    procPanelWasOpen
  );
  if (procElement) procElement.innerHTML = procHtml;
  reconcileTimelineRows(element, timelineRows);
  if (!readOnly) {
    app.rotationInsertionIndex = mountRotationInsertionCursor({
      root: element,
      insertionIndex: app.rotationInsertionIndex,
      rotationLength: rotation.length,
      onSelect(index) {
        app.rotationInsertionIndex = index;
        renderPalette(app);
        renderTimeline(app);
        renderRotationStateSnapshot(app);
        renderRotationComparison(app);
      },
      onClear() {
        app.rotationInsertionIndex = null;
        renderPalette(app);
        renderTimeline(app);
        renderRotationStateSnapshot(app);
        renderRotationComparison(app);
      }
    });
  }

  const applySkillHighlight = (): void => {
    const skills = [...element.querySelectorAll<HTMLElement>('.rot-skill[data-skill-highlight-key]')];
    const key = app.rotationSkillHighlightKey;
    const active = !!key && skills.some((skill) => skill.dataset.skillHighlightKey === key);
    if (!active) app.rotationSkillHighlightKey = null;
    skills.forEach((skill) => {
      const match = active && skill.dataset.skillHighlightKey === key;
      skill.classList.toggle('skill-highlight', match);
      skill.classList.toggle('skill-faded', active && !match);
    });
  };

  if (!readOnly) {
    element.querySelectorAll<HTMLElement>('.rot-skill[data-skill-highlight-key]').forEach((skill) => {
      if (skill.dataset.highlightBound === 'true') return;
      skill.dataset.highlightBound = 'true';
      skill.addEventListener('click', () => {
        const key = skill.dataset.skillHighlightKey;
        app.rotationSkillHighlightKey = app.rotationSkillHighlightKey === key ? null : key;
        applySkillHighlight();
      });
    });
    applySkillHighlight();
  }

  const procFilter = procElement?.querySelector<HTMLDetailsElement>('.proc-filter') || null;
  const activeProcVisibility = app.procVisibility || new Set();
  if (!readOnly && procFilter && procElement) {
    procFilter.addEventListener('toggle', () => {
      app.procFilterOpen = procFilter.open;
    });
    // Proc filter toggles update DOM visibility directly rather than re-rendering,
    // keeping the panel open and avoiding an expensive full timeline rebuild.
    procFilter.querySelectorAll('input[data-proc-key]').forEach((input) => {
      if (!(input instanceof HTMLInputElement)) return;
      input.addEventListener('change', () => {
        const key = input.dataset.procKey || '';
        if (input.checked) activeProcVisibility.add(key);
        else activeProcVisibility.delete(key);

        if (!input.checked && app.rotationSkillHighlightKey === key) {
          app.rotationSkillHighlightKey = null;
          applySkillHighlight();
        }

        app.procFilterOpen = true;
        procElement.querySelectorAll('.proc-icon[data-proc-key]').forEach((procIcon) => {
          if (!(procIcon instanceof HTMLElement)) return;
          procIcon.hidden = !activeProcVisibility.has(procIcon.dataset.procKey || '');
        });
        element.querySelectorAll('.rot-proc-entry[data-proc-key]').forEach((procEntry) => {
          if (!(procEntry instanceof HTMLElement)) return;
          procEntry.hidden = !activeProcVisibility.has(procEntry.dataset.procKey || '');
        });
        const count = procFilter.querySelector('.proc-filter-count');
        if (count) {
          const visible = procFilter.querySelectorAll('input[data-proc-key]:checked').length;
          const total = procFilter.querySelectorAll('input[data-proc-key]').length;
          count.textContent = `${visible}/${total}`;
        }
      });
    });
  }

  const procIconsRow = procElement?.querySelector<HTMLElement>('.proc-icons-row') || null;
  if (!readOnly && procIconsRow) {
    const applyProcHighlight = (): void => {
      const icons = [...procIconsRow.querySelectorAll('.proc-icon[data-proc-key]')];
      const key = app.procHighlightKey;
      const active = !!key && icons.some((icon) => icon instanceof HTMLElement && icon.dataset.procKey === key);
      if (!active) app.procHighlightKey = null;
      icons.forEach((icon) => {
        if (!(icon instanceof HTMLElement)) return;
        const match = active && icon.dataset.procKey === key;
        icon.classList.toggle('proc-highlight', match);
        icon.classList.toggle('proc-faded', active && !match);
      });
    };

    procIconsRow.querySelectorAll('.proc-icon[data-proc-key]').forEach((icon) => {
      if (!(icon instanceof HTMLElement)) return;
      icon.addEventListener('click', () => {
        const key = icon.dataset.procKey;
        app.procHighlightKey = app.procHighlightKey === key ? null : key;
        applyProcHighlight();
      });
    });
    applyProcHighlight();
  }

  if (!readOnly) bindTimelineInteractions(element, timelineInteractionOptions(app));
  applyTimelinePreviewHighlight(element, results, options.previewTimeMs);
}
