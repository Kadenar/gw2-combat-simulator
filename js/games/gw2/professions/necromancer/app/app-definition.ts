import { withActivePatchPreview } from '#gw2/integrations/patches/active-profession.js';
// Browser-facing Necromancer composition. It adds attribute calculation,
// runtime config mapping, persistence metadata, and shared-shell adapter
// behavior to the engine contract exported by ../definition.js.

import { defaultIsSkillAvailable, defineProfessionApp, preferOffhand } from '#gw2/app/create-adapter.js';
import { applyNecromancerBuildAttributeRules } from '#gw2/professions/necromancer/build/attributes.js';
import { toApplicationBuild } from '#gw2/professions/necromancer/build/build.js';
import { NECROMANCER_SKILL_IDS as ID } from '#gw2/professions/necromancer/data/ids.js';
import { getActiveTraits } from '#gw2/professions/necromancer/data/traits-data.js';
import { necromancerProfession } from '#gw2/professions/necromancer/definition.js';

// Exposes Necromancer only through the shared browser application contract.
export const necromancerAppAdapter = defineProfessionApp({
  profession: withActivePatchPreview(necromancerProfession),
  applyBuildAttributeRules: applyNecromancerBuildAttributeRules,
  toApplicationBuild,
  specializationFallback: 'Spite',
  runtime: {
    // Map persisted life force to the shared initial-resource input.
    buildConfigInputs: (app) => ({
      initialResource: app.build.initialResource
    }),
    // Forward Harbinger's persisted starting resources to specialization initialization.
    buildConfigExtras: (app) => ({
      initialBlight: app.build.initialBlight,
      initialCascadingCorruptionStacks: app.build.initialCascadingCorruptionStacks
    })
  },
  // Keep trait-replaced scepter skills mutually exclusive in the browser catalog.
  isSkillAvailable(skill, context = {}) {
    if (skill.simulatorExcluded) return false;
    const lingeringCurse = getActiveTraits(context.build?.specializations || []).some(
      (trait) => trait.name === 'Lingering Curse'
    );
    if (skill.id === ID.FEAST_OF_CORRUPTION) return !lingeringCurse;
    if (skill.id === ID.DEVOURING_DARKNESS) return lingeringCurse;
    return defaultIsSkillAvailable(skill, context);
  },
  defaultOffhand: preferOffhand('Dagger')
});
