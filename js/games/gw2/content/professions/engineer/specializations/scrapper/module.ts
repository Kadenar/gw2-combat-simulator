import {
  afterSkillEffects,
  onBuffApplied,
  onComboResolved,
  onResolvedDamage
} from '#gw2/integrations/patches/authoring/mechanics.js';
import { defineNativeModule } from '#gw2/integrations/patches/authoring/profession.js';
import { createEngineerModuleData } from '#gw2/content/professions/engineer/catalog/module-data.js';
import {
  scrapperResolverEventHandlers,
  scrapperResolverEventReactions
} from '#gw2/content/professions/engineer/specializations/scrapper/traits/reactions.js';
import {
  scrapperAttributeRules,
  scrapperCastRules,
  scrapperSchedulerHooks
} from '#gw2/content/professions/engineer/specializations/scrapper/traits/modifiers.js';
import { SCRAPPER_SKILL_MECHANICS } from '#gw2/content/professions/engineer/specializations/scrapper/skills/index.js';
import { scrapperState } from '#gw2/content/professions/engineer/specializations/scrapper/state.js';
import { SCRAPPER_BALANCE_PROFILES } from '#gw2/content/professions/engineer/specializations/scrapper/profiles.js';
import { scrapperUi } from '#gw2/content/professions/engineer/specializations/scrapper/presentation.js';

export const scrapperModule = defineNativeModule({
  id: 'Scrapper',
  data: createEngineerModuleData('Scrapper', {
    skillMechanics: SCRAPPER_SKILL_MECHANICS,
    balanceProfiles: SCRAPPER_BALANCE_PROFILES
  }),
  // Same factory for both phases; scrapper has no phase-divergent state.
  state: { scheduler: scrapperState.create, resolver: scrapperState.create },
  mechanics: {
    modifiers: scrapperAttributeRules,
    execution: {
      castRules: scrapperCastRules,
      // afterSkillEffects runs after all skill effects are emitted, allowing trait buffs
      // to observe the completed cast (e.g. superspeed emitted at effectiveEnd).
      castLifecycle: [afterSkillEffects(scrapperSchedulerHooks.afterCast)],
      hooks: {
        onEventScheduled: scrapperSchedulerHooks.onEventScheduled
      }
    },
    resolution: {
      reactions: [
        onResolvedDamage({
          id: 'engineer.scrapper.damage',
          handler: scrapperResolverEventReactions.damage
        }),
        onBuffApplied({
          id: 'engineer.scrapper.buff',
          handler: scrapperResolverEventReactions.buff
        }),
        onComboResolved({
          id: 'engineer.scrapper.kinetic-accelerators',
          handler: scrapperResolverEventReactions.combo
        })
      ],
      hooks: {
        // Handles the self-scheduled pulse event that keeps Mass Momentum ticking.
        eventHandlers: scrapperResolverEventHandlers
      }
    }
  },
  presentation: scrapperUi
});
