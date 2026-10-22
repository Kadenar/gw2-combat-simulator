import { ELEMENTALIST_ASSUMPTION_CONTROLS } from '#gw2/professions/elementalist/build/assumptions.js';
import { resolveSelectedSkillLoadout } from '#gw2/platform/builds/skill-loadout.js';
import type { BoundProfession } from '#gw2/build-context/types.js';
import { bindBuildContext } from '#gw2/build-context/create.js';
import { withActivePatchPreview } from '#gw2/integrations/patches/active-profession.js';
import { getActiveTraits } from '#gw2/professions/elementalist/data/traits-data.js';
import { elementalistProfession } from '#gw2/professions/elementalist/profession.js';
import type { ElementalistCanonicalBuild } from '#gw2/professions/elementalist/build/types.js';

export { toApplicationBuild } from '#gw2/professions/elementalist/build/build.js';

// Browser and headless consumers share this patch-bound profession and its starting-resource mapping.
export const profession: BoundProfession = withActivePatchPreview(elementalistProfession);

export const createBuildContext = bindBuildContext<ElementalistCanonicalBuild>(
  profession,
  { getActiveTraits, attributeContributions: profession.attributeContributions },
  (build) => ({
    startAttunement: build.startAttunement,
    secondaryAttunement: build.secondaryAttunement,
    initialCatalystEnergy: build.initialCatalystEnergy,
    evokerElement: build.evokerElement,
    initialEvokerCharges: build.initialEvokerCharges,
    initialEvokerEmpowered: build.initialEvokerEmpowered,
    pistolBullets: build.pistolBullets
  }),
  { assumptionControls: ELEMENTALIST_ASSUMPTION_CONTROLS, resolveSkillLoadout: resolveSelectedSkillLoadout }
);
