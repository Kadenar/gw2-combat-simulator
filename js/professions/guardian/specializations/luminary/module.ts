import { defineNativeModule, onResolvedDamage } from '../../../../platform/gw2/native-profession.js';
import { createGuardianModuleData } from '../../catalog-data.js';
import { luminarySkillHandlers } from './handlers.js';
import { luminaryEventHandlers, luminaryEventReactions } from './resolver.js';
import { luminaryAttributeRules, luminaryCastRules, luminarySchedulerHooks } from './rules.js';
import { LUMINARY_SKILL_MECHANICS } from './skills.js';
import { luminaryState } from './state.js';
import { luminaryUi } from './ui.js';
import { LUMINARY_BALANCE_PROFILES } from './profiles.js';

export const luminaryModule = defineNativeModule({
  id: 'Luminary',
  data: createGuardianModuleData('Luminary', {
    skillMechanics: LUMINARY_SKILL_MECHANICS,
    balanceProfiles: LUMINARY_BALANCE_PROFILES,
    handlers: luminarySkillHandlers
  }),
  state: {
    // Both scheduler and resolver get independent state instances; the resolver
    // rebuilds its view by replaying timeline events rather than sharing a
    // reference with the scheduler.
    scheduler: luminaryState.create,
    resolver: luminaryState.create
  },
  mechanics: {
    modifiers: luminaryAttributeRules,
    castRules: luminaryCastRules,
    schedulerHooks: luminarySchedulerHooks,
    // .map(onResolvedDamage) wraps each reaction so it only fires after damage
    // has been numerically resolved rather than at raw event time.
    reactions: luminaryEventReactions.damage.map(onResolvedDamage),
    resolverHooks: { eventHandlers: luminaryEventHandlers }
  },
  presentation: luminaryUi
});
