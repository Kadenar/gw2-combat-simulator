import {
  createProfessionRuntime,
} from "../../../app/create-profession-runtime.js";
import { calculateAttributes } from "../core/calc-attributes.js";
import { guardianProfession } from "../definition.js";

export const {
  eliteSpecialization,
  recalculate,
  simulationConfig,
  modifierCandidates,
  modifierContributionRequest,
  calculateModifierContributions,
  computeModifierContributions,
  runSimulation,
} = createProfessionRuntime({
  profession: guardianProfession,
  calculateAttributes,
  buildConfigExtras: app => ({
    initialTomePages: app.build.initialTomePages,
    guardianStaticTraitsApplied: true,
    guardianStaticTraitWeapon: (
      Number(app.attributeWeaponSet || 1) === 2
        ? app.build.alternateWeapons
        : app.build.weapons
    )?.[0] || "",
  }),
});
