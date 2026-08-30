import {
  afterSkillEffects,
  onResolvedCriticalHit,
  onResolvedDamage
} from '../../../../../integrations/patches/authoring/mechanics.js';
import { defineNativeModule } from '../../../../../integrations/patches/authoring/profession.js';
import { createEngineerModuleData } from '../../data/catalog.js';
import { mechanistSkillHandlers } from './skills/handlers.js';
import { mechanistCriticalHitDefinitions, mechanistResolverEventReactions } from './mechanics/mech-effects.js';
import {
  mechanistAdvancedSchedulerHooks,
  mechanistAfterCast,
  mechanistAttributeRules,
  mechanistCastRules
} from './mechanics/mech-rules.js';
import { MECHANIST_SKILL_MECHANICS } from './skills/index.js';
import { mechanistState } from './state.js';
import { MECHANIST_BALANCE_PROFILES } from './profiles.js';
import { mechanistUi } from './presentation.js';

// Compose the mech's independent scheduler lane with resolver reactions for
// hit-triggered traits; the engineer's own cast lane remains owned by Core.
export const mechanistModule = defineNativeModule({
  id: 'Mechanist',
  data: createEngineerModuleData('Mechanist', {
    skillMechanics: MECHANIST_SKILL_MECHANICS,
    balanceProfiles: MECHANIST_BALANCE_PROFILES
  }),
  state: { scheduler: mechanistState.create, resolver: mechanistState.create },
  mechanics: {
    modifiers: mechanistAttributeRules,
    execution: {
      skillHandlers: mechanistSkillHandlers,
      castRules: mechanistCastRules,
      // Trait and recovery handling waits until effectiveEnd, after authored
      // packets, so extending the mech lane cannot reorder the player's effects.
      castLifecycle: [afterSkillEffects(mechanistAfterCast)],
      hooks: mechanistAdvancedSchedulerHooks
    },
    resolution: {
      reactions: [
        ...mechanistCriticalHitDefinitions.map(onResolvedCriticalHit),
        onResolvedDamage({
          id: 'engineer.mechanist.damage',
          handler: mechanistResolverEventReactions.damage
        })
      ]
    }
  },
  presentation: mechanistUi
});
