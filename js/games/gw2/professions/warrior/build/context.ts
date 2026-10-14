import { resolveSelectedSkillLoadout } from '#gw2/platform/builds/skill-loadout.js';
import type { BoundProfession } from '#gw2/build-context/types.js';
import { bindBuildContext } from '#gw2/build-context/create.js';
import { withActivePatchPreview } from '#gw2/integrations/patches/active-profession.js';
import { createCalculateAttributes } from '#gw2/platform/builds/attributes.js';
import { createProfessionBuildAttributeRules } from '#gw2/professions/shared/build-attributes.js';
import { warriorCatalog } from '#gw2/professions/warrior/catalog.js';
import { getActiveTraits } from '#gw2/professions/warrior/data/traits-data.js';
import { warriorProfession } from '#gw2/professions/warrior/profession.js';
import type { WarriorCanonicalBuild } from '#gw2/professions/warrior/types.js';
export { toApplicationBuild } from '#gw2/professions/warrior/build/build.js';

// Browser and headless consumers share this patch-bound profession and its starting-resource mapping.
export const profession: BoundProfession = withActivePatchPreview(warriorProfession);
export const createBuildContext = bindBuildContext<WarriorCanonicalBuild>(
  profession,
  createCalculateAttributes(
    createProfessionBuildAttributeRules(warriorCatalog, getActiveTraits),
    profession.attributeContributions
  ),
  (build) => ({ initialResource: build.initialResource }),
  { assumptionControls: [], resolveSkillLoadout: resolveSelectedSkillLoadout }
);
