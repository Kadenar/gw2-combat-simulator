// Browser-facing Mesmer composition. It adds attribute calculation, runtime
// config mapping, persistence metadata, and shared-shell adapter behavior to
// the engine contract exported by ../definition.js.

import { defineProfessionApp } from '../../../app/profession/define-app.js';
import { applyMesmerBuildAttributeRules } from '../build-attributes.js';
import { createDefaultTargetConditions, toApplicationBuild } from '../build.js';
import { mesmerProfession } from '../definition.js';
import type { MesmerApplicationBuild } from '../types.js';

// Exposes Mesmer only through the shared browser application contract.
export const mesmerAppAdapter = defineProfessionApp({
  profession: mesmerProfession,
  applyBuildAttributeRules: applyMesmerBuildAttributeRules,
  createDefaultTargetConditions,
  toApplicationBuild,
  specializationFallback: 'Domination',
  storageVersion: 2,
  runtime: {
    buildConfigInputs(app, { specialization, activeTraits }) {
      const build = app.build as MesmerApplicationBuild;
      const startsWithClones = mesmerProfession.ui.resourceViews({ specialization })[0]?.singular === 'clone';
      const hasMaliciousSorcery = activeTraits.some((trait) => trait.name === 'Malicious Sorcery');
      return {
        initialResource: startsWithClones ? 0 : build.initialResource,
        // This trait is resolved at hit time, not as an equipment bonus.
        adjustConditionDurationBonus(name: string, bonus: number) {
          return name === 'Confusion' && hasMaliciousSorcery ? bonus - 25 : bonus;
        }
      };
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
