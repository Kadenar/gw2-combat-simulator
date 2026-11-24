import { buildForEncounter } from '#gw2/app/boss-scenarios/simulation.js';
import type { AttributePreviewInput } from '#gw2/app/build/types.js';
import { normalizeSimulationSettings } from '#gw2/app/simulation/settings.js';
import type { BuildAttributes, BuildContextInput } from '#gw2/build-context/types.js';
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

/** Apply the active encounter's buff rules to the build used for calculation. */
export function buildContextInput(
  input: Pick<AttributePreviewInput, 'build' | 'patch' | 'simulationSettings' | 'workspace'>,
  build: AttributePreviewInput['build'] = input.build
): BuildContextInput {
  return {
    build: buildForEncounter(build, input.workspace?.scenario),
    patch: input.patch,
    ...normalizeSimulationSettings(input.simulationSettings)
  };
}

/** Calculates a detached preview build; conditional query controls never alter saved assumptions. */
export function createIsolatedPreview(
  input: AttributePreviewInput,
  controls: readonly PreviewControl[],
  values: AttributePreviewValues,
  boons: Readonly<Record<string, number | boolean>>,
  weaponSet: number
): IsolatedPreview {
  const build = {
    ...input.build,
    selectedSkillIds: { ...input.build.selectedSkillIds },
    startingWeaponSet: weaponSet,
    assumptions: { ...input.build.assumptions, ...boons }
  };
  // Removing a disabled passive before recalculation also updates conversions that use the passive's attributes.
  for (const control of controls) {
    if (control.kind !== 'passive' || values[control.key]) continue;

    for (const [slot, id] of Object.entries(build.selectedSkillIds)) {
      if (id === control.skillId) build.selectedSkillIds[slot] = null;
    }
  }

  // Preview health and conditional state remain explicit query values, outside the build context.
  const calculationInput = buildContextInput(input, build);
  const calculation = input.adapter.createBuildContext(calculationInput);
  const attributeData = calculation.attributes(weaponSet === 2 ? 2 : 1);
  const context = {
    build: calculationInput.build,
    specialization: calculation.specialization,
    activeTraits: attributeData.activeTraits,
    weapons: weaponSet === 2 ? build.alternateWeapons : build.weapons,
    catalog: input.activeCatalog,
    values
  };
  return { preview: { attributeData }, context, config: calculation.simulationConfig() };
}
