import { escapeHtml as esc, gw2ApiText } from '#gw2/app/presentation/shared/html.js';

import type { ProfessionAppState, ProfessionSpecialization } from '#gw2/app/types.js';

const SPEC_BG = (name: string): string =>
  `https://wiki.guildwars2.com/wiki/Special:FilePath/${encodeURIComponent(name)}_specialization.png`;

/** Clamps every persisted starting resource after a specialization changes its available resource views. */
export function clampStartingResourceValues(app: ProfessionAppState, specialization: string): void {
  for (const definition of app.resourceDefinitions(specialization)) {
    const buildKey = definition.buildKey || 'initialResource';
    const value = Number(app.build[buildKey]);
    if (Number.isFinite(value)) {
      app.build[buildKey] = Math.min(value, definition.startMaximum ?? definition.maximum);
    }
  }
}

/** Applies one picker choice while keeping specialization lines unique and limiting the build to one elite line. */
export function selectSpecialization(app: ProfessionAppState, line: number, name: string): void {
  const specializations = app.specializations as unknown as readonly ProfessionSpecialization[];
  const current = app.build.specializations[line];
  const selected = specializations.find((specialization) => specialization.name === name);
  if (
    !Number.isInteger(line) ||
    !current ||
    !selected ||
    current.name === name ||
    app.build.specializations.some((specialization, index) => index !== line && specialization.name === name)
  ) {
    return;
  }

  app.build.specializations[line] = { name, traits: '1-1-1' };
  if (selected.elite) {
    app.build.specializations.forEach((specialization, index) => {
      if (index === line) return;
      if (specializations.find((candidate) => candidate.name === specialization.name)?.elite) {
        app.build.specializations[index] = {
          name: app.adapter.specializationFallback,
          traits: '1-1-1'
        };
      }
    });
  }

  clampStartingResourceValues(app, app.adapter.eliteSpecialization(app.build));
  app.changed();
}

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
                    <details class="spec-picker">
                        <summary class="spec-picker-trigger" aria-label="Change ${esc(spec.name)} specialization" title="Change specialization"></summary>
                        <div class="spec-picker-menu">
                            <strong>Select specialization</strong>
                            <div class="spec-picker-options">
                                ${specializations
                                  .map((candidate) => {
                                    const selected = candidate.name === selection.name;
                                    const used = selectedNames.includes(candidate.name);
                                    return `<button type="button" class="spec-picker-option${selected ? ' is-selected' : ''}"
                                      data-line="${lineIndex}" data-specialization="${esc(candidate.name)}"
                                      aria-pressed="${selected}" aria-label="${esc(candidate.name)}" title="${esc(candidate.name)}"${used ? ' disabled' : ''}>
                                        <img src="${esc(candidate.icon)}" alt=""><span>${esc(candidate.name)}</span>
                                    </button>`;
                                  })
                                  .join('')}
                            </div>
                        </div>
                    </details>
                    <div class="spec-heading">${esc(spec.name)}</div>
                    <div class="spec-selection">
                        <img class="spec-selected-icon" src="${esc(spec.icon)}" alt="">
                        <div class="spec-tiers">${[0, 1, 2]
                          .map((tier) => {
                            const minor = spec.minorTraits[tier];
                            return `${tier ? `<span class="spec-line pick-${picks[tier - 1]}"></span>` : ''}
                                <div class="spec-tier pick-${picks[tier]}">
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
                    </div>
                </div></div>`;
    })
    .join('');
  container.querySelectorAll('.spec-picker-option').forEach((button) => {
    if (!(button instanceof HTMLButtonElement)) return;
    button.addEventListener('click', () => {
      selectSpecialization(app, Number(button.dataset.line), button.dataset.specialization || '');
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
