import type { ProfessionAppState } from '#gw2/app/types.js';
import { clamp } from '#kernel/core/numeric.js';
import {
  previewControlScopes,
  type PreviewControl,
  type AttributePreviewValues,
  type ProfessionAttributePreviewContext
} from '#gw2/platform/profession-presentation/attribute-preview.js';

/** Supply the active preview catalog and weapon set without exposing application state to profession hooks. */
export function attributePreviewContext(app: ProfessionAppState, weaponSet: number): ProfessionAttributePreviewContext {
  return {
    build: app.build,
    specialization: app.adapter.eliteSpecialization(app.build),
    activeTraits: app.attributeData!.activeTraits,
    weapons: weaponSet === 2 ? app.build.alternateWeapons : app.build.weapons,
    catalog: app.activeCatalog || app.profession.catalog
  };
}

/** Combine common boon and equipment inputs with the active profession's conditional controls. */
export function attributeEffectControls(app: ProfessionAppState): PreviewControl[] {
  const controls: PreviewControl[] = [
    {
      key: 'might',
      label: 'Might',
      group: 'Boons',
      kind: 'boon',
      max: 25,
      description: 'stacks; Power / Condition Damage'
    },
    {
      key: 'fury',
      label: 'Fury',
      group: 'Boons',
      kind: 'boon',
      description: '+25% Critical Chance; selected Fury traits'
    }
  ];
  if (app.build.relic === 'Aristocracy')
    controls.push({
      key: 'aristocracy',
      label: 'Relic of the Aristocracy',
      group: 'Other buffs',
      kind: 'special',
      max: 5,
      description: 'stacks; +3% Condition Duration per stack'
    });
  // Profession controls are shared with the skill damage panel; only attribute-scoped ones belong here.
  controls.push(
    ...app.profession.ui
      .previewControls(attributePreviewContext(app, app.attributeWeaponSet))
      .filter((control) => previewControlScopes(control).includes('attributes'))
  );
  return controls;
}

/** Clamp preview inputs and discard effects that are unavailable on this build or weapon set. */
export function normalizeAttributePreview(
  controls: readonly PreviewControl[],
  input: Readonly<Record<string, unknown>>
): AttributePreviewValues {
  return Object.fromEntries(
    controls.map((control) => {
      const raw = input[control.key] ?? control.initial ?? control.options?.[0] ?? 0;
      const value = control.options
        ? control.options.includes(String(raw))
          ? String(raw)
          : control.options[0]
        : clamp(
            Number.isFinite(Number(raw)) ? Math.trunc(Number(raw)) : (control.min ?? 0),
            control.min ?? 0,
            control.max ?? 1
          );
      return [control.key, value];
    })
  );
}
