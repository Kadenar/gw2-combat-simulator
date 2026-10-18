import { ENGINEER_ASSUMPTION_CONTROLS } from '#gw2/professions/engineer/build/assumptions.js';
import { resolveSelectedSkillLoadout } from '#gw2/platform/builds/skill-loadout.js';
import type { BoundProfession } from '#gw2/build-context/types.js';
import { bindBuildContext } from '#gw2/build-context/create.js';
import { withActivePatchPreview } from '#gw2/integrations/patches/active-profession.js';
import { createCalculateAttributes } from '#gw2/platform/attributes/calculation.js';
import { createProfessionBuildAttributeRules } from '#gw2/professions/shared/build-attributes.js';
import { engineerCatalog } from '#gw2/professions/engineer/catalog.js';
import { getActiveTraits } from '#gw2/professions/engineer/data/traits-data.js';
import { engineerProfession } from '#gw2/professions/engineer/profession.js';
import type { EngineerCanonicalBuild } from '#gw2/professions/engineer/types.js';

export { toApplicationBuild } from '#gw2/professions/engineer/build/build.js';

// Browser and headless consumers share this patch-bound profession and its starting-resource mapping.
export const profession: BoundProfession = withActivePatchPreview(engineerProfession);

export const createBuildContext = bindBuildContext<EngineerCanonicalBuild>(
  profession,
  createCalculateAttributes(
    createProfessionBuildAttributeRules(engineerCatalog, getActiveTraits),
    profession.attributeContributions
  ),
  (build) => ({
    initialResource: build.initialHeat,
    initialHeat: build.initialHeat,
    selectedMorphSkillIds: build.selectedMorphSkillIds
  }),
  { assumptionControls: ENGINEER_ASSUMPTION_CONTROLS, resolveSkillLoadout: resolveSelectedSkillLoadout }
);
