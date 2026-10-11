import { attributePreviewContext } from '#gw2/app/build/attribute-effects.js';
import type { ProfessionAppState } from '#gw2/app/types.js';
import type {
  AttributePreviewValues,
  PreviewControl,
  ProfessionAttributePreviewInput
} from '#gw2/platform/profession-presentation/attribute-preview.js';
import type { Gw2Config } from '#gw2/platform/simulation/config.js';

export interface IsolatedPreview {
  readonly preview: ProfessionAppState;
  readonly context: ProfessionAttributePreviewInput;
  readonly config: Gw2Config;
}

/**
 * Builds a detached copy of the app whose build carries preview boons and passive selections, then recalculates its
 * attributes and simulation configuration. Both preview panels use this path; nothing is written back to the app.
 */
export function createIsolatedPreview(
  app: ProfessionAppState,
  controls: readonly PreviewControl[],
  values: AttributePreviewValues,
  boons: Readonly<Record<string, number | boolean>>,
  weaponSet: number
): IsolatedPreview {
  const preview = {
    ...app,
    build: {
      ...structuredClone(app.build),
      startingWeaponSet: weaponSet,
      assumptions: {
        ...app.build.assumptions,
        ...boons
      }
    },
    results: null
  } as ProfessionAppState;
  // Removing a disabled passive before recalculation also updates conversions that use the passive's attributes.
  for (const control of controls) {
    if (control.kind !== 'passive' || values[control.key]) continue;
    for (const [slot, id] of Object.entries(preview.build.selectedSkillIds)) {
      if (id === control.skillId) preview.build.selectedSkillIds[slot] = null;
    }
  }

  // Common seeds remain independent of health; shared declarations evaluate the preview's health query later.
  const context = { ...attributePreviewContext(preview, weaponSet), values };
  app.adapter.recalculate(preview);
  const config = app.adapter.simulationConfig(preview);
  return { preview, context, config };
}
