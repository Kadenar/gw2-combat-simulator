// Browser-facing Necromancer composition. It adds attribute calculation,
// runtime config mapping, persistence metadata, and shared-shell adapter
// behavior to the engine contract exported by ../profession.js.
import { defineProfessionApp, preferOffhand } from '#gw2/app/define-profession-app.js';
import { WEAPON } from '#gw2/platform/constants.js';
import { necromancerTooltips } from '#gw2/professions/necromancer/app/tooltips.js';
import { createBuildContext, profession, toApplicationBuild } from '#gw2/professions/necromancer/build/context.js';
import { NECROMANCER_SKILL_IDS as ID } from '#gw2/professions/necromancer/data/ids.js';
import { selectedTraits } from '#gw2/professions/shared/trait-data.js';

// Exposes Necromancer only through the shared browser application contract.
export const necromancerAppAdapter = defineProfessionApp({
  profession,
  tooltips: necromancerTooltips,
  createBuildContext,
  toApplicationBuild,
  // Keep trait-replaced scepter skills mutually exclusive in the browser catalog.
  isSkillAvailable(skill, context) {
    const lingeringCurse = selectedTraits(context.catalog, context.build?.specializations || []).some(
      (trait) => trait.name === 'Lingering Curse'
    );

    if (skill.id === ID.FEAST_OF_CORRUPTION) return !lingeringCurse;

    if (skill.id === ID.DEVOURING_DARKNESS) return lingeringCurse;

    return true;
  },
  defaultOffhand: preferOffhand(WEAPON.DAGGER)
});
