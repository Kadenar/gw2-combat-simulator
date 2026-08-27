import { escapeHtml as esc, gw2ApiText } from '../../../platform/ui/shared/html.js';

import type { ProfessionAppState, ProfessionSpecialization } from '../../profession/types.js';

const SPEC_BG = (name: string): string =>
  `https://wiki.guildwars2.com/wiki/Special:FilePath/${encodeURIComponent(name)}_specialization.png`;

/** Clamps every persisted starting resource after a specialization changes its available resource views. */
export function clampStartingResourceValues(app: ProfessionAppState, specialization: string): void {
  for (const definition of app.resourceDefinitions(specialization)) {
    const buildKey = definition.buildKey || 'initialResource';
    const value = Number(app.build[buildKey]);

    if (Number.isFinite(value)) {
      app.build[buildKey] = Math.min(value, definition.maximum);
    }
  }
}

/**
 * @param {ProfessionAppState} app
 * @returns {void}
 */
export function renderTraits(app: ProfessionAppState): void {
  const container = document.getElementById('traits-panel');

  if (!container) throw new Error('Required traits panel is missing.');
  const specializations = app.specializations as unknown as readonly ProfessionSpecialization[];
  const selectedNames = app.build.specializations.map((spec) => spec.name);
  container.innerHTML = app.build.specializations
    .map((selection, lineIndex) => {
      const spec = specializations.find((candidate) => candidate.name === selection.name) || specializations[0];

      if (!spec) return '';
      const picks = selection.traits.split('-').map(Number);
      return `<div class="spec-row" style="--spec-bg:url('${esc(SPEC_BG(spec.name))}')">
                <div class="spec-bg"></div><div class="spec-content">
                    <div class="spec-header-col">
                        <div class="spec-icon-wrap"><img src="${esc(spec.icon)}" alt=""></div>
                        <select class="spec-select" data-line="${lineIndex}">
                            ${specializations
                              .map((candidate) => {
                                const used =
                                  selectedNames.includes(candidate.name) && candidate.name !== selection.name;
                                return `<option value="${esc(candidate.name)}"${candidate.name === selection.name ? ' selected' : ''}${used ? ' disabled' : ''}>${esc(candidate.name)}</option>`;
                              })
                              .join('')}
                        </select>
                    </div>
                    <div class="spec-tiers">${[0, 1, 2]
                      .map((tier) => {
                        const minor = spec.minorTraits[tier];
                        return `${tier ? '<span class="spec-line"></span>' : ''}
                            <div class="spec-tier">
                                <div class="spec-trait-minor" title="${esc(minor.name)}\n${esc(gw2ApiText(minor.description))}"><img src="${esc(minor.icon)}" alt=""></div>
                                <div class="spec-trait-majors">${spec.majorTraits[tier]
                                  .map(
                                    (trait, position) =>
                                      `<div class="spec-trait-major ${picks[tier] === position + 1 ? 'sel' : 'dim'}"
                                        data-line="${lineIndex}" data-tier="${tier}" data-pick="${position + 1}"
                                        title="${esc(trait.name)}\n${esc(gw2ApiText(trait.description))}"><img src="${esc(trait.icon)}" alt=""></div>`
                                  )
                                  .join('')}</div>
                            </div>`;
                      })
                      .join('')}</div>
                </div></div>`;
    })
    .join('');
  container.querySelectorAll('.spec-select').forEach((select) => {
    if (!(select instanceof HTMLSelectElement)) return;
    select.addEventListener('change', () => {
      const line = Number(select.dataset.line);

      if (!Number.isInteger(line) || !app.build.specializations[line]) return;
      app.build.specializations[line] = {
        name: select.value,
        traits: '1-1-1'
      };
      const newSpec = specializations.find((spec) => spec.name === select.value);

      if (newSpec?.elite) {
        app.build.specializations.forEach((other, index) => {
          if (index === line) return;
          const otherSpec = specializations.find((spec) => spec.name === other.name);

          if (otherSpec?.elite) {
            app.build.specializations[index] = {
              name: app.adapter.specializationFallback,
              traits: '1-1-1'
            };
          }
        });
      }

      clampStartingResourceValues(app, app.adapter.eliteSpecialization(app.build));

      app.changed();
    });
  });
  container.querySelectorAll('.spec-trait-major').forEach((trait) => {
    if (!(trait instanceof HTMLElement)) return;
    trait.addEventListener('click', () => {
      const line = Number(trait.dataset.line);
      const tier = Number(trait.dataset.tier);
      const pick = trait.dataset.pick;

      if (!Number.isInteger(line) || !Number.isInteger(tier) || pick === undefined) {
        return;
      }

      const spec = app.build.specializations[line];

      if (!spec) return;
      const picks = spec.traits.split('-');
      picks[tier] = pick;
      spec.traits = picks.join('-');
      app.changed();
    });
  });
}
