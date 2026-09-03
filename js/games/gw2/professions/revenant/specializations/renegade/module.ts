import { defineNativeModule } from '#gw2/platform/profession-definition/profession.js';
import { onFoodProcCreated, onResolvedDamage } from '#gw2/platform/profession-definition/mechanics.js';
import { createRevenantModuleData } from '#gw2/professions/revenant/catalog/module-data.js';
import { renegadeSkillHandlers } from '#gw2/professions/revenant/specializations/renegade/execution/index.js';
import {
  renegadeEventHandlers,
  revenantRenegadeEventReactions
} from '#gw2/professions/revenant/specializations/renegade/mechanics/reactions.js';
import {
  renegadeAttributeRules,
  renegadeCastRules,
  renegadeSchedulerHooks
} from '#gw2/professions/revenant/specializations/renegade/mechanics/kalla-rules.js';
import { renegadeState } from '#gw2/professions/revenant/specializations/renegade/state.js';
import { renegadeUi } from '#gw2/professions/revenant/specializations/renegade/presentation.js';
import { RENEGADE_BASE_SKILL_MECHANICS } from '#gw2/professions/revenant/specializations/renegade/skills/index.js';
import { RENEGADE_EXTRA_SKILLS } from '#gw2/professions/revenant/specializations/renegade/skills/warband-skills.js';
import { RENEGADE_BALANCE_PROFILES } from '#gw2/professions/revenant/specializations/renegade/profiles.js';

export const renegadeModule = defineNativeModule({
  id: 'Renegade',
  data: createRevenantModuleData('Renegade', {
    skillMechanics: RENEGADE_BASE_SKILL_MECHANICS,
    extraSkills: RENEGADE_EXTRA_SKILLS,
    balanceProfiles: RENEGADE_BALANCE_PROFILES
  }),
  // Renegade state is duplicated for both scheduler and resolver phases because each phase has its own mutable copy; they do not share a reference at runtime
  state: { scheduler: renegadeState.create, resolver: renegadeState.create },
  mechanics: {
    modifiers: renegadeAttributeRules,
    execution: {
      skillHandlers: renegadeSkillHandlers,
      castRules: renegadeCastRules,
      hooks: renegadeSchedulerHooks
    },
    resolution: {
      reactions: [
        // onResolvedDamage fires in the resolver after final damage values are known, used here to trigger Soulcleave's Summit procs from player hits
        onResolvedDamage({
          id: 'revenant.renegade.damage',
          handler: revenantRenegadeEventReactions.damage
        }),
        // onFoodProcCreated lets Kalla's Fervor augment food life-siphon procs before they are emitted
        onFoodProcCreated({
          id: 'revenant.renegade.food-proc',
          handler: revenantRenegadeEventReactions.food_proc
        })
      ],
      hooks: {
        eventHandlers: renegadeEventHandlers
      }
    }
  },
  presentation: renegadeUi
});
