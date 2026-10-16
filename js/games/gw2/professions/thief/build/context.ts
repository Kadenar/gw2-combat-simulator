import { THIEF_CORE_ASSUMPTION_CONTROLS } from '#gw2/professions/thief/build/core-assumptions.js';
import { resolveSelectedSkillLoadout } from '#gw2/platform/builds/skill-loadout.js';
import type { BoundProfession } from '#gw2/build-context/types.js';
import { bindBuildContext } from '#gw2/build-context/create.js';
import { withActivePatchPreview } from '#gw2/integrations/patches/active-profession.js';
import { createCalculateAttributes } from '#gw2/platform/builds/attributes.js';
import { createProfessionBuildAttributeRules } from '#gw2/professions/shared/build-attributes.js';
import { thiefCatalog } from '#gw2/professions/thief/catalog.js';
import { getActiveTraits } from '#gw2/professions/thief/data/traits-data.js';
import { thiefProfession } from '#gw2/professions/thief/profession.js';
import type { ThiefCanonicalBuild } from '#gw2/professions/thief/types.js';

export { toApplicationBuild } from '#gw2/professions/thief/build/build.js';

// Browser and headless consumers share this patch-bound profession and its starting-resource mapping.
export const profession: BoundProfession = withActivePatchPreview(thiefProfession);

export const createBuildContext = bindBuildContext<ThiefCanonicalBuild>(
  profession,
  createCalculateAttributes(
    createProfessionBuildAttributeRules(thiefCatalog, getActiveTraits),
    profession.attributeContributions
  ),
  (build) => ({
    initialResource: build.initialInitiative,
    initialInitiative: build.initialInitiative,
    initialSpinningAxes: build.initialSpinningAxes,
    initialPreSteal: build.initialPreSteal,
    initialShadowForce: build.initialShadowForce,
    selectedDodge: build.selectedDodge
  }),
  { assumptionControls: THIEF_CORE_ASSUMPTION_CONTROLS, resolveSkillLoadout: resolveSelectedSkillLoadout }
);
