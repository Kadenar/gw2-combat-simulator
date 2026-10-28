import { bindBuildContext } from '#gw2/build-context/create.js';
import type { BoundProfession } from '#gw2/build-context/types.js';
import { withActivePatchPreview } from '#gw2/integrations/patches/active-profession.js';
import { REVENANT_ASSUMPTION_CONTROLS } from '#gw2/professions/revenant/build/assumptions.js';
import { resolveRevenantSkillLoadout } from '#gw2/professions/revenant/build/legend-loadout.js';
import { revenantProfession } from '#gw2/professions/revenant/profession.js';
import type { RevenantCanonicalBuild } from '#gw2/professions/revenant/types.js';

export { toApplicationBuild } from '#gw2/professions/revenant/build/build.js';

// Browser and headless consumers share this patch-bound profession and its starting-resource mapping.
export const profession: BoundProfession = withActivePatchPreview(revenantProfession);

export const createBuildContext = bindBuildContext<RevenantCanonicalBuild>(
  profession,
  { attributeContributions: profession.attributeContributions },
  (build) => ({
    initialEnergy: build.initialEnergy,
    selectedLegends: build.selectedLegends,
    startingLegend: build.startingLegend
  }),
  { assumptionControls: REVENANT_ASSUMPTION_CONTROLS, resolveSkillLoadout: resolveRevenantSkillLoadout }
);
