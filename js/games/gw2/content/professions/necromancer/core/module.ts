import { defineNativeModule } from '#gw2/integrations/patches/authoring/profession.js';
import {
  onConditionApplied,
  onResolvedBlind,
  onResolvedControl,
  onResolvedDamage
} from '#gw2/integrations/patches/authoring/mechanics.js';
import { createNecromancerModuleData } from '#gw2/content/professions/necromancer/catalog/module-data.js';
import {
  necromancerCoreAttributeRules,
  necromancerCoreCastRules
} from '#gw2/content/professions/necromancer/core/traits/modifiers.js';
import {
  necromancerCoreResolverEventHandlers,
  necromancerCoreResolverEventReactions
} from '#gw2/content/professions/necromancer/core/mechanics/reactions.js';
import { createNecromancerCoreState } from '#gw2/content/professions/necromancer/core/state.js';
import { projectNecromancerEndState, snapshotNecromancerState } from '#gw2/content/professions/necromancer/state.js';
import { bindNecromancerCoreUi } from '#gw2/content/professions/necromancer/core/presentation.js';
import {
  NECROMANCER_CORE_BASE_SKILL_MECHANICS,
  NECROMANCER_CORE_EXTRA_SKILLS
} from '#gw2/content/professions/necromancer/core/skills/index.js';
import { necromancerCoreSkillHandlers } from '#gw2/content/professions/necromancer/core/skills/execution.js';
import { NECROMANCER_SKILL_IDS as ID } from '#gw2/content/professions/necromancer/data/ids.js';
import { NECROMANCER_CORE_BALANCE_PROFILES } from '#gw2/content/professions/necromancer/core/profiles.js';
import type { SimulationEventInput } from '#gw2/platform/engine/types.js';
import { prepareGw2BuffCompanionCandidates } from '#gw2/platform/combat/state/allied-players.js';
import type { NecromancerSchedulerContext } from '#gw2/content/professions/necromancer/types.js';
import { observeNecromancerPlagueSendingEvent } from '#gw2/content/professions/necromancer/core/mechanics/conditions.js';
import {
  advanceNecromancerState,
  resetNecromancerResources
} from '#gw2/content/professions/necromancer/core/mechanics/life-force.js';
import { necromancerMinionTaskHandlers } from '#gw2/content/professions/necromancer/core/mechanics/minions.js';
import { necromancerActiveBoonCompanionIds } from '#gw2/content/professions/necromancer/core/mechanics/state-helpers.js';
import {
  necromancerCoreSkillMechanicHandlers,
  necromancerWeaponTaskHandlers
} from '#gw2/content/professions/necromancer/core/skills/weapons.js';
import {
  applyNecromancerAfterCastTraits,
  applyNecromancerCastStartTraits
} from '#gw2/content/professions/necromancer/core/traits/index.js';

/** Registers ordered Core Necromancer hooks while behavior remains with its resource, condition, weapon, or trait owner. */
const necromancerSchedulerHooks = Object.freeze({
  prepareEvent: {
    id: 'necromancer.boon-companion-candidates',
    order: 5,
    handler: (context: NecromancerSchedulerContext, event: SimulationEventInput) =>
      prepareGw2BuffCompanionCandidates(event, necromancerActiveBoonCompanionIds(context))
  },
  advance: advanceNecromancerState,
  onCastStart: applyNecromancerCastStartTraits,
  afterCast: applyNecromancerAfterCastTraits,
  onCooldownReset: resetNecromancerResources,
  onEventScheduled: observeNecromancerPlagueSendingEvent,
  taskHandlers: Object.freeze({
    ...necromancerWeaponTaskHandlers,
    ...necromancerMinionTaskHandlers
  })
});

export const necromancerCoreModule = defineNativeModule({
  id: 'Core',
  data: createNecromancerModuleData('Core', {
    skillMechanics: NECROMANCER_CORE_BASE_SKILL_MECHANICS,
    extraSkills: NECROMANCER_CORE_EXTRA_SKILLS,
    balanceProfiles: NECROMANCER_CORE_BALANCE_PROFILES,
    autoattackChains: {
      // The API does not link Echo to the omitted final step, so declare the complete in-game sequence explicitly.
      additional: [[ID.ENERVATION_BLADE, ID.ENERVATION_ECHO, ID.DEATHLY_ENERVATION]]
    }
  }),
  state: {
    scheduler: createNecromancerCoreState,
    resolver: createNecromancerCoreState,
    project: projectNecromancerEndState
  },
  mechanics: {
    modifiers: necromancerCoreAttributeRules,
    execution: {
      skillHandlers: necromancerCoreSkillHandlers,
      castRules: necromancerCoreCastRules,
      skillMechanicHandlers: necromancerCoreSkillMechanicHandlers,
      hooks: {
        ...necromancerSchedulerHooks,
        snapshot: (context: NecromancerSchedulerContext) => snapshotNecromancerState(context.state.profession)
      }
    },
    resolution: {
      hooks: { eventHandlers: necromancerCoreResolverEventHandlers },
      reactions: [
        ...necromancerCoreResolverEventReactions.damage.map(onResolvedDamage),
        ...necromancerCoreResolverEventReactions.blind.map(onResolvedBlind),
        ...necromancerCoreResolverEventReactions.control.map(onResolvedControl),
        ...necromancerCoreResolverEventReactions.condition.map(onConditionApplied)
      ]
    }
  },
  presentation: bindNecromancerCoreUi
});
