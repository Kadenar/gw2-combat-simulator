import { defineNativeModule } from '#gw2/platform/profession-definition/profession.js';
import {
  onBuffApplied,
  onConditionApplied,
  onResolvedCriticalHit,
  onResolvedDamage
} from '#gw2/platform/profession-definition/mechanics.js';
import { createThiefModuleData } from '#gw2/professions/thief/catalog/module-data.js';
import { thiefCoreEventHandlers, thiefCoreEventReactions } from '#gw2/professions/thief/core/mechanics/reactions.js';
import { thiefCoreAttributeRules, thiefCoreCastRules } from '#gw2/professions/thief/core/traits/modifiers.js';
import { createThiefCoreState, snapshotThiefState } from '#gw2/professions/thief/core/state.js';
import { projectThiefEndState } from '#gw2/professions/thief/state.js';
import { thiefCoreUi } from '#gw2/professions/thief/core/presentation.js';
import { THIEF_CORE_EXTRA_SKILLS, THIEF_CORE_SKILL_MECHANICS } from '#gw2/professions/thief/core/skills/index.js';
import { thiefCoreSkillHandlers } from '#gw2/professions/thief/core/execution/index.js';
import { THIEF_CORE_BALANCE_PROFILES } from '#gw2/professions/thief/core/profiles.js';
import type { ThiefSchedulerContext } from '#gw2/professions/thief/types.js';
import { observeThievesGuildCombatEvent } from '#gw2/professions/thief/core/mechanics/thieves-guild.js';
import { applyThiefWeaponSwapEffects } from '#gw2/professions/thief/core/execution/actions.js';
import { thiefCoreTaskHandlers } from '#gw2/professions/thief/core/mechanics/task-handlers.js';
import { observeStealthBreakingStrike } from '#gw2/professions/thief/core/mechanics/stealth.js';
import {
  updateThiefWeaponState,
  observeThiefAxe,
  materializeThiefAxe
} from '#gw2/professions/thief/core/mechanics/weapon-state.js';
import {
  updateThiefTraitCastState,
  observeThiefCriticalBoons,
  materializeThiefCriticalBoons
} from '#gw2/professions/thief/core/traits/index.js';
import {
  advanceThiefCoreResources,
  completeThiefCoreResources,
  restartInfiltratorsSignetPassive,
  pulseInfiltratorsSignet,
  spendThiefCoreResources
} from '#gw2/professions/thief/core/mechanics/resources.js';

/** Registers Core Thief resources, weapons, traits, and tasks in scheduler order. */
export const thiefCoreSchedulerHooks = Object.freeze({
  initialize: { id: 'thief.infiltrators-signet', order: 10, handler: restartInfiltratorsSignetPassive },
  onCooldownReset: { id: 'thief.infiltrators-signet', order: 10, handler: restartInfiltratorsSignetPassive },
  advance: advanceThiefCoreResources,
  onCastStart: spendThiefCoreResources,
  onEventScheduled: Object.freeze([
    { id: 'thief.spinning-axe', order: 40, handler: observeThiefAxe },
    { id: 'thief.critical-boons', order: 30, handler: observeThiefCriticalBoons },
    {
      id: 'thief.stealth-breaking-strikes',
      order: 10,
      handler: observeStealthBreakingStrike
    },
    {
      id: 'thief.thieves-guild-combat',
      order: 20,
      handler: observeThievesGuildCombatEvent
    }
  ]),
  // Thief stance and trait effects run only after the shared swap is committed.
  onWeaponSwap: applyThiefWeaponSwapEffects,
  onCastComplete: {
    id: 'thief.core-resources',
    order: 10,
    handler: completeThiefCoreResources
  },
  afterCast: Object.freeze([
    {
      id: 'thief.weapon-state',
      order: 10,
      handler: updateThiefWeaponState
    },
    {
      id: 'thief.traits',
      order: 20,
      handler: updateThiefTraitCastState
    }
  ]),
  taskHandlers: {
    'thief.infiltrators-signet': pulseInfiltratorsSignet,
    ...thiefCoreTaskHandlers,
    'thief.critical-boons': materializeThiefCriticalBoons,
    'thief.spinning-axe': materializeThiefAxe
  },
  snapshot: (context: ThiefSchedulerContext) => snapshotThiefState(context.state.profession)
});

export const thiefCoreModule = defineNativeModule({
  id: 'Core',
  data: createThiefModuleData('Core', {
    skillMechanics: THIEF_CORE_SKILL_MECHANICS,
    balanceProfiles: THIEF_CORE_BALANCE_PROFILES,
    extraSkills: THIEF_CORE_EXTRA_SKILLS
  }),
  state: {
    scheduler: createThiefCoreState,
    resolver: createThiefCoreState,
    project: projectThiefEndState
  },
  mechanics: {
    modifiers: thiefCoreAttributeRules,
    execution: {
      skillHandlers: thiefCoreSkillHandlers,
      castRules: thiefCoreCastRules,
      hooks: thiefCoreSchedulerHooks
    },
    resolution: {
      reactions: [
        ...thiefCoreEventReactions.critical.map(onResolvedCriticalHit),
        ...thiefCoreEventReactions.damage.map(onResolvedDamage),
        ...thiefCoreEventReactions.condition.map(onConditionApplied),
        ...thiefCoreEventReactions.buff.map(onBuffApplied)
      ],
      hooks: {
        eventHandlers: thiefCoreEventHandlers
      }
    }
  },
  presentation: thiefCoreUi
});
