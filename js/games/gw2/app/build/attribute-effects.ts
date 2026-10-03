import type { ProfessionAppState } from '#gw2/app/types.js';
import { clamp } from '#kernel/core/numeric.js';
import type {
  AttributeEffectControl,
  AttributePreviewValues,
  ProfessionAttributePreviewContext
} from '#gw2/platform/profession-presentation/attribute-preview.js';

/** Supply the active preview catalog and weapon set without exposing application state to profession hooks. */
export function attributePreviewContext(app: ProfessionAppState): ProfessionAttributePreviewContext {
  return {
    build: app.build,
    specialization: app.adapter.eliteSpecialization(app.build),
    activeTraits: app.attributeData!.activeTraits,
    weapons: app.attributeWeaponSet === 2 ? app.build.alternateWeapons : app.build.weapons,
    catalog: app.activeCatalog || app.profession.catalog
  };
}

/** Combine common boon and equipment inputs with the active profession's conditional controls. */
export function attributeEffectControls(app: ProfessionAppState): AttributeEffectControl[] {
  const controls: AttributeEffectControl[] = [
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
  controls.push(...app.profession.ui.attributePreviewControls(attributePreviewContext(app)));
  return controls;
}

/** Clamp preview inputs and discard effects that are unavailable on this build or weapon set. */
export function normalizeAttributePreview(
  controls: readonly AttributeEffectControl[],
  input: Readonly<Record<string, unknown>>
): AttributePreviewValues {
  return Object.fromEntries(
    controls.map((control) => {
      const raw = input[control.key] ?? control.initial ?? control.options?.[0] ?? 0;
      const value = control.options
        ? control.options.includes(String(raw))
          ? String(raw)
          : control.options[0]
        : clamp(Number.isFinite(Number(raw)) ? Math.trunc(Number(raw)) : 0, 0, control.max ?? 1);
      return [control.key, value];
    })
  );
}
