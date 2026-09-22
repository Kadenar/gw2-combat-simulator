// Browser-facing Engineer composition. It adds attribute calculation, runtime
// config mapping, persistence metadata, and shared-shell adapter behavior to
// the engine contract exported by ../profession.js.

import { preferOffhand } from '#gw2/app/create-adapter.js';
import { definePatchedProfessionApp } from '#gw2/app/create-patched-adapter.js';
import { applyEngineerBuildAttributeRules } from '#gw2/professions/engineer/build/attributes.js';
import { toApplicationBuild } from '#gw2/professions/engineer/build/build.js';
import { engineerProfession } from '#gw2/professions/engineer/profession.js';
import { engineerTooltips } from '#gw2/professions/engineer/app/tooltips.js';
import type { EngineerApplicationBuild, EngineerFinalizedAttributeResult } from '#gw2/professions/engineer/types.js';

// Exposes Engineer only through the shared browser application contract.
export const engineerAppAdapter = definePatchedProfessionApp({
  tooltips: engineerTooltips,
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
    buildConfigExtras: (app, { attributeData }) => {
      const build = app.build as EngineerApplicationBuild;
      const evolveAttributePool = (attributeData as EngineerFinalizedAttributeResult).amalgamEvolveAttributePool;
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
  defaultOffhand: preferOffhand('Pistol')
});
