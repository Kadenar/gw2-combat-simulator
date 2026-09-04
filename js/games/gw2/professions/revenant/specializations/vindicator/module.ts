import { defineNativeModule } from '#gw2/platform/profession-definition/profession.js';
import { augmentSkill } from '#gw2/platform/profession-definition/mechanics.js';
import type { SkillHandlerPhase } from '#gw2/platform/engine/execution/types.js';
import type { RevenantCastContext } from '#gw2/professions/revenant/types.js';
import { createRevenantModuleData } from '#gw2/professions/revenant/catalog/module-data.js';
import {
  performEnergyMeld,
  switchAllianceTactics
} from '#gw2/professions/revenant/specializations/vindicator/mechanics/dodge.js';
import {
  vindicatorAttributeRules,
  vindicatorCastRules,
  vindicatorSchedulerHooks
} from '#gw2/professions/revenant/specializations/vindicator/mechanics/alliance-and-dodge-rules.js';
import { vindicatorState } from '#gw2/professions/revenant/specializations/vindicator/state.js';
import { vindicatorUi } from '#gw2/professions/revenant/specializations/vindicator/presentation.js';
import { VINDICATOR_BASE_SKILL_MECHANICS } from '#gw2/professions/revenant/specializations/vindicator/skills/index.js';
import { VINDICATOR_BALANCE_PROFILES } from '#gw2/professions/revenant/specializations/vindicator/profiles.js';

/** Applies Vindicator state changes after the native cast lifecycle completes. */
const vindicatorSkillHandlers = new Map(
  Object.entries(
    Object.freeze({
      'revenant.energy-meld': augmentSkill<RevenantCastContext>({
        afterEffects: performEnergyMeld as SkillHandlerPhase<RevenantCastContext>
      }),
      'revenant.alliance-tactics': augmentSkill<RevenantCastContext>({
        afterEffects: switchAllianceTactics
      })
    })
  )
);

export const vindicatorModule = defineNativeModule({
  id: 'Vindicator',
  data: createRevenantModuleData('Vindicator', {
    skillMechanics: VINDICATOR_BASE_SKILL_MECHANICS,
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
      // Dodge strike emission is a scheduler hook, not a cast handler, because the strike fires in response to the dodge state event rather than directly inside the dodge cast.
      hooks: vindicatorSchedulerHooks
    }
  },
  presentation: vindicatorUi
});
