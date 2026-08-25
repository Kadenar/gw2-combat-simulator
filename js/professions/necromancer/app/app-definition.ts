// Browser-facing Necromancer composition. It adds attribute calculation,
// runtime config mapping, persistence metadata, and shared-shell adapter
// behavior to the engine contract exported by ../definition.js.

import { defaultIsSkillAvailable, defineProfessionApp, preferOffhand } from '../../../app/profession/define-app.js';
import { applyNecromancerBuildAttributeRules } from '../build-attributes.js';
import { createDefaultTargetConditions, toApplicationBuild } from '../build.js';
import { NECROMANCER_SKILL_IDS as ID } from '../data/ids.js';
import { getActiveTraits } from '../data/traits-data.js';
import { necromancerProfession } from '../definition.js';

// Exposes Necromancer only through the shared browser application contract.
export const necromancerAppAdapter = defineProfessionApp({
  profession: necromancerProfession,
  applyBuildAttributeRules: applyNecromancerBuildAttributeRules,
  createDefaultTargetConditions,
  toApplicationBuild,
  specializationFallback: 'Spite',
  runtime: {
    buildConfigInputs: (app) => ({
      initialResource: app.build.initialResource
    }),
    buildConfigExtras: (app) => ({
      initialBlight: app.build.initialBlight,
      initialCascadingCorruptionStacks: app.build.initialCascadingCorruptionStacks
    })
  },
  isSkillAvailable(skill, context = {}) {
    if (skill.implemented === false || skill.simulatorExcluded) return false;
    const lingeringCurse = getActiveTraits(context.build?.specializations || []).some(
      (trait) => trait.name === 'Lingering Curse'
    );
    if (skill.id === ID.FEAST_OF_CORRUPTION) return !lingeringCurse;
    if (skill.id === ID.DEVOURING_DARKNESS) return lingeringCurse;
    return defaultIsSkillAvailable(skill, context);
  },
  defaultOffhand: preferOffhand('Dagger')
});
