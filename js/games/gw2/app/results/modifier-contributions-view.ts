import { escapeHtml } from '#ui/shared/html.js';
import { signedInteger, signedFixed } from '#gw2/app/results/formatting.js';

export interface ResultContribution {
  readonly name: string;
  readonly dpsIncrease: number;
  readonly pctIncrease: number;
  readonly icon?: string;
}

export interface ModifierContributionsModel {
  readonly contributions?: readonly ResultContribution[];
  readonly contributionsStale?: boolean;
  readonly contributionsError?: string;
}

/** Reserves modifier rows with the charts' subtle shimmer, keeping the loading announcement nonvisual. */
function modifierLoadingHtml(): string {
  return `<div class="contrib-loading" role="status" aria-label="Calculating modifier contributions">
    <div class="contrib-loading-skeleton" aria-hidden="true">
      ${Array.from({ length: 4 }, () => '<div class="contrib-loading-row"><span></span><span></span><span></span></div>').join('')}
    </div>
  </div>`;
}

/** Renders modifier status independently so worker completion preserves chart and table interactions. */
export function modifierContributionsHtml(model: ModifierContributionsModel): string {
  const contributions = model.contributions || [];
  const contributionsStale = model.contributionsStale === true;
  const contributionsError = String(model.contributionsError || '');
  // Keep the section identifiable while pending; only assistive technology receives the loading announcement.
  if (contributionsStale) {
    return `<div class="res-contributions">
      <h4><span>Modifier Contributions</span></h4>
      ${modifierLoadingHtml()}
    </div>`;
  }

  return `${
    contributions.length || contributionsError
      ? `<div class="res-contributions">
    <h4>
      <span>Modifier Contributions</span>
    </h4>
    <p class="contrib-disclaimer">Values are estimated by disabling each modifier and rerunning the simulation. They may be misleading if doing so breaks the rotation.</p>
    ${
      contributions.length
        ? `<div class="contrib-table">
      <div class="contrib-hdr">
        <span>Modifier</span><span>DPS Increase</span><span>% Increase</span>
      </div>
      ${contributions
        .map((contribution) => {
          // Keep names passive and provide metric labels for the stacked narrow-panel layout.
          return `<div class="contrib-row">
          <span class="contrib-name">${
            contribution.icon ? `<img src="${escapeHtml(contribution.icon)}" alt="" />` : ''
          }<span class="contrib-name-label">${escapeHtml(contribution.name)}</span></span>
          <span class="contrib-val"><span class="contrib-metric-label">DPS Increase</span><span>${signedInteger(contribution.dpsIncrease)}</span></span>
          <span class="contrib-pct"><span class="contrib-metric-label">% Increase</span><span>${signedFixed(contribution.pctIncrease)}%</span></span>
        </div>`;
        })
        .join('')}
    </div>`
        : contributionsError
          ? `<div class="contrib-pending contrib-error">${escapeHtml(contributionsError)}</div>`
          : ''
    }
  </div>`
      : ''
  }`;
}

/** Keeps a stable section host so completed modifier jobs can refresh their rows without remounting Analysis. */
export function mountModifierContributions(container: HTMLElement, model: ModifierContributionsModel): void {
  container.insertAdjacentHTML(
    'beforeend',
    `<div data-role="modifier-contributions">${modifierContributionsHtml(model)}</div>`
  );
}
