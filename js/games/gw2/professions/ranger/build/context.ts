import { RANGER_ASSUMPTION_CONTROLS } from '#gw2/professions/ranger/build/assumptions.js';
import { resolveSelectedSkillLoadout } from '#gw2/platform/builds/skill-loadout.js';
import type { BoundProfession } from '#gw2/build-context/types.js';
import { bindBuildContext } from '#gw2/build-context/create.js';
import { withActivePatchPreview } from '#gw2/integrations/patches/active-profession.js';
import { getActiveTraits } from '#gw2/professions/ranger/data/traits-data.js';
import { rangerProfession } from '#gw2/professions/ranger/profession.js';
import type { RangerCanonicalBuild } from '#gw2/professions/ranger/types.js';

export { toApplicationBuild } from '#gw2/professions/ranger/build/build.js';

// Browser and headless consumers share this patch-bound profession and its starting-resource mapping.
export const profession: BoundProfession = withActivePatchPreview(rangerProfession);

export const createBuildContext = bindBuildContext<RangerCanonicalBuild>(
  profession,
  { getActiveTraits, attributeContributions: profession.attributeContributions },
  (build) => ({
    initialAstralForce: build.initialAstralForce,
    initialArrows: build.initialArrows,
    selectedPet: build.selectedPet,
    selectedPet2: build.selectedPet2,
    selectedHammerSkillIds: build.selectedHammerSkillIds,
    initialUntamedState: build.initialUntamedState
  }),
  { assumptionControls: RANGER_ASSUMPTION_CONTROLS, resolveSkillLoadout: resolveSelectedSkillLoadout }
);
