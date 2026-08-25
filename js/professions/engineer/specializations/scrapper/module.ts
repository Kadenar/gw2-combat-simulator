import {
  afterSkillEffects,
  onBuffApplied,
  onComboResolved,
  onResolvedDamage
} from '../../../../platform/gw2/authoring/mechanics.js';
import { defineNativeModule } from '../../../../platform/gw2/authoring/profession.js';
import { createEngineerModuleData } from '../../catalog-data.js';
import { scrapperResolverEventHandlers, scrapperResolverEventReactions } from './resolver.js';
import { scrapperAttributeRules, scrapperCastRules, scrapperSchedulerHooks } from './rules.js';
import { SCRAPPER_SKILL_MECHANICS } from './skills.js';
import { scrapperState } from './state.js';
import { SCRAPPER_BALANCE_PROFILES } from './profiles.js';
import { scrapperUi } from './ui.js';

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
    castRules: scrapperCastRules,
    // afterSkillEffects runs after all skill effects are emitted, allowing trait buffs
    // to observe the completed cast (e.g. superspeed emitted at effectiveEnd).
    castLifecycle: [afterSkillEffects(scrapperSchedulerHooks.afterCast)],
    schedulerHooks: {
      onEventScheduled: scrapperSchedulerHooks.onEventScheduled
    },
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
    resolverHooks: {
      // Handles the self-scheduled pulse event that keeps Mass Momentum ticking.
      eventHandlers: scrapperResolverEventHandlers
    }
  },
  presentation: scrapperUi
});
