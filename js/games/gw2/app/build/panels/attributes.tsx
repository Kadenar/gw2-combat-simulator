import {
  DERIVED_ATTRIBUTES,
  PERCENT_ATTRIBUTES,
  PRIMARY_ATTRIBUTES,
  SPECIFIC_CONDITION_DURATION_ATTRIBUTES
} from '#gw2/app/build/panels/options.js';
import { renderReact } from '#ui/react-root.js';
import { requiredElement } from '#ui/shared/dom.js';

import type { ProfessionAppState } from '#gw2/app/types.js';

interface AttributeSectionProps {
  readonly app: ProfessionAppState;
  readonly names: readonly string[];
  readonly title: string;
}

function AttributeSection({ app, names, title }: AttributeSectionProps) {
  const attributes = app.attributeData?.attributes ?? {};

  return (
    <div className="attr-section">
      <h4>{title}</h4>
      {names.map((name) => {
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

        return (
          <div className="attr-row" title={breakdown} key={name}>
            <span className="attr-name">{name}</span>
            <span className="attr-val">
              {PERCENT_ATTRIBUTES.has(name) ? `${value.toFixed(2)}%` : Math.round(value).toLocaleString()}
            </span>
          </div>
        );
      })}
    </div>
  );
}

/** Projects recalculated attributes into React while the stable weapon-set selector remains template-owned. */
function AttributesPanel({ app }: { readonly app: ProfessionAppState }) {
  return (
    <>
      <AttributeSection app={app} title="Primary" names={PRIMARY_ATTRIBUTES} />
      <AttributeSection app={app} title="Derived" names={DERIVED_ATTRIBUTES} />
    </>
  );
}

/** Retains the build-editor entry point and updates only the React-owned attribute list. */
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
  if (!app.attributeData) throw new Error('Profession attributes must exist before rendering.');

  renderReact(requiredElement('attributes-list'), <AttributesPanel app={app} />);
}
