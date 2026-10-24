import { escapeHtml as h } from '#ui/shared/html.js';
import { resultNumber as number } from '#gw2/app/results/formatting.js';
import type { EncounterAnalysisPhase } from '#gw2/app/boss-scenarios/analysis-model.js';
import type { EncounterResult } from '#gw2/platform/combat/state/encounter.js';

/** Show DPS only for damage phases; split time still contributes to overall DPS and chart transitions. */
export function mountEncounterAnalysis(
  container: HTMLElement,
  encounter: EncounterResult,
  phases: readonly EncounterAnalysisPhase[]
): void {
  const time = (seconds: number) => `${seconds.toFixed(3)}s`;
  container.insertAdjacentHTML(
    'beforeend',
    `
    <section class="res-breakdown-section" data-role="encounter-analysis"><div class="res-breakdown">
      <h3 class="res-section-title">Encounter phases</h3>
      <div class="boss-analysis-scroll">
        <table class="boss-analysis-table" aria-label="Encounter phase results">
          <thead><tr class="res-hdr"><th scope="col">Phase / split</th><th scope="col">Time</th><th scope="col">Duration</th><th scope="col">Your damage</th><th scope="col">Your phase DPS</th><th scope="col">Group damage</th><th scope="col">Group DPS</th><th scope="col">Overall DPS</th></tr></thead>
          <tbody>${phases
            .filter((phase) => phase.kind === 'boss')
            .map(
              (phase) => `<tr class="res-row" data-encounter-phase="${h(phase.id)}">
            <th scope="row">${h(phase.label)}<small>${h(phase.detail)}${phase.complete ? '' : ' (in progress)'}</small></th>
            <td>${time(phase.startMs / 1000)} &ndash; ${time(phase.endMs / 1000)}</td>
            <td>${time(phase.duration)}</td><td>${number(phase.playerDamage)}</td><td>${number(phase.playerDps)}</td>
            <td>${number(phase.groupDamage)}</td><td>${number(phase.groupDps)}</td><td>${number(phase.overallDps)}</td>
          </tr>`
            )
            .join('')}</tbody>
        </table>
      </div>
      <h3 class="res-section-title">Target health</h3>
      <div class="boss-analysis-scroll">
        <table class="boss-analysis-table boss-analysis-targets" aria-label="Encounter target health">
          <thead><tr class="res-hdr"><th scope="col">Target</th><th scope="col">Current health bar</th><th scope="col">Remaining health</th><th scope="col">Health %</th><th scope="col">Armor</th></tr></thead>
          <tbody>${encounter.targets.map((target) => `<tr class="res-row"><th scope="row">${h(target.name)}</th><td>${number(target.maximumHealth)}</td><td>${number(target.remainingHealth)}</td><td>${((target.remainingHealth / target.maximumHealth) * 100).toFixed(2)}%</td><td>${number(target.armor)}</td></tr>`).join('')}</tbody>
        </table>
      </div>
    </div></section>`
  );
}
