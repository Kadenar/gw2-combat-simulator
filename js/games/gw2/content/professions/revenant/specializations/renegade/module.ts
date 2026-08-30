import { defineNativeModule } from '../../../../../integrations/patches/authoring/profession.js';
import { onFoodProcCreated, onResolvedDamage } from '../../../../../integrations/patches/authoring/mechanics.js';
import { createRevenantModuleData } from '../../data/catalog.js';
import { renegadeSkillHandlers } from './handlers.js';
import { renegadeEventHandlers, revenantRenegadeEventReactions } from './resolver.js';
import { renegadeAttributeRules, renegadeCastRules, renegadeSchedulerHooks } from './rules.js';
import { renegadeState } from './state.js';
import { renegadeUi } from './presentation.js';
import { RENEGADE_BASE_SKILL_MECHANICS, RENEGADE_BALANCE_PROFILES, RENEGADE_EXTRA_SKILLS } from './skills.js';

export const renegadeModule = defineNativeModule({
  id: 'Renegade',
  data: createRevenantModuleData('Renegade', {
    skillMechanics: RENEGADE_BASE_SKILL_MECHANICS,
    extraSkills: RENEGADE_EXTRA_SKILLS,
    balanceProfiles: RENEGADE_BALANCE_PROFILES,
    handlers: renegadeSkillHandlers
  }),
  // Renegade state is duplicated for both scheduler and resolver phases because each phase has its own mutable copy; they do not share a reference at runtime
  state: { scheduler: renegadeState.create, resolver: renegadeState.create },
  mechanics: {
    modifiers: renegadeAttributeRules,
    castRules: renegadeCastRules,
    schedulerHooks: renegadeSchedulerHooks,
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
    resolverHooks: {
      eventHandlers: renegadeEventHandlers
    }
  },
  presentation: renegadeUi
});
