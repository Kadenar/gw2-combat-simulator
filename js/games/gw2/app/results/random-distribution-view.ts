import { escapeHtml } from '#ui/shared/html.js';
import { resultNumber as number, signedInteger } from '#gw2/app/results/formatting.js';
import { boundedNumber } from '#kernel/core/numeric.js';
import type {
  RandomDistributionProgress,
  RandomDistributionSummary
} from '#gw2/app/simulation/random-distribution/types.js';

export interface RandomDistributionViewModel {
  readonly randomDistribution?: RandomDistributionSummary | null;
  readonly randomDistributionRequested?: boolean;
  readonly randomDistributionStale?: boolean;
  readonly randomDistributionTrials?: number;
  /** Accepts partial progress while the view fills in counts and percentages during a run. */
  readonly randomDistributionProgress?: Partial<RandomDistributionProgress> | null;
  readonly randomDistributionError?: string;
}

export interface RandomDistributionViewOptions {
  readonly onRunRandomDistribution?: () => unknown;
}

function randomDriverNumber(value: unknown, unit: 'count' | 'stacks' | 'value'): string {
  const numeric = Number(value || 0);
  if (unit === 'value') return number(numeric);
  return numeric.toLocaleString(undefined, {
    minimumFractionDigits: Math.abs(numeric) < 10 ? 1 : 0,
    maximumFractionDigits: 1
  });
}

/** Shows percentiles in the range chart, with separate label lanes to keep clustered values readable. */
function randomDistributionRangeHtml(distribution: RandomDistributionSummary): string {
  const markers = [
    { label: '1st pct', value: distribution.p01, className: 'rng-tail' },
    { label: 'P10', value: distribution.p10, className: 'rng-likely' },
    { label: 'Median', value: distribution.p50, className: 'rng-median' },
    { label: 'Expected', value: distribution.mean, className: 'rng-expected' },
    { label: 'P90', value: distribution.p90, className: 'rng-likely' },
    { label: '99th pct', value: distribution.p99, className: 'rng-tail' }
  ];
  const minimum = Math.min(...markers.map((marker) => marker.value));
  const maximum = Math.max(...markers.map((marker) => marker.value));
  const padding = Math.max((maximum - minimum) * 0.08, 1);
  const start = Math.max(0, minimum - padding);
  const end = maximum + padding;
  const position = (value: number): number => 55 + ((value - start) / (end - start)) * 890;
  const lanes: number[] = [];
  const plotted = [...markers]
    .sort((left, right) => left.value - right.value)
    .map((marker) => {
      const x = position(marker.value);
      let lane = lanes.findIndex((previous) => x - previous >= 100);
      if (lane < 0) lane = lanes.length;
      lanes[lane] = x;
      return { ...marker, x, lane };
    });
  const axisY = 30 + lanes.length * 38;
  const halfRange = (distribution.p90 - distribution.p10) / 2;
  const percent = distribution.mean > 0 ? (halfRange / distribution.mean) * 100 : 0;
  return `<div class="rng-range-panel">
    <div class="rng-chart-scroll" tabindex="0" role="region" aria-label="Randomized DPS range chart">
      <svg class="rng-range-chart" viewBox="0 0 1000 ${axisY + 40}" role="img" aria-label="Expected DPS ${number(distribution.mean)}; median ${number(distribution.p50)}; P10 to P90 ${number(distribution.p10)} to ${number(distribution.p90)}; 1st percentile ${number(distribution.p01)}; 99th percentile ${number(distribution.p99)}">
        <line class="rng-axis" x1="25" x2="975" y1="${axisY}" y2="${axisY}" />
        <line class="rng-range-glow" x1="${position(distribution.p10)}" x2="${position(distribution.p90)}" y1="${axisY}" y2="${axisY}" />
        <line class="rng-range-line" x1="${position(distribution.p10)}" x2="${position(distribution.p90)}" y1="${axisY}" y2="${axisY}" />
        ${Array.from({ length: 5 }, (_, index) => {
          const value = start + ((end - start) * index) / 4;
          const x = position(value);
          return `<line class="rng-axis" x1="${x}" x2="${x}" y1="${axisY}" y2="${axisY + 7}" /><text class="rng-axis-label" x="${x}" y="${axisY + 24}">${number(value)}</text>`;
        }).join('')}
        ${plotted
          .map((marker) => {
            const y = axisY - 28 - marker.lane * 38;
            return `<g class="${marker.className}">
            <line class="rng-marker-stem" x1="${marker.x}" x2="${marker.x}" y1="${axisY - 13}" y2="${axisY}" />
            <text class="rng-marker-label" x="${marker.x}" y="${y}">${marker.label}</text>
            <text class="rng-marker-value" x="${marker.x}" y="${y + 16}">${number(marker.value)}</text>
            <circle cx="${marker.x}" cy="${axisY}" r="${marker.className === 'rng-expected' ? 4 : 3}" />
          </g>`;
          })
          .join('')}
      </svg>
    </div>
    <div class="rng-range-summary">
      <span>Likely range: <strong>${number(distribution.p10)}&ndash;${number(distribution.p90)}</strong></span>
      <span title="Half the P10–P90 interval, not standard deviation">Typical spread: <b>&plusmn;${number(halfRange)} DPS (&plusmn;${percent.toFixed(1)}%)</b></span>
    </div>
  </div>`;
}

/** Compares the outcome cohorts using relative impact bars without implying additive attribution. */
function randomDistributionExplanationHtml(distribution: RandomDistributionSummary): string {
  const explanation = distribution.explanation;
  if (!explanation?.drivers?.length) return '';
  const cohort = Math.max(1, Math.round(explanation.cohortPercent || 10));
  const cohortSize = Math.max(1, Math.ceil(Number(distribution.trials || 0) * (cohort / 100)));
  const maxImpact = Math.max(1, ...explanation.drivers.map((driver) => Math.abs(driver.estimatedDpsDelta)));
  return `<div class="rng-explanation">
    <div class="rng-explanation-heading">
      <h4>What drove the difference?</h4>
      <span>Top ${number(cohortSize)} vs bottom ${number(cohortSize)} simulations</span>
    </div>
    <p>The ${number(cohortSize)} highest-DPS simulations averaged ${number(explanation.highDpsMean)} DPS. The ${number(cohortSize)} lowest-DPS simulations averaged ${number(explanation.lowDpsMean)} DPS.</p>
    <div class="rng-table-scroll" tabindex="0" role="region" aria-label="Factors driving DPS differences">
      <table class="rng-driver-table">
        <thead><tr><th scope="col">Factor</th><th scope="col">Low DPS</th><th scope="col">High DPS</th><th scope="col">&Delta;</th><th scope="col">Est. DPS impact</th></tr></thead>
        <tbody>
      ${explanation.drivers
        .map((driver) => {
          const positive = Number(driver.delta) >= 0;
          return `<tr>
          <th scope="row">${escapeHtml(driver.label)}</th>
          <td>${randomDriverNumber(driver.lowAverage, driver.unit)}</td>
          <td>${randomDriverNumber(driver.highAverage, driver.unit)}</td>
          <td class="${positive ? 'rng-positive' : 'rng-negative'}">${positive ? '+' : '&minus;'}${randomDriverNumber(Math.abs(driver.delta), driver.unit)}</td>
          <td><div class="rng-driver-impact ${driver.estimatedDpsDelta >= 0 ? 'rng-positive' : 'rng-negative'}">
            <span class="rng-impact-track" aria-hidden="true"><span style="width: ${(Math.abs(driver.estimatedDpsDelta) / maxImpact) * 100}%"></span></span>
            <strong>&asymp; ${signedInteger(driver.estimatedDpsDelta)} DPS</strong>
          </div></td>
        </tr>`;
        })
        .join('')}
        </tbody>
      </table>
    </div>
    <p class="rng-explanation-note">These are averages across each group, not counts from one simulation. DPS differences are single-variable trend estimates across all outcomes. Related rows can come from the same proc chain, so do not add them together.</p>
  </div>`;
}

/** Appends the requested RNG section without replacing sibling charts or breakdown interactions. */
export function mountRandomDistribution(
  container: HTMLElement | null | undefined,
  model: RandomDistributionViewModel,
  options: RandomDistributionViewOptions = {}
): void {
  if (!container) return;
  const randomDistribution = model.randomDistribution || null;
  const randomDistributionRequested = model.randomDistributionRequested === true;
  const randomDistributionStale = model.randomDistributionStale === true;
  const randomDistributionTrials = Number(randomDistribution?.trials || model.randomDistributionTrials || 0);
  const randomDistributionProgress = model.randomDistributionProgress || {};
  const randomDistributionCompleted = boundedNumber(
    randomDistributionProgress.completed || 0,
    0,
    0,
    randomDistributionTrials
  );
  const randomDistributionPercent = boundedNumber(
    randomDistributionProgress.percent ??
      (randomDistributionTrials > 0 ? (randomDistributionCompleted / randomDistributionTrials) * 100 : 0),
    randomDistributionTrials > 0 ? (randomDistributionCompleted / randomDistributionTrials) * 100 : 0,
    0,
    100
  );
  const randomDistributionError = String(model.randomDistributionError || '');
  const randomDistributionAction = !randomDistributionStale
    ? `<button type="button" class="rng-run-button" data-role="rng-run">
          ${randomDistributionError ? 'Retry' : randomDistribution ? 'Recalculate' : 'Calculate range'}
        </button>`
    : '';

  container.insertAdjacentHTML(
    'beforeend',
    randomDistributionRequested
      ? `<section class="rng-distribution">
    <div class="rng-distribution-heading">
      <div>
        <h4>Randomized DPS range</h4>
        <p>${randomDistribution && !randomDistributionStale && !randomDistributionError ? `Simulated outcome distribution from ${number(randomDistribution.trials)} rotations (randomized inputs).` : 'See how weapon strength and supported random procs affect expected DPS.'}</p>
      </div>
      <div class="rng-distribution-heading-actions">
        ${randomDistributionTrials ? `<span>${number(randomDistributionTrials)} simulations</span>` : ''}
        ${randomDistributionAction}
      </div>
    </div>
    ${
      randomDistributionStale
        ? `<div class="rng-distribution-progress"
          data-role="rng-progress"
          role="progressbar"
          aria-label="Calculating randomized DPS range"
          aria-valuemin="0"
          aria-valuemax="100"
          aria-valuenow="${Math.round(randomDistributionPercent)}">
          <div class="rng-distribution-progress-track">
            <span data-role="rng-progress-bar" style="width: ${randomDistributionPercent}%"></span>
          </div>
          <span data-role="rng-progress-label">${number(
            randomDistributionCompleted
          )} / ${number(randomDistributionTrials)} simulations (${Math.round(randomDistributionPercent)}%)</span>
        </div>`
        : randomDistributionError
          ? `<div class="rng-distribution-status rng-distribution-error">${escapeHtml(randomDistributionError)}</div>`
          : randomDistribution
            ? `${randomDistributionRangeHtml(randomDistribution)}
          ${randomDistributionExplanationHtml(randomDistribution)}`
            : ''
    }
  </section>`
      : ''
  );
  const runRandomDistribution = container.querySelector<HTMLElement>('[data-role="rng-run"]');
  if (runRandomDistribution && typeof options.onRunRandomDistribution === 'function') {
    runRandomDistribution.onclick = () => {
      options.onRunRandomDistribution?.();
    };
  }
}
