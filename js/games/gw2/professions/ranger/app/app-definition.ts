import { WEAPON } from '#gw2/platform/constants.js';
import { profession, createBuildContext, toApplicationBuild } from '#gw2/professions/ranger/build/context.js';
import { defineProfessionApp, preferOffhand } from '#gw2/app/define-profession-app.js';
import { rangerTooltips } from '#gw2/professions/ranger/app/tooltips.js';
import { RANGER_SKILL_IDS as ID } from '#gw2/professions/ranger/data/ids.js';
import type { RangerPlanningState } from '#gw2/professions/ranger/types.js';
import { PROFESSION_STATE_IDS as STATE } from '#gw2/professions/state-ids.js';

// Exposes Ranger only through the shared browser application contract.
export const rangerAppAdapter = defineProfessionApp({
  tooltips: rangerTooltips,
  profession,
  createBuildContext,
  toApplicationBuild,
  resetPrompt: 'Reset the Ranger build, pet, assumptions, and rotation?',
  isSkillAvailable(skill, context) {
    // Greatsword Maul changes recipient when Soulbeast merges, so expose the matching skill ID.
    if (skill.id === ID.MAUL_SOULBEAST || skill.id === ID.MAUL_BASE) {
      const merged =
        context.specialization === 'Soulbeast' &&
        (context.professionState as Partial<RangerPlanningState> | undefined)?.[STATE.BEASTMODE_ACTIVE] !== false;
      return skill.id === (merged ? ID.MAUL_SOULBEAST : ID.MAUL_BASE);
    }

    if (skill.unleashedAmbushSkill && context.specialization !== 'Untamed') {
      return false;
    }

    if (
      skill.id === ID.PET_SWAP &&
      context.specialization === 'Soulbeast' &&
      (context.professionState as Partial<RangerPlanningState> | undefined)?.[STATE.BEASTMODE_ACTIVE] !== false
    ) {
      return false;
    }

    return true;
  },
  defaultOffhand: preferOffhand(WEAPON.AXE)
});
