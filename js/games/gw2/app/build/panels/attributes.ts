import { escapeHtml as esc } from '#gw2/app/presentation/shared/html.js';
import { calculateBuffedAttributes } from '#gw2/app/build/buffed-attributes.js';
import {
  attributeEffectControls,
  normalizeAttributePreview,
  type AttributePreviewValues
} from '#gw2/app/build/attribute-effects.js';
import {
  DERIVED_ATTRIBUTES,
  PERCENT_ATTRIBUTES,
  PRIMARY_ATTRIBUTES,
  SPECIFIC_CONDITION_DURATION_ATTRIBUTES
} from '#gw2/app/build/panels/options.js';

import type { ProfessionAppState } from '#gw2/app/types.js';

export function renderAttributes(app: ProfessionAppState): void {
  const weaponSet = document.getElementById('attribute-weapon-set');
  if (!(weaponSet instanceof HTMLInputElement) && !(weaponSet instanceof HTMLSelectElement)) {
    throw new Error('Required attribute weapon-set control is missing.');
  }

  // Attribute previews may inspect either equipped set even when combat swapping is unavailable.
  const hasSecondWeaponSet = Boolean(app.build.alternateWeapons?.[0]);
  if (!hasSecondWeaponSet) app.attributeWeaponSet = 1;
  weaponSet.disabled = !hasSecondWeaponSet;
  weaponSet.closest('label')?.toggleAttribute('hidden', !hasSecondWeaponSet);
  weaponSet.value = String(app.attributeWeaponSet);
  if (!app.attributeData) {
    throw new Error('Profession attributes must exist before rendering.');
  }

  const list = document.getElementById('attributes-list');
  if (!list) throw new Error('Required attributes list is missing.');
  const preview = document.getElementById('attribute-preview');
  if (!preview) throw new Error('Required attribute preview is missing.');
  renderAttributeStats(list, app, readAttributePreviewValues(preview), preview);
}

/** Read only this panel's preview controls, so equipment refreshes retain independent preview choices. */
export function readAttributePreviewValues(container: HTMLElement): AttributePreviewValues {
  return Object.fromEntries(
    Array.from(container.querySelectorAll<HTMLInputElement | HTMLSelectElement>('[data-attribute-effect]'), (input) => [
      input.dataset.attributeEffect!,
      input instanceof HTMLInputElement && input.type === 'checkbox' ? Number(input.checked) : input.value
    ])
  );
}

/** Keep preview inputs independent of saved builds, with an optional host below the editor's gear. */
export function renderAttributeStats(
  container: HTMLElement,
  app: ProfessionAppState,
  input = readAttributePreviewValues(container),
  previewContainer = container
): void {
  const controls = attributeEffectControls(app);
  const values = normalizeAttributePreview(controls, input);
  let durationDetails = container.querySelector('.attr-duration-details')?.getAttribute('aria-expanded') === 'true';
  const baseline = calculateBuffedAttributes(app);
  // Start collapsed, retaining the user's disclosure choice when attributes refresh.
  const previewOpen = previewContainer.querySelector('.attribute-effects')?.hasAttribute('open');
  container.innerHTML = '<div class="attribute-values"></div>';
  const previewHtml = `<details class="attribute-effects"${previewOpen ? ' open' : ''}><summary class="attribute-effects-title">Attribute Preview <small>Preview only</small></summary><div class="attribute-effect-groups">${[
    'Boons',
    'Attunement',
    'Trait conditionals',
    'Other buffs',
    'Target conditions'
  ]
    .map((group) => {
      const members = controls.filter((control) => control.group === group);
      return members.length
        ? `<fieldset><legend>${group}</legend>${members
            .map((control) => {
              const value = values[control.key];
              const attrs = `data-attribute-effect="${esc(control.key)}" aria-label="${esc(control.label)}"`;
              const input = control.options
                ? `<select ${attrs}>${control.options.map((option) => `<option${option === value ? ' selected' : ''}>${esc(option)}</option>`).join('')}</select>`
                : control.max != null
                  ? `<input ${attrs} type="number" min="0" max="${control.max}" step="1" value="${value}">`
                  : `<input ${attrs} type="checkbox"${value ? ' checked' : ''}>`;
              // Keep preview explanations visible beside their controls.
              return `<label class="attribute-effect"><span>${esc(control.label)}</span>${input}<small>${esc(control.description)}</small></label>`;
            })
            .join('')}</fieldset>`
        : '';
    })
    .join('')}</div></details>`;
  if (previewContainer === container) container.insertAdjacentHTML('beforeend', previewHtml);
  else previewContainer.innerHTML = previewHtml;
  const update = (): void => {
    container.querySelector('.attribute-values')!.innerHTML = attributesHtml(
      calculateBuffedAttributes(app, readAttributePreviewValues(previewContainer)),
      baseline,
      durationDetails
    );
    container.querySelector('.attr-duration-details')!.addEventListener('click', () => {
      durationDetails = !durationDetails;
      update();
      container.querySelector<HTMLButtonElement>('.attr-duration-details')!.focus();
    });
  };

  previewContainer.querySelector('.attribute-effects')!.addEventListener('input', update);
  previewContainer.querySelector('.attribute-effects')!.addEventListener('change', () => {
    const normalized = normalizeAttributePreview(controls, readAttributePreviewValues(previewContainer));
    for (const input of previewContainer.querySelectorAll<HTMLInputElement>('input[type="number"]'))
      input.value = String(normalized[input.dataset.attributeEffect!]);
    update();
  });
  update();
}

/** Share attribute formatting and breakdowns between the editor and isolated optimizer previews. */
export function attributesHtml(
  data: NonNullable<ProfessionAppState['attributeData']>,
  baseline?: NonNullable<ProfessionAppState['attributeData']>,
  durationDetails = false
): string {
  const attributes = data.attributes;
  const valueOf = (data: NonNullable<ProfessionAppState['attributeData']>, name: string): number =>
    (data.attributes[name]?.final || 0) +
    (SPECIFIC_CONDITION_DURATION_ATTRIBUTES.has(name) ? data.attributes['Condition Duration']?.final || 0 : 0);
  const format = (value: number, percent: boolean): string =>
    percent ? `${value.toFixed(2)}%` : Math.round(value).toLocaleString();
  const section = (title: string, names: readonly string[]): string =>
    `<div class="attr-section"><h4>${title}</h4>${names
      .map((name) => {
        const value = valueOf(data, name);
        const previous = baseline ? valueOf(baseline, name) : value;
        const percent = PERCENT_ATTRIBUTES.has(name);
        const changed = format(value, percent) !== format(previous, percent);
        // Specific durations include the general bonus; only visible differences need a row until Details opens.
        const specific = SPECIFIC_CONDITION_DURATION_ATTRIBUTES.has(name);
        const differs = specific && format(value, true) !== format(valueOf(data, 'Condition Duration'), true);
        const scale = percent ? 100 : 1;
        const delta = (Math.round(value * scale) - Math.round(previous * scale)) / scale;

        const breakdown = attributes[name]
          ? Object.entries(attributes[name])
              .filter(([key, amount]) => key !== 'final' && amount)
              .map(([key, amount]) => `${key}: ${Math.round(amount * 100) / 100}`)
              .join('\n')
          : '';
        return `<div class="attr-row${specific ? ' attr-specific-duration' : ''}${differs ? ' attr-duration-exception' : ''}"${specific && !differs && !durationDetails ? ' hidden' : ''} title="${esc(breakdown)}"><span class="attr-name">${name}</span>
                <span class="attr-val${changed ? ' attr-changed' : ''}">${changed ? `<span class="attr-before">${format(previous, percent)} → </span>` : ''}<span class="attr-current">${format(value, percent)}</span>${changed ? `<small class="attr-delta"> (${delta > 0 ? '+' : ''}${format(delta, percent)})</small>` : ''}${name === 'Condition Duration' ? ` <button type="button" class="attr-duration-details" aria-expanded="${durationDetails}">Details</button>` : ''}</span></div>`;
      })
      .join('')}</div>`;
  const derived = DERIVED_ATTRIBUTES.filter((name) => !SPECIFIC_CONDITION_DURATION_ATTRIBUTES.has(name)).flatMap(
    (name) => (name === 'Condition Duration' ? [name, ...SPECIFIC_CONDITION_DURATION_ATTRIBUTES] : [name])
  );
  return section('Primary', PRIMARY_ATTRIBUTES) + section('Derived', derived);
}
