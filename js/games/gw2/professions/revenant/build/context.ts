import { REVENANT_ASSUMPTION_CONTROLS } from '#gw2/professions/revenant/build/assumptions.js';
import { resolveRevenantSkillLoadout } from '#gw2/professions/revenant/build/legend-loadout.js';
import type { BoundProfession } from '#gw2/build-context/types.js';
import { bindBuildContext } from '#gw2/build-context/create.js';
import { withActivePatchPreview } from '#gw2/integrations/patches/active-profession.js';
import { createCalculateAttributes } from '#gw2/platform/builds/attributes.js';
import { createProfessionBuildAttributeRules } from '#gw2/professions/shared/build-attributes.js';
import { revenantCatalog } from '#gw2/professions/revenant/catalog.js';
import { getActiveTraits } from '#gw2/professions/revenant/data/traits-data.js';
import { revenantProfession } from '#gw2/professions/revenant/profession.js';
import type { RevenantCanonicalBuild } from '#gw2/professions/revenant/types.js';

export { toApplicationBuild } from '#gw2/professions/revenant/build/build.js';

// Browser and headless consumers share this patch-bound profession and its starting-resource mapping.
export const profession: BoundProfession = withActivePatchPreview(revenantProfession);

export const createBuildContext = bindBuildContext<RevenantCanonicalBuild>(
  profession,
  createCalculateAttributes(
    createProfessionBuildAttributeRules(revenantCatalog, getActiveTraits),
    profession.attributeContributions
  ),
  (build) => ({
    initialResource: build.initialEnergy,
    initialEnergy: build.initialEnergy,
    selectedLegends: build.selectedLegends,
    startingLegend: build.startingLegend
  }),
  { assumptionControls: REVENANT_ASSUMPTION_CONTROLS, resolveSkillLoadout: resolveRevenantSkillLoadout }
);
