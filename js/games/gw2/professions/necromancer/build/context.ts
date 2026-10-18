import { resolveSelectedSkillLoadout } from '#gw2/platform/builds/skill-loadout.js';
import type { BoundProfession } from '#gw2/build-context/types.js';
import { bindBuildContext } from '#gw2/build-context/create.js';
import { withActivePatchPreview } from '#gw2/integrations/patches/active-profession.js';
import { createCalculateAttributes } from '#gw2/platform/attributes/calculation.js';
import { createProfessionBuildAttributeRules } from '#gw2/professions/shared/build-attributes.js';
import { necromancerCatalog } from '#gw2/professions/necromancer/catalog.js';
import { getActiveTraits } from '#gw2/professions/necromancer/data/traits-data.js';
import { necromancerProfession } from '#gw2/professions/necromancer/profession.js';
import type { NecromancerCanonicalBuild } from '#gw2/professions/necromancer/types.js';

export { toApplicationBuild } from '#gw2/professions/necromancer/build/build.js';

// Browser and headless consumers share this patch-bound profession and its starting-resource mapping.
export const profession: BoundProfession = withActivePatchPreview(necromancerProfession);

export const createBuildContext = bindBuildContext<NecromancerCanonicalBuild>(
  profession,
  createCalculateAttributes(
    createProfessionBuildAttributeRules(necromancerCatalog, getActiveTraits),
    profession.attributeContributions
  ),
  (build) => ({
    initialResource: build.initialResource,
    initialBlight: build.initialBlight,
    initialCascadingCorruptionStacks: build.initialCascadingCorruptionStacks
  }),
  { assumptionControls: [], resolveSkillLoadout: resolveSelectedSkillLoadout }
);
