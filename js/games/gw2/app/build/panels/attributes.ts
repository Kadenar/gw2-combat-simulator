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

  const hasSecondWeaponSet = app.profession.ui.weaponSwapChangesSet !== false;
  if (!hasSecondWeaponSet) app.attributeWeaponSet = 1;
  weaponSet.disabled = !hasSecondWeaponSet;
  weaponSet.closest('label')?.toggleAttribute('hidden', !hasSecondWeaponSet);
  weaponSet.value = String(app.attributeWeaponSet);
  if (!app.attributeData) {
    throw new Error('Profession attributes must exist before rendering.');
  }

  const list = document.getElementById('attributes-list');
  if (!list) throw new Error('Required attributes list is missing.');
  renderAttributeStats(list, app);
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

/** Render build-relevant conditional controls below the stats, without saving or resimulating on input. */
export function renderAttributeStats(
  container: HTMLElement,
  app: ProfessionAppState,
  input = readAttributePreviewValues(container)
): void {
  const controls = attributeEffectControls(app);
  const values = normalizeAttributePreview(controls, input);
  const expanded = container.querySelector<HTMLDetailsElement>('.attribute-effects')?.open !== false;
  const baseline = calculateBuffedAttributes(app);
  container.innerHTML = `<div class="attribute-values"></div><details class="attribute-effects"${expanded ? ' open' : ''}><summary>Conditional effects <small>Preview only</small></summary>${[
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
              return `<label class="attribute-effect"><span>${esc(control.label)}</span>${input}<small>${esc(control.description)}</small></label>`;
            })
            .join('')}</fieldset>`
        : '';
    })
    .join('')}</details>`;
  const update = (): void => {
    container.querySelector('.attribute-values')!.innerHTML = attributesHtml(
      calculateBuffedAttributes(app, readAttributePreviewValues(container)),
      baseline
    );
  };

  container.querySelector('.attribute-effects')!.addEventListener('input', update);
  container.querySelector('.attribute-effects')!.addEventListener('change', () => {
    const normalized = normalizeAttributePreview(controls, readAttributePreviewValues(container));
    for (const input of container.querySelectorAll<HTMLInputElement>('input[type="number"]'))
      input.value = String(normalized[input.dataset.attributeEffect!]);
    update();
  });
  update();
}

/** Share attribute formatting and breakdowns between the editor and isolated optimizer previews. */
export function attributesHtml(
  data: NonNullable<ProfessionAppState['attributeData']>,
  baseline?: NonNullable<ProfessionAppState['attributeData']>
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
        const scale = percent ? 100 : 1;
        const delta = (Math.round(value * scale) - Math.round(previous * scale)) / scale;

        const breakdown = attributes[name]
          ? Object.entries(attributes[name])
              .filter(([key, amount]) => key !== 'final' && amount)
              .map(([key, amount]) => `${key}: ${Math.round(amount * 100) / 100}`)
              .join('\n')
          : '';
        return `<div class="attr-row" title="${esc(breakdown)}"><span class="attr-name">${name}</span>
                <span class="attr-val${changed ? ' attr-changed' : ''}">${changed ? `<span class="attr-before">${format(previous, percent)} → </span>` : ''}<span class="attr-current">${format(value, percent)}</span>${changed ? `<small class="attr-delta"> (${delta > 0 ? '+' : ''}${format(delta, percent)})</small>` : ''}</span></div>`;
      })
      .join('')}</div>`;
  return section('Primary', PRIMARY_ATTRIBUTES) + section('Derived', DERIVED_ATTRIBUTES);
}
