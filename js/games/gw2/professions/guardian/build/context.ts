import type { BoundProfession } from '#gw2/build-context/types.js';
import { bindBuildContext } from '#gw2/build-context/create.js';
import { withActivePatchPreview } from '#gw2/integrations/patches/active-profession.js';
import { createCalculateAttributes } from '#gw2/platform/builds/attributes.js';
import { createProfessionBuildAttributeRules } from '#gw2/professions/shared/build-attributes.js';
import { guardianCatalog } from '#gw2/professions/guardian/catalog.js';
import { getActiveTraits } from '#gw2/professions/guardian/data/traits-data.js';
import { guardianProfession } from '#gw2/professions/guardian/profession.js';
import type { GuardianCanonicalBuild } from '#gw2/professions/guardian/types.js';
export { toApplicationBuild } from '#gw2/professions/guardian/build/build.js';

// Browser and headless consumers share this patch-bound profession and its starting-resource mapping.
export const profession: BoundProfession = withActivePatchPreview(guardianProfession);
export const createBuildContext = bindBuildContext<GuardianCanonicalBuild>(
  profession,
  createCalculateAttributes(
    createProfessionBuildAttributeRules(guardianCatalog, getActiveTraits),
    profession.attributeContributions
  ),
  (build) => ({ initialTomePages: build.initialTomePages })
);
