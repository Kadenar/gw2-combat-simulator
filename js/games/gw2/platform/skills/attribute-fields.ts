import { ATTRIBUTE_NAMES } from '#gw2/platform/attributes/inputs.js';
import { numberField, type FieldSpecs } from '#gw2/platform/skills/field-specs.js';

/** Named grant maps share validation and patch controls; the owner decides when each group applies. */
export function attributeFields(group = 'attributeBonuses', qualifier = ''): FieldSpecs {
  return {
    [group]: { kind: 'data', attributes: true },
    ...Object.fromEntries(
      Object.entries(ATTRIBUTE_NAMES).map(([attribute, name]) => [
        `${group}.${attribute}`,
        numberField({ label: `${qualifier}${name} bonus`, unit: 'attribute', patch: 'primary' })
      ])
    )
  };
}
