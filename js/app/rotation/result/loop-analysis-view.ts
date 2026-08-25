import { escapeHtml } from '../../../platform/ui/html.js';
import type { ProfessionAppState } from '../../profession/types.js';
import { resultSkillIcon } from '../shared/icons.js';
import type {
  DetectedRotationLoop,
  RotationLoopAnalysis,
  RotationLoopConfidence,
  RotationLoopStep
} from './loop-analysis.js';

const LOOP_SECTION_ICON = `<svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M17 1l4 4-4 4"/><path d="M3 11V9a4 4 0 0 1 4-4h14"/><path d="M7 23l-4-4 4-4"/><path d="M21 13v2a4 4 0 0 1-4 4H3"/></svg>`;
const LOOP_DIALOG_ID = 'rotation-pattern-dialog';

function formatDuration(durationMs: number): string {
  const seconds = Math.max(0, durationMs) / 1000;
  return `${seconds.toFixed(seconds < 10 ? 1 : 0)}s`;
}

function formatTimestamp(timestampMs: number): string {
  const seconds = timestampMs / 1000;
  return `${seconds.toFixed(1)}s`;
}

function confidenceLabel(confidence: RotationLoopConfidence): string {
  return `${confidence[0].toUpperCase()}${confidence.slice(1)} confidence`;
}

function countLabel(step: RotationLoopStep): string {
  if (step.maximumCount <= 1) return '';
  const count =
    step.minimumCount === step.maximumCount ? String(step.maximumCount) : `${step.minimumCount}–${step.maximumCount}`;
  return `${count}×`;
}

/** Names detected visit cadences so alternating cooldowns read as instructions instead of vague flexibility. */
function repeatIntervalLabel(interval: number): string {
  if (interval === 2) return 'Every other loop';
  return `Every ${interval} loops`;
}

function stepHtml(app: ProfessionAppState, step: RotationLoopStep, index: number): string {
  if (step.kind === 'gap') {
    return `<li class="rotation-loop-step is-gap">
      <span class="rotation-loop-step-number">${index + 1}.</span>
      <span class="rotation-loop-gap-label"><b>…</b> Variable actions</span>
    </li>`;
  }

  const fallbackIcon = resultSkillIcon(app, {
    name: step.name,
    skillId: step.primarySkillId
  });
  const observedIcons = [...new Set(step.iconVariants.filter(Boolean))];
  if (!observedIcons.length) observedIcons.push(fallbackIcon);
  const conditional = step.name === 'Swap Legends' && observedIcons.length > 1;
  const icons = conditional ? observedIcons : [observedIcons[0]];
  const iconHtml = conditional
    ? `<span class="rotation-loop-conditional-icons" title="Destination varies between matched occurrences">
        ${icons
          .slice(0, 2)
          .map(
            (icon, iconIndex) =>
              `${iconIndex ? '<span aria-hidden="true">or</span>' : ''}<img src="${escapeHtml(icon)}" alt="" />`
          )
          .join('')}
      </span>`
    : `<img src="${escapeHtml(icons[0])}" alt="" />`;
  const count = countLabel(step);
  const repeatLabel = step.repeatInterval ? repeatIntervalLabel(step.repeatInterval) : '';
  const flexibleTitle = repeatLabel
    ? `${repeatLabel}; ${Math.round(step.repeatRegularity * 100)}% cadence regularity`
    : `Appears in ${Math.round(step.support * 100)}% of detected occurrences or moves within the loop`;
  const flexible =
    step.placement === 'flexible'
      ? `<span class="rotation-loop-flexible" title="${escapeHtml(flexibleTitle)}">${escapeHtml(
          repeatLabel || 'Flexible'
        )}</span>`
      : '';
  const conditionalBadge = conditional
    ? '<span class="rotation-loop-conditional" title="The destination differs between detected occurrences">Conditional</span>'
    : '';
  const linked = step.followsPreviousImmediately
    ? '<span class="rotation-loop-step-link" title="Usually follows the previous step immediately">→</span>'
    : '';
  return `<li class="rotation-loop-step${step.placement === 'flexible' ? ' is-flexible' : ''}${conditional ? ' has-conditional-icon' : ''}">
    <span class="rotation-loop-step-number">${index + 1}.</span>
    ${iconHtml}
    <span class="rotation-loop-step-name">${linked}${count ? `<b>${escapeHtml(count)}</b> ` : ''}${escapeHtml(step.name)}</span>
    ${conditionalBadge || flexible ? `<span class="rotation-loop-step-status">${conditionalBadge}${flexible}</span>` : ''}
  </li>`;
}

function occurrenceDetailsHtml(loop: DetectedRotationLoop): string {
  return `<details class="rotation-loop-occurrences">
    <summary>Review ${loop.occurrences.length} matched occurrences</summary>
    <ol>
      ${loop.occurrences
        .map(
          (occurrence) => `<li>
        <span>${formatTimestamp(occurrence.startMs)}–${formatTimestamp(occurrence.endMs)}</span>
        <span>${formatDuration(occurrence.durationMs)}</span>
        <span>${occurrence.editCount ? `${occurrence.editCount} variation${occurrence.editCount === 1 ? '' : 's'}` : 'Exact match'}</span>
      </li>`
        )
        .join('')}
    </ol>
  </details>`;
}

function loopCardHtml(app: ProfessionAppState, loop: DetectedRotationLoop): string {
  const boundaryGuide = loop.mode === 'boundary-guide';
  return `<article class="rotation-loop-card${boundaryGuide ? ' is-boundary-guide' : ''}">
    <div class="rotation-loop-card-heading">
      <div>
        <h4>${escapeHtml(loop.label)}</h4>
        <span>${loop.occurrences.length} occurrences · ${formatDuration(loop.averageDurationMs)} average</span>
      </div>
      <span class="rotation-loop-confidence is-${escapeHtml(loop.confidence)}" title="${Math.round(
        loop.confidenceScore * 100
      )}% detector confidence; ${Math.round(loop.consistency * 100)}% median-sequence consistency">${escapeHtml(
        boundaryGuide ? 'Simplified guide' : confidenceLabel(loop.confidence)
      )}</span>
    </div>
    <ol class="rotation-loop-steps">
      ${loop.steps.map((step, index) => stepHtml(app, step, index)).join('')}
    </ol>
    ${
      boundaryGuide
        ? '<div class="rotation-loop-guide-note">Stable opening and closing anchors are shown; variable middle actions are intentionally omitted.</div>'
        : ''
    }
    ${occurrenceDetailsHtml(loop)}
  </article>`;
}

function openerSectionHtml(app: ProfessionAppState, analysis: RotationLoopAnalysis): string {
  if (!analysis.loops.length) return '';
  return `<section class="rotation-pattern-section">
    <div class="rotation-pattern-section-heading">
      <div>
        <h3>Opener</h3>
        <span>Actions before the first detected repeating loop</span>
      </div>
      <span>${analysis.openerActionCount} action${analysis.openerActionCount === 1 ? '' : 's'}</span>
    </div>
    ${
      analysis.openerSteps.length
        ? `<article class="rotation-loop-card rotation-opener-card">
          <ol class="rotation-loop-steps">
            ${analysis.openerSteps.map((step, index) => stepHtml(app, step, index)).join('')}
          </ol>
        </article>`
        : `<div class="rotation-loop-empty is-compact">
          <strong>No separate opener detected</strong>
          <span>The rotation begins directly with the repeating pattern.</span>
        </div>`
    }
  </section>`;
}

function loopsSectionHtml(app: ProfessionAppState, analysis: RotationLoopAnalysis): string {
  return `<section class="rotation-pattern-section">
    <div class="rotation-pattern-section-heading">
      <div>
        <h3>Repeating Loops</h3>
        <span>Stable action patterns found across the simulation</span>
      </div>
      <span>${analysis.loops.length} loop${analysis.loops.length === 1 ? '' : 's'}</span>
    </div>
    ${
      analysis.loops.length
        ? `<div class="rotation-loop-grid">${analysis.loops.map((loop) => loopCardHtml(app, loop)).join('')}</div>`
        : `<div class="rotation-loop-empty">
          <strong>No stable repeating loop detected</strong>
          <span>This rotation may be priority-based, too short, or too variable to summarize reliably.</span>
        </div>`
    }
  </section>`;
}

function dialogContentHtml(app: ProfessionAppState, analysis: RotationLoopAnalysis, coverage: number): string {
  return `<div class="rotation-loop-dialog-shell">
    <header class="rotation-loop-dialog-header">
      <div class="rotation-loop-dialog-title">
        <span class="rotation-loop-open-icon">${LOOP_SECTION_ICON}</span>
        <div>
          <h2 id="rotation-pattern-title">Rotation Pattern</h2>
          <span>Inferred from successful player activations in this simulation</span>
        </div>
      </div>
      <button class="rotation-loop-dialog-close" type="button" data-role="rotation-loop-close" aria-label="Close rotation pattern">&times;</button>
    </header>
    <div class="rotation-loop-dialog-body">
      <div class="rotation-loop-summary">
        <span>${coverage}% of actions are part of a detected loop</span>
        ${analysis.trailingActionCount ? `<span>${analysis.trailingActionCount} trailing action${analysis.trailingActionCount === 1 ? '' : 's'} after the final loop</span>` : ''}
      </div>
      ${openerSectionHtml(app, analysis)}
      ${loopsSectionHtml(app, analysis)}
    </div>
  </div>`;
}

/** Removes both the in-flow launcher and its body-level dialog when Analysis results are cleared. */
export function removeRotationLoopAnalysis(container: HTMLElement): void {
  container.querySelector('[data-role="rotation-loop-analysis"]')?.remove();
  const dialog = container.ownerDocument.getElementById(LOOP_DIALOG_ID) as HTMLDialogElement | null;
  if (dialog?.open && typeof dialog.close === 'function') dialog.close();
  dialog?.remove();
}

/** Mounts a compact Analysis-page launcher whose dialog separates the pre-loop opener from repeating patterns. */
export function renderRotationLoopAnalysis(
  container: HTMLElement,
  app: ProfessionAppState,
  analysis: RotationLoopAnalysis
): void {
  container.querySelector('[data-role="rotation-loop-analysis"]')?.remove();
  if (analysis.analyzedActionCount < 8) {
    removeRotationLoopAnalysis(container);
    return;
  }

  const coverage = analysis.analyzedActionCount
    ? Math.round((analysis.coveredActionCount / analysis.analyzedActionCount) * 100)
    : 0;
  const section = container.ownerDocument.createElement('section');
  section.className = 'rotation-loop-launcher res-breakdown-section';
  section.dataset.role = 'rotation-loop-analysis';
  section.innerHTML = `<button class="rotation-loop-open" type="button" data-role="rotation-loop-open" aria-haspopup="dialog" aria-controls="${LOOP_DIALOG_ID}">
      <span class="rotation-loop-open-icon">${LOOP_SECTION_ICON}</span>
      <span class="rotation-loop-open-copy">
        <strong>Rotation Pattern</strong>
        <span>${
          analysis.loops.length
            ? `${analysis.openerActionCount ? `${analysis.openerActionCount}-action opener · ` : ''}${analysis.loops.length} repeating loop${analysis.loops.length === 1 ? '' : 's'}`
            : 'No stable repeating loop detected'
        }</span>
      </span>
      <span class="rotation-loop-open-action">View details <span aria-hidden="true">→</span></span>
    </button>`;
  const insertionPoint = container.querySelector(
    '.res-breakdown-section, [data-role="result-charts"], .relic-cmp, .res-contributions'
  );
  container.insertBefore(section, insertionPoint);

  const ownerDocument = container.ownerDocument;
  let dialog = ownerDocument.getElementById(LOOP_DIALOG_ID) as HTMLDialogElement | null;
  if (dialog?.tagName !== 'DIALOG') {
    dialog?.remove();
    dialog = null;
  }

  if (!dialog) {
    dialog = ownerDocument.createElement('dialog');
    dialog.id = LOOP_DIALOG_ID;
    dialog.className = 'rotation-loop-dialog';
    dialog.setAttribute('aria-labelledby', 'rotation-pattern-title');
    dialog.setAttribute('closedby', 'closerequest');
    dialog.dataset.role = 'rotation-loop-dialog';
    ownerDocument.body?.append(dialog);
  }

  // Keep the modal in the document body so virtualized/scrolled Analysis content cannot unmount it while open.
  dialog.innerHTML = dialogContentHtml(app, analysis, coverage);
  const trigger = section.querySelector<HTMLButtonElement>('[data-role="rotation-loop-open"]');
  const close = dialog.querySelector<HTMLButtonElement>('[data-role="rotation-loop-close"]');
  const closeDialog = (): void => {
    if (!dialog) return;
    if (typeof dialog.close === 'function') dialog.close();
    else dialog.removeAttribute('open');
  };

  trigger?.addEventListener('click', (event) => {
    event.preventDefault();
    event.stopPropagation();
    if (!dialog || dialog.open) return;
    if (typeof dialog.showModal === 'function') dialog.showModal();
    else dialog.setAttribute('open', '');
  });
  close?.addEventListener('click', closeDialog);
}
