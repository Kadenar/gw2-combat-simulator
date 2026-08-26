import {
  afterSkillEffects,
  onResolvedCriticalHit,
  onResolvedDamage
} from '../../../../platform/gw2/authoring/mechanics.js';
import { defineNativeModule } from '../../../../platform/gw2/authoring/profession.js';
import { createEngineerModuleData } from '../../catalog-data.js';
import { mechanistSkillHandlers } from './handlers.js';
import { mechanistCriticalHitDefinitions, mechanistResolverEventReactions } from './resolver.js';
import {
  mechanistAdvancedSchedulerHooks,
  mechanistAfterCast,
  mechanistAttributeRules,
  mechanistCastRules
} from './rules.js';
import { MECHANIST_SKILL_MECHANICS } from './skills.js';
import { mechanistState } from './state.js';
import { MECHANIST_BALANCE_PROFILES } from './profiles.js';
import { mechanistUi } from './ui.js';

// Compose the mech's independent scheduler lane with resolver reactions for
// hit-triggered traits; the engineer's own cast lane remains owned by Core.
export const mechanistModule = defineNativeModule({
  id: 'Mechanist',
  data: createEngineerModuleData('Mechanist', {
    skillMechanics: MECHANIST_SKILL_MECHANICS,
    balanceProfiles: MECHANIST_BALANCE_PROFILES,
    handlers: mechanistSkillHandlers
  }),
  state: { scheduler: mechanistState.create, resolver: mechanistState.create },
  mechanics: {
    modifiers: mechanistAttributeRules,
    castRules: mechanistCastRules,
    // Trait and recovery handling waits until effectiveEnd, after authored
    // packets, so extending the mech lane cannot reorder the player's effects.
    castLifecycle: [afterSkillEffects(mechanistAfterCast)],
    schedulerHooks: mechanistAdvancedSchedulerHooks,
    reactions: [
      ...mechanistCriticalHitDefinitions.map(onResolvedCriticalHit),
      onResolvedDamage({
        id: 'engineer.mechanist.damage',
        handler: mechanistResolverEventReactions.damage
      })
    ]
  },
  presentation: mechanistUi
});
