// Browser-facing Engineer composition. It adds attribute calculation, runtime
// config mapping, persistence metadata, and shared-shell adapter behavior to
// the engine contract exported by ../definition.js.

import { defaultIsSkillAvailable, defineProfessionApp, preferOffhand } from '#gw2/app/create-adapter.js';
import { applyEngineerBuildAttributeRules } from '#gw2/content/professions/engineer/build/attributes.js';
import { toApplicationBuild } from '#gw2/content/professions/engineer/build/build.js';
import { engineerProfession } from '#gw2/content/professions/engineer/definition.js';
import type { EngineerApplicationBuild, EngineerEvolveAttributePool } from '#gw2/content/professions/engineer/types.js';

// Exposes Engineer only through the shared browser application contract.
export const engineerAppAdapter = defineProfessionApp({
  profession: engineerProfession,
  applyBuildAttributeRules: applyEngineerBuildAttributeRules,
  toApplicationBuild,
  specializationFallback: 'Explosives',
  runtime: {
    // Map persisted Heat to the shared initial-resource runtime input.
    buildConfigInputs: (app) => ({
      initialResource: (app.build as EngineerApplicationBuild).initialHeat
    }),
    // Supply specialization-only runtime fields without leaking inactive state into other builds.
    buildConfigExtras: (app) => {
      const build = app.build as EngineerApplicationBuild;
      const evolveAttributePool = (
        app.attributeData as {
          amalgamEvolveAttributePool?: EngineerEvolveAttributePool;
        }
      ).amalgamEvolveAttributePool;
      const amalgam = build.specializations?.some((specialization) => specialization.name === 'Amalgam');
      return {
        ...(amalgam
          ? {
              amalgamEvolveAttributePool: {
                ...evolveAttributePool
              }
            }
          : {}),
        initialHeat: build.initialHeat,
        selectedMorphSkillIds: [...build.selectedMorphSkillIds]
      };
    }
  },
  // The synthetic weapon-swap action remains available so an Engineer can leave an active kit.
  isSkillAvailable(skill, context) {
    if (skill.id === -3) return true;
    return defaultIsSkillAvailable(skill, context);
  },
  defaultOffhand: preferOffhand('Pistol')
});
