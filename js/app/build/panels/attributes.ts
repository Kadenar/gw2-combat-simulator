import { escapeHtml as esc } from '../../../platform/ui/shared/html.js';
import {
  DERIVED_ATTRIBUTES,
  PERCENT_ATTRIBUTES,
  PRIMARY_ATTRIBUTES,
  SPECIFIC_CONDITION_DURATION_ATTRIBUTES
} from './options.js';

import type { ProfessionAppState } from '../../profession/types.js';

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

  const attributes = app.attributeData.attributes;
  const section = (title: string, names: readonly string[]): string =>
    `<div class="attr-section"><h4>${title}</h4>${names
      .map((name) => {
        let value = attributes[name]?.final || 0;

        if (SPECIFIC_CONDITION_DURATION_ATTRIBUTES.has(name)) {
          value += attributes['Condition Duration']?.final || 0;
        }

        const breakdown = attributes[name]
          ? Object.entries(attributes[name])
              .filter(([key, amount]) => key !== 'final' && amount)
              .map(([key, amount]) => `${key}: ${Math.round(amount * 100) / 100}`)
              .join('\n')
          : '';
        return `<div class="attr-row" title="${esc(breakdown)}"><span class="attr-name">${name}</span>
                <span class="attr-val">${PERCENT_ATTRIBUTES.has(name) ? `${value.toFixed(2)}%` : Math.round(value).toLocaleString()}</span></div>`;
      })
      .join('')}</div>`;
  const list = document.getElementById('attributes-list');

  if (!list) throw new Error('Required attributes list is missing.');
  list.innerHTML = section('Primary', PRIMARY_ATTRIBUTES) + section('Derived', DERIVED_ATTRIBUTES);
}
