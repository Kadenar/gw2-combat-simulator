import { WEAPON } from '#gw2/platform/constants.js';
import { profession, createBuildContext, toApplicationBuild } from '#gw2/professions/mesmer/build/context.js';
// Browser-facing Mesmer composition. It adds attribute calculation, runtime
// config mapping, persistence metadata, and shared-shell adapter behavior to
// the engine contract exported by ../profession.ts.

import { defineProfessionApp } from '#gw2/app/define-profession-app.js';
import { mesmerTooltips } from '#gw2/professions/mesmer/app/tooltips.js';
import { getMesmerBuildRotationLookup } from '#gw2/professions/mesmer/catalog.js';

// Exposes Mesmer only through the shared browser application contract.
export const mesmerAppAdapter = defineProfessionApp({
  tooltips: mesmerTooltips,
  profession,
  createBuildContext,
  toApplicationBuild,
  // Reuse selected-elite name resolution while validating explicit commands against the active patch catalog.
  rotationImportLookup(app) {
    return {
      skillsByName: getMesmerBuildRotationLookup(app.adapter.eliteSpecialization(app.build)).skillsByName,
      skillsById: app.activeCatalog.skillsById
    };
  },
  storageVersion: 2,
  isSkillAvailable(skill, { specialization } = {}) {
    return !skill.ambush || specialization === 'Mirage';
  },
  defaultOffhand() {
    return WEAPON.SWORD;
  }
});
