import {
  afterSkillEffects,
  onResolvedCriticalHit,
  onResolvedDamage
} from '#gw2/integrations/patches/authoring/mechanics.js';
import { defineNativeModule } from '#gw2/integrations/patches/authoring/profession.js';
import { createEngineerModuleData } from '#gw2/content/professions/engineer/catalog/module-data.js';
import { mechanistSkillHandlers } from '#gw2/content/professions/engineer/specializations/mechanist/skills/execution.js';
import {
  mechanistCriticalHitDefinitions,
  mechanistResolverEventReactions
} from '#gw2/content/professions/engineer/specializations/mechanist/mechanics/mech-effects.js';
import {
  mechanistAdvancedSchedulerHooks,
  mechanistAfterCast,
  mechanistAttributeRules,
  mechanistCastRules
} from '#gw2/content/professions/engineer/specializations/mechanist/mechanics/mech-rules.js';
import { MECHANIST_SKILL_MECHANICS } from '#gw2/content/professions/engineer/specializations/mechanist/skills/index.js';
import { mechanistState } from '#gw2/content/professions/engineer/specializations/mechanist/state.js';
import { MECHANIST_BALANCE_PROFILES } from '#gw2/content/professions/engineer/specializations/mechanist/profiles.js';
import { mechanistUi } from '#gw2/content/professions/engineer/specializations/mechanist/presentation.js';

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
