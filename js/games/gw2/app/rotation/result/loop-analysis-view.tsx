import { Fragment, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import type { ProfessionAppState } from '#gw2/app/types.js';
import { resultSkillIcon } from '#gw2/app/rotation/shared/icons.js';
import type {
  DetectedRotationLoop,
  RotationLoopAnalysis,
  RotationLoopConfidence,
  RotationLoopStep
} from '#gw2/app/rotation/result/loop-analysis.js';

const LOOP_DIALOG_ID = 'rotation-pattern-dialog';

function LoopIcon() {
  return (
    <svg
      viewBox='0 0 24 24'
      width='15'
      height='15'
      fill='none'
      stroke='currentColor'
      strokeWidth='2'
      strokeLinecap='round'
      strokeLinejoin='round'
      aria-hidden='true'
    >
      <path d='M17 1l4 4-4 4' />
      <path d='M3 11V9a4 4 0 0 1 4-4h14' />
      <path d='M7 23l-4-4 4-4' />
      <path d='M21 13v2a4 4 0 0 1-4 4H3' />
    </svg>
  );
}

function formatDuration(durationMs: number): string {
  const seconds = Math.max(0, durationMs) / 1000;
  return `${seconds.toFixed(seconds < 10 ? 1 : 0)}s`;
}

function formatTimestamp(timestampMs: number): string {
  return `${(timestampMs / 1000).toFixed(1)}s`;
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
  return interval === 2 ? 'Every other loop' : `Every ${interval} loops`;
}

function LoopStep({ app, index, step }: { app: ProfessionAppState; index: number; step: RotationLoopStep }) {
  if (step.kind === 'gap') {
    return (
      <li className='rotation-loop-step is-gap'>
        <span className='rotation-loop-step-number'>{index + 1}.</span>
        <span className='rotation-loop-gap-label'>
          <b>…</b> Variable actions
        </span>
      </li>
    );
  }

  const fallbackIcon = resultSkillIcon(app, { name: step.name, skillId: step.primarySkillId });
  const observedIcons = [...new Set(step.iconVariants.filter(Boolean))];
  if (!observedIcons.length) observedIcons.push(fallbackIcon);
  const conditional = step.name === 'Swap Legends' && observedIcons.length > 1;
  const icons = conditional ? observedIcons.slice(0, 2) : [observedIcons[0]];
  const count = countLabel(step);
  const repeatLabel = step.repeatInterval ? repeatIntervalLabel(step.repeatInterval) : '';
  const flexibleTitle = repeatLabel
    ? `${repeatLabel}; ${Math.round(step.repeatRegularity * 100)}% cadence regularity`
    : `Appears in ${Math.round(step.support * 100)}% of detected occurrences or moves within the loop`;

  return (
    <li
      className={`rotation-loop-step${step.placement === 'flexible' ? ' is-flexible' : ''}${conditional ? ' has-conditional-icon' : ''}`}
    >
      <span className='rotation-loop-step-number'>{index + 1}.</span>
      {conditional ? (
        <span className='rotation-loop-conditional-icons' title='Destination varies between matched occurrences'>
          {icons.map((icon, iconIndex) => (
            <Fragment key={icon}>
              {iconIndex ? <span aria-hidden='true'>or</span> : null}
              <img src={icon} alt='' />
            </Fragment>
          ))}
        </span>
      ) : (
        <img src={icons[0]} alt='' />
      )}
      <span className='rotation-loop-step-name'>
        {step.followsPreviousImmediately ? (
          <span className='rotation-loop-step-link' title='Usually follows the previous step immediately'>
            →
          </span>
        ) : null}
        {count ? <b>{count} </b> : null}
        {step.name}
      </span>
      {conditional || step.placement === 'flexible' ? (
        <span className='rotation-loop-step-status'>
          {conditional ? (
            <span className='rotation-loop-conditional' title='The destination differs between detected occurrences'>
              Conditional
            </span>
          ) : null}
          {step.placement === 'flexible' ? (
            <span className='rotation-loop-flexible' title={flexibleTitle}>
              {repeatLabel || 'Flexible'}
            </span>
          ) : null}
        </span>
      ) : null}
    </li>
  );
}

function Occurrences({ loop }: { loop: DetectedRotationLoop }) {
  return (
    <details className='rotation-loop-occurrences'>
      <summary>Review {loop.occurrences.length} matched occurrences</summary>
      <ol>
        {loop.occurrences.map((occurrence, index) => (
          <li key={`${occurrence.startMs}:${index}`}>
            <span>
              {formatTimestamp(occurrence.startMs)}–{formatTimestamp(occurrence.endMs)}
            </span>
            <span>{formatDuration(occurrence.durationMs)}</span>
            <span>
              {occurrence.editCount
                ? `${occurrence.editCount} variation${occurrence.editCount === 1 ? '' : 's'}`
                : 'Exact match'}
            </span>
          </li>
        ))}
      </ol>
    </details>
  );
}

function LoopCard({ app, loop }: { app: ProfessionAppState; loop: DetectedRotationLoop }) {
  const boundaryGuide = loop.mode === 'boundary-guide';
  return (
    <article className={`rotation-loop-card${boundaryGuide ? ' is-boundary-guide' : ''}`}>
      <div className='rotation-loop-card-heading'>
        <div>
          <h4>{loop.label}</h4>
          <span>
            {loop.occurrences.length} occurrences · {formatDuration(loop.averageDurationMs)} average
          </span>
        </div>
        <span
          className={`rotation-loop-confidence is-${loop.confidence}`}
          title={`${Math.round(loop.confidenceScore * 100)}% detector confidence; ${Math.round(loop.consistency * 100)}% median-sequence consistency`}
        >
          {boundaryGuide ? 'Simplified guide' : confidenceLabel(loop.confidence)}
        </span>
      </div>
      <ol className='rotation-loop-steps'>
        {loop.steps.map((step, index) => (
          <LoopStep app={app} step={step} index={index} key={`${step.kind}:${index}`} />
        ))}
      </ol>
      {boundaryGuide ? (
        <div className='rotation-loop-guide-note'>
          Stable opening and closing anchors are shown; variable middle actions are intentionally omitted.
        </div>
      ) : null}
      <Occurrences loop={loop} />
    </article>
  );
}

function PatternDialog({
  analysis,
  app,
  coverage,
  onClose
}: {
  analysis: RotationLoopAnalysis;
  app: ProfessionAppState;
  coverage: number;
  onClose: () => void;
}) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    if (typeof dialog.showModal === 'function') dialog.showModal();
    else dialog.setAttribute('open', '');
    return () => {
      if (dialog.open && typeof dialog.close === 'function') dialog.close();
    };
  }, []);

  return createPortal(
    <dialog
      ref={dialogRef}
      id={LOOP_DIALOG_ID}
      className='rotation-loop-dialog'
      aria-labelledby='rotation-pattern-title'
      data-role='rotation-loop-dialog'
      onClose={onClose}
      onCancel={onClose}
    >
      <div className='rotation-loop-dialog-shell'>
        <header className='rotation-loop-dialog-header'>
          <div className='rotation-loop-dialog-title'>
            <span className='rotation-loop-open-icon'>
              <LoopIcon />
            </span>
            <div>
              <h2 id='rotation-pattern-title'>Rotation Pattern</h2>
              <span>Inferred from successful player activations in this simulation</span>
            </div>
          </div>
          <button
            className='rotation-loop-dialog-close'
            type='button'
            aria-label='Close rotation pattern'
            onClick={onClose}
          >
            ×
          </button>
        </header>
        <div className='rotation-loop-dialog-body'>
          <div className='rotation-loop-summary'>
            <span>{coverage}% of actions are part of a detected loop</span>
            {analysis.trailingActionCount ? (
              <span>
                {analysis.trailingActionCount} trailing action{analysis.trailingActionCount === 1 ? '' : 's'} after the
                final loop
              </span>
            ) : null}
          </div>
          {analysis.loops.length ? (
            <section className='rotation-pattern-section'>
              <div className='rotation-pattern-section-heading'>
                <div>
                  <h3>Opener</h3>
                  <span>Actions before the first detected repeating loop</span>
                </div>
                <span>
                  {analysis.openerActionCount} action{analysis.openerActionCount === 1 ? '' : 's'}
                </span>
              </div>
              {analysis.openerSteps.length ? (
                <article className='rotation-loop-card rotation-opener-card'>
                  <ol className='rotation-loop-steps'>
                    {analysis.openerSteps.map((step, index) => (
                      <LoopStep app={app} step={step} index={index} key={`${step.kind}:${index}`} />
                    ))}
                  </ol>
                </article>
              ) : (
                <div className='rotation-loop-empty is-compact'>
                  <strong>No separate opener detected</strong>
                  <span>The rotation begins directly with the repeating pattern.</span>
                </div>
              )}
            </section>
          ) : null}
          <section className='rotation-pattern-section'>
            <div className='rotation-pattern-section-heading'>
              <div>
                <h3>Repeating Loops</h3>
                <span>Stable action patterns found across the simulation</span>
              </div>
              <span>
                {analysis.loops.length} loop{analysis.loops.length === 1 ? '' : 's'}
              </span>
            </div>
            {analysis.loops.length ? (
              <div className='rotation-loop-grid'>
                {analysis.loops.map((loop) => (
                  <LoopCard app={app} loop={loop} key={loop.id} />
                ))}
              </div>
            ) : (
              <div className='rotation-loop-empty'>
                <strong>No stable repeating loop detected</strong>
                <span>This rotation may be priority-based, too short, or too variable to summarize reliably.</span>
              </div>
            )}
          </section>
        </div>
      </div>
    </dialog>,
    document.body
  );
}

/** Renders loop analysis inside the results root and portals only its modal to the document body. */
export function RotationLoopAnalysisView({
  analysis,
  app
}: {
  readonly analysis: RotationLoopAnalysis;
  readonly app: ProfessionAppState;
}) {
  const [open, setOpen] = useState(false);
  if (analysis.analyzedActionCount < 8) return null;
  const coverage = analysis.analyzedActionCount
    ? Math.round((analysis.coveredActionCount / analysis.analyzedActionCount) * 100)
    : 0;
  const description = analysis.loops.length
    ? `${analysis.openerActionCount ? `${analysis.openerActionCount}-action opener · ` : ''}${analysis.loops.length} repeating loop${analysis.loops.length === 1 ? '' : 's'}`
    : 'No stable repeating loop detected';

  return (
    <section className='rotation-loop-launcher res-breakdown-section' data-role='rotation-loop-analysis'>
      <button
        className='rotation-loop-open'
        type='button'
        aria-haspopup='dialog'
        aria-controls={LOOP_DIALOG_ID}
        onClick={() => setOpen(true)}
      >
        <span className='rotation-loop-open-icon'>
          <LoopIcon />
        </span>
        <span className='rotation-loop-open-copy'>
          <strong>Rotation Pattern</strong>
          <span>{description}</span>
        </span>
        <span className='rotation-loop-open-action'>
          View details <span aria-hidden='true'>→</span>
        </span>
      </button>
      {open ? <PatternDialog analysis={analysis} app={app} coverage={coverage} onClose={() => setOpen(false)} /> : null}
    </section>
  );
}
