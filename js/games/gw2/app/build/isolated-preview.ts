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
  readonly disabledTrait: string | null;
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

  // Profession owners may suppress a static trait before rebuilding the isolated conversion pool.
  const context = { ...attributePreviewContext(app), build: preview.build, values };
  const disabledTrait = app.profession.ui.attributePreviewDisabledTrait(context);
  app.adapter.recalculate(preview, disabledTrait);
  const config = app.adapter.simulationConfig(
    preview,
    disabledTrait ? { type: 'Trait', id: `Trait:${disabledTrait}`, name: disabledTrait, label: disabledTrait } : null
  );
  return { preview, context, disabledTrait, config };
}
