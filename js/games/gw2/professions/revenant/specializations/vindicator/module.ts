import { defineNativeModule } from '#gw2/platform/profession-definition/profession.js';
import { resetAutoattackChains } from '#gw2/platform/skills/autoattack-chains.js';
import { REVENANT_SKILL_IDS as ID } from '#gw2/professions/revenant/data/ids.js';
import { VINDICATOR_JUMP_SKILL } from '#gw2/professions/revenant/specializations/vindicator/skills/dodge-skills.js';
import type { RevenantCastContext, RevenantSkill } from '#gw2/professions/revenant/types.js';
import { createRevenantModuleData } from '#gw2/professions/revenant/data/module-data.js';
import { performEnergyMeld } from '#gw2/professions/revenant/specializations/vindicator/mechanics/dodge.js';
import { vindicatorSkillHandlers } from '#gw2/professions/revenant/specializations/vindicator/execution/index.js';
import {
  vindicatorAttributeRules,
  vindicatorCastRules,
  vindicatorSchedulerHooks
} from '#gw2/professions/revenant/specializations/vindicator/mechanics/alliance-and-dodge-rules.js';
import { vindicatorState } from '#gw2/professions/revenant/specializations/vindicator/state.js';
import { vindicatorUi } from '#gw2/professions/revenant/specializations/vindicator/presentation.js';
import { VINDICATOR_BASE_SKILL_MECHANICS } from '#gw2/professions/revenant/specializations/vindicator/skills/index.js';
import { VINDICATOR_BALANCE_PROFILES } from '#gw2/professions/revenant/specializations/vindicator/profiles.js';

export const vindicatorModule = defineNativeModule({
  id: 'Vindicator',
  data: createRevenantModuleData('Vindicator', {
    skillMechanics: VINDICATOR_BASE_SKILL_MECHANICS,
    extraSkills: [VINDICATOR_JUMP_SKILL],
    balanceProfiles: VINDICATOR_BALANCE_PROFILES
  }),
  state: {
    // scheduler and resolver each call create independently; they do not share a state object.
    scheduler: vindicatorState.create,
    resolver: vindicatorState.create
  },
  mechanics: {
    modifiers: vindicatorAttributeRules,
    execution: {
      skillHandlers: vindicatorSkillHandlers,
      castRules: vindicatorCastRules,
      // Legacy landing-only Dodge inputs emit their strike through the state-event hook.
      hooks: {
        ...vindicatorSchedulerHooks,
        // Airborne autos may advance the chain; landing resets it before the next serial input.
        onCastComplete: (context: RevenantCastContext, skill: RevenantSkill) => {
          if (skill.id === VINDICATOR_JUMP_SKILL.id) resetAutoattackChains(context);
          // Both Meld variants grant resources only after regeneration advances through a completed cast.
          if (
            (skill.id === ID.ENERGY_MELD || skill.id === ID.ENERGY_MELD_ID_72058) &&
            context.action.cancelled !== true
          ) {
            performEnergyMeld(context, skill);
          }
        }
      }
    }
  },
  presentation: vindicatorUi
});
