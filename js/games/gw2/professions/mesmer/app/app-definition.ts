// Browser-facing Mesmer composition. It adds attribute calculation, runtime
// config mapping, persistence metadata, and shared-shell adapter behavior to
// the engine contract exported by ../profession.ts.

import { defineProfessionApp } from '#gw2/app/define-profession-app.js';
import { mesmerTooltips } from '#gw2/professions/mesmer/app/tooltips.js';
import { applyMesmerBuildAttributeRules } from '#gw2/professions/mesmer/build/attributes.js';
import { toApplicationBuild } from '#gw2/professions/mesmer/build/build.js';
import { getMesmerBuildRotationLookup } from '#gw2/professions/mesmer/catalog.js';
import { mesmerProfession } from '#gw2/professions/mesmer/profession.js';
import type { MesmerCanonicalBuild } from '#gw2/professions/mesmer/types.js';

// Exposes Mesmer only through the shared browser application contract.
export const mesmerAppAdapter = defineProfessionApp({
  tooltips: mesmerTooltips,
  profession: mesmerProfession,
  applyBuildAttributeRules: applyMesmerBuildAttributeRules,
  toApplicationBuild,
  // Reuse selected-elite name resolution while validating explicit commands against the active patch catalog.
  rotationImportLookup(app) {
    return {
      skillsByName: getMesmerBuildRotationLookup(app.adapter.eliteSpecialization(app.build)).skillsByName,
      skillsById: app.activeCatalog.skillsById
    };
  },
  storageVersion: 2,
  runtime: {
    buildConfigInputs(app, { specialization }) {
      const build = app.build as MesmerCanonicalBuild;
      // Initial clones are disabled by build policy, independent of the selected resource capacity.
      const startsWithClones = specialization !== 'Virtuoso' && specialization !== 'Troubadour';
      return { initialResource: startsWithClones ? 0 : build.initialResource };
    }
  },
  isSkillAvailable(skill, { specialization } = {}) {
    return !skill.ambush || specialization === 'Mirage';
  },
  defaultOffhand() {
    return 'Sword';
  }
});
