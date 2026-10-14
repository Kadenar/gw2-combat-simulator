import { resolveSelectedSkillLoadout } from '#gw2/platform/builds/skill-loadout.js';
import type { BoundProfession } from '#gw2/build-context/types.js';
import { bindBuildContext } from '#gw2/build-context/create.js';
import { withActivePatchPreview } from '#gw2/integrations/patches/active-profession.js';
import { createCalculateAttributes } from '#gw2/platform/builds/attributes.js';
import { createProfessionBuildAttributeRules } from '#gw2/professions/shared/build-attributes.js';
import { mesmerCatalog } from '#gw2/professions/mesmer/catalog.js';
import { getActiveTraits } from '#gw2/professions/mesmer/data/traits-data.js';
import { mesmerProfession } from '#gw2/professions/mesmer/profession.js';
import type { MesmerCanonicalBuild } from '#gw2/professions/mesmer/types.js';
export { toApplicationBuild } from '#gw2/professions/mesmer/build/build.js';

// Browser and headless consumers share this patch-bound profession and its starting-resource mapping.
export const profession: BoundProfession = withActivePatchPreview(mesmerProfession);
export const createBuildContext = bindBuildContext<MesmerCanonicalBuild>(
  profession,
  createCalculateAttributes(
    createProfessionBuildAttributeRules(mesmerCatalog, getActiveTraits),
    profession.attributeContributions
  ),
  (build, specialization) => ({
    initialResource: specialization === 'Virtuoso' || specialization === 'Troubadour' ? build.initialResource : 0
  }),
  { assumptionControls: [], resolveSkillLoadout: resolveSelectedSkillLoadout }
);
