import type { AttributePreviewState } from '#gw2/app/build/types.js';
import type { BuildAttributes, BuildContextInput } from '#gw2/build-context/types.js';
import { normalizeTransitionDelays } from '#gw2/platform/execution/transition-lockouts.js';
import type {
  AttributePreviewValues,
  PreviewControl,
  ProfessionAttributePreviewInput
} from '#gw2/platform/profession-presentation/attribute-preview.js';
import type { Gw2Config } from '#gw2/platform/simulation/config.js';

export interface IsolatedPreview {
  readonly preview: { readonly attributeData: BuildAttributes };
  readonly context: ProfessionAttributePreviewInput;
  readonly config: Gw2Config;
}

/** Build-context inputs for the saved build or a detached copy; preview caches key on this same object. */
export function buildContextInput(
  app: Pick<AttributePreviewState, 'build' | 'patch' | 'simulationSettings'>,
  build: AttributePreviewState['build'] = app.build
): BuildContextInput {
  return {
    build,
    patch: app.patch,
    transitionDelays: normalizeTransitionDelays(app.simulationSettings?.transitionDelays)
  };
}

/** Calculates a detached preview build; conditional query controls never alter saved assumptions. */
export function createIsolatedPreview(
  app: AttributePreviewState,
  controls: readonly PreviewControl[],
  values: AttributePreviewValues,
  boons: Readonly<Record<string, number | boolean>>,
  weaponSet: number
): IsolatedPreview {
  const build = {
    ...app.build,
    selectedSkillIds: { ...app.build.selectedSkillIds },
    startingWeaponSet: weaponSet,
    assumptions: { ...app.build.assumptions, ...boons }
  };
  // Removing a disabled passive before recalculation also updates conversions that use the passive's attributes.
  for (const control of controls) {
    if (control.kind !== 'passive' || values[control.key]) continue;

    for (const [slot, id] of Object.entries(build.selectedSkillIds)) {
      if (id === control.skillId) build.selectedSkillIds[slot] = null;
    }
  }

  // Preview health and conditional state remain explicit query values, outside the build context.
  const calculation = app.adapter.createBuildContext(buildContextInput(app, build));
  const attributeData = calculation.attributes(weaponSet === 2 ? 2 : 1);
  const context = {
    build,
    specialization: calculation.specialization,
    activeTraits: attributeData.activeTraits,
    weapons: weaponSet === 2 ? build.alternateWeapons : build.weapons,
    catalog: app.activeCatalog,
    values
  };
  return { preview: { attributeData }, context, config: calculation.simulationConfig() };
}
