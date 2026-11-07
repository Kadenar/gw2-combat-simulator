/** Reserves the Analysis sections before results exist, using the loaded table's responsive layout. */
import { SKILL_COLS } from '#gw2/app/results/breakdown/model.js';
import type { RotationCommand } from '#gw2/platform/builds/rotation.js';
import { escapeHtml } from '#ui/shared/html.js';

/** Distinct casts approximate damage sources; bound the estimate because procs and non-damaging skills need results. */
export function mountAnalysisLoading(container: HTMLElement, rotation: readonly RotationCommand[]): void {
  const skills = new Set(rotation.filter((command) => command.type === 'cast').map((command) => command.skillId));
  const rowCount = Math.min(24, Math.max(4, skills.size));
  const rows = (count: number, columns: number): string =>
    Array.from(
      { length: count },
      () => `<div class="res-row analysis-loading-row">${'<span></span>'.repeat(columns)}</div>`
    ).join('');

  container.insertAdjacentHTML(
    'beforeend',
    `<section class="res-breakdown-section analysis-loading" role="status" aria-label="Loading combat analysis" aria-busy="true">
      <div class="res-breakdown" aria-hidden="true">
        <div class="res-breakdown-part res-damage-breakdown">
          <div class="res-section-title">Damage Breakdown</div>
          <p class="res-scroll-hint">Swipe or scroll horizontally for all metrics <span>↔</span></p>
          <div class="res-skill-scroll">
            <div data-role="skill-breakdown">
              <div class="res-hdr">${SKILL_COLS.map((column) => `<span>${escapeHtml(column.label)}</span>`).join('')}</div>
              ${rows(rowCount, SKILL_COLS.length)}
            </div>
          </div>
        </div>
        <div class="res-breakdown-part res-condition-breakdown">
          <div class="res-section-title">Conditions</div>
          <div class="cond-breakdown">
            <div class="res-condition-group-title">Damaging conditions</div>
            <div class="res-hdr cond-hdr"><span>Condition</span><span>Damage</span><span>Share</span><span>DPS</span><span>Avg Stacks</span><span>Avg dmg / stack</span></div>
            ${rows(5, 6)}
          </div>
        </div>
      </div>
    </section>`
  );
}
