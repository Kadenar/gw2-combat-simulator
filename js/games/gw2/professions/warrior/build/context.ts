import { bindBuildContext } from '#gw2/build-context/create.js';
import type { BoundProfession } from '#gw2/build-context/types.js';
import { withActivePatchPreview } from '#gw2/integrations/patches/active-profession.js';
import { resolveSelectedSkillLoadout } from '#gw2/platform/builds/skill-loadout.js';
import type { Gw2Config } from '#gw2/platform/simulation/config.js';
import { warriorProfession } from '#gw2/professions/warrior/profession.js';
import type { WarriorCanonicalBuild } from '#gw2/professions/warrior/types.js';

export { toApplicationBuild } from '#gw2/professions/warrior/build/build.js';

// Browser and headless consumers share this patch-bound profession and its starting-resource mapping.
export const profession: BoundProfession = withActivePatchPreview(warriorProfession);

export const createBuildContext = bindBuildContext<WarriorCanonicalBuild, Gw2Config>(profession)(
  (build) => ({ initialResource: build.initialResource }),
  { assumptionControls: [], resolveSkillLoadout: resolveSelectedSkillLoadout }
);
