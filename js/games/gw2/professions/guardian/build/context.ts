import { resolveSelectedSkillLoadout } from '#gw2/platform/builds/skill-loadout.js';
import type { BoundProfession } from '#gw2/build-context/types.js';
import { bindBuildContext } from '#gw2/build-context/create.js';
import { withActivePatchPreview } from '#gw2/integrations/patches/active-profession.js';
import { guardianProfession } from '#gw2/professions/guardian/profession.js';
import type { GuardianCanonicalBuild } from '#gw2/professions/guardian/types.js';

export { toApplicationBuild } from '#gw2/professions/guardian/build/build.js';

// Browser and headless consumers share this patch-bound profession and its starting-resource mapping.
export const profession: BoundProfession = withActivePatchPreview(guardianProfession);

export const createBuildContext = bindBuildContext<GuardianCanonicalBuild>(
  profession,
  {
    attributeContributions: profession.attributeContributions
  },
  (build) => ({ initialTomePages: build.initialTomePages }),
  { assumptionControls: [], resolveSkillLoadout: resolveSelectedSkillLoadout }
);
