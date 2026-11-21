/**
 * Shows each overridable proc's chance beside this run's observed rate, so a changed override can be checked,
 * and lists procs decided by another roll, such as a critical hit, with the mean chance they rolled.
 */
import type { Gw2ProcRateObservation } from '#gw2/platform/results/proc-rate-observations.js';
import { escapeHtml } from '#ui/shared/html.js';

function percent(value: number): string {
  return `${Number((value * 100).toFixed(1)).toLocaleString()}%`;
}

function count(value: number): string {
  return value.toLocaleString(undefined, { maximumFractionDigits: 1 });
}

/** Mean ± one standard deviation shows how far a single seeded run can drift from the chance. */
function expectedProcs(observation: Gw2ProcRateObservation): string {
  if (!observation.triggers) return '&ndash;';

  const spread = Math.sqrt(observation.procVariance);
  return spread > 0
    ? `${count(observation.expectedProcs)} &plusmn; ${count(spread)}`
    : count(observation.expectedProcs);
}

/**
 * A custom chance names its default beside it so the change is readable without opening the override control.
 * An observed proc has no configured chance; it shows the mean chance its triggers rolled.
 */
function chanceHtml(observation: Gw2ProcRateObservation): string {
  if (!observation.overridable) {
    return observation.triggers
      ? `${percent(observation.chance)}<span class="proc-rate-detail">average</span>`
      : '&ndash;';
  }

  if (!observation.custom || observation.defaultChance === null) return percent(observation.chance);

  return `${percent(observation.chance)}<span class="proc-rate-custom">custom</span><span class="proc-rate-detail">default ${percent(observation.defaultChance)}</span>`;
}

export function procRatesHtml(observations: readonly Gw2ProcRateObservation[]): string {
  if (!observations.length) return '';

  // Internal cooldowns are the usual reason a higher chance adds few procs, so show the column only when one blocked.
  const showBlocked = observations.some((observation) => observation.cooldownBlocked > 0);
  return `<section class="res-proc-rates">
    <div class="res-section-title">Proc Rates</div>
    <div class="proc-rate-scroll" tabindex="0" role="region" aria-label="Proc rates">
      <table class="proc-rate-table">
        <thead><tr>
          <th scope="col">Proc</th>
          <th scope="col">Chance</th>
          <th scope="col">Observed</th>
          <th scope="col">Procs</th>
          <th scope="col">Triggers</th>
          <th scope="col">Expected procs</th>
          ${showBlocked ? '<th scope="col">During ICD</th>' : ''}
        </tr></thead>
        <tbody>
          ${observations
            .map(
              (observation) => `<tr>
            <th scope="row">${escapeHtml(observation.name)}<span class="proc-rate-detail">per ${escapeHtml(observation.opportunity)}</span></th>
            <td>${chanceHtml(observation)}</td>
            <td>${observation.triggers ? percent(observation.procs / observation.triggers) : '&ndash;'}</td>
            <td>${count(observation.procs)}</td>
            <td>${count(observation.triggers)}</td>
            <td>${expectedProcs(observation)}</td>
            ${showBlocked ? `<td>${count(observation.cooldownBlocked)}</td>` : ''}
          </tr>`
            )
            .join('')}
        </tbody>
      </table>
    </div>
    <p class="proc-rate-note">Each trigger rolls the chance once. One simulation uses a fixed random sequence, so the observed rate can differ from the chance. Expected procs show the average &plusmn; one standard deviation for this many triggers.${
      showBlocked ? ' Triggers during an internal cooldown do not roll.' : ''
    }</p>
  </section>`;
}

export function mountProcRates(container: HTMLElement, observations: readonly Gw2ProcRateObservation[]): void {
  container.insertAdjacentHTML('beforeend', procRatesHtml(observations));
}
