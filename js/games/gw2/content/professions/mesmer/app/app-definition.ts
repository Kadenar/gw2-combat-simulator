// Browser-facing Mesmer composition. It adds attribute calculation, runtime
// config mapping, persistence metadata, and shared-shell adapter behavior to
// the engine contract exported by ../definition.js.

import { defineProfessionApp } from '#gw2/app/create-adapter.js';
import { applyMesmerBuildAttributeRules } from '#gw2/content/professions/mesmer/build/attributes.js';
import { toApplicationBuild } from '#gw2/content/professions/mesmer/build/build.js';
import { mesmerProfession } from '#gw2/content/professions/mesmer/definition.js';
import type { MesmerApplicationBuild } from '#gw2/content/professions/mesmer/types.js';

// Exposes Mesmer only through the shared browser application contract.
export const mesmerAppAdapter = defineProfessionApp({
  profession: mesmerProfession,
  applyBuildAttributeRules: applyMesmerBuildAttributeRules,
  toApplicationBuild,
  specializationFallback: 'Domination',
  storageVersion: 2,
  runtime: {
    buildConfigInputs(app, { specialization }) {
      const build = app.build as MesmerApplicationBuild;
      const startsWithClones = mesmerProfession.ui.resourceViews({ specialization })[0]?.singular === 'clone';
      return { initialResource: startsWithClones ? 0 : build.initialResource };
    },
    buildConfigExtras() {
      return { weaponmasterTraining: true };
    }
  },
  isSkillAvailable(skill, { specialization } = {}) {
    if (skill.implemented === false || skill.simulatorExcluded) return false;
    return !skill.ambush || specialization === 'Mirage';
  },
  defaultOffhand() {
    return 'Sword';
  }
});
