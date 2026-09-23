// Browser-facing Mesmer composition. It adds attribute calculation, runtime
// config mapping, persistence metadata, and shared-shell adapter behavior to
// the engine contract exported by ../definition.js.

import { definePatchedProfessionApp } from '#gw2/app/create-patched-adapter.js';
import { mesmerTooltips } from '#gw2/professions/mesmer/app/tooltips.js';
import { applyMesmerBuildAttributeRules } from '#gw2/professions/mesmer/build/attributes.js';
import { toApplicationBuild } from '#gw2/professions/mesmer/build/build.js';
import { mesmerProfession } from '#gw2/professions/mesmer/profession.js';
import type { MesmerCanonicalBuild } from '#gw2/professions/mesmer/types.js';

// Exposes Mesmer only through the shared browser application contract.
export const mesmerAppAdapter = definePatchedProfessionApp({
  tooltips: mesmerTooltips,
  profession: mesmerProfession,
  applyBuildAttributeRules: applyMesmerBuildAttributeRules,
  toApplicationBuild,
  specializationFallback: 'Domination',
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
