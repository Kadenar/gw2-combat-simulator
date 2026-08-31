import { defineNativeModule } from '#gw2/integrations/patches/authoring/profession.js';
import { createElementalistModuleData } from '#gw2/content/professions/elementalist/catalog/module-data.js';
import { createEvokerState } from '#gw2/content/professions/elementalist/specializations/evoker/state.js';
import { evokerUi } from '#gw2/content/professions/elementalist/specializations/evoker/presentation.js';
import { EVOKER_SKILL_MECHANICS } from '#gw2/content/professions/elementalist/specializations/evoker/skills/index.js';
import { evokerSkillHandlers } from '#gw2/content/professions/elementalist/specializations/evoker/skills/execution.js';
import { EVOKER_BALANCE_PROFILES } from '#gw2/content/professions/elementalist/specializations/evoker/profiles.js';
import { availability } from '#gw2/content/professions/elementalist/specializations/evoker/mechanics/availability.js';
import {
  afterCast,
  onCastComplete,
  onCastStart
} from '#gw2/content/professions/elementalist/specializations/evoker/mechanics/familiars.js';
import { initialize } from '#gw2/content/professions/elementalist/specializations/evoker/mechanics/resources.js';
import { onEventScheduled } from '#gw2/content/professions/elementalist/specializations/evoker/mechanics/event-handlers.js';
import { modifyRechargeDuration } from '#gw2/content/professions/elementalist/specializations/evoker/mechanics/recharge.js';
import {
  evokerModifierRules,
  modifyEvokerAttributes
} from '#gw2/content/professions/elementalist/specializations/evoker/traits/modifiers.js';

/** Registers Evoker contributions while each callback remains with its familiar, resource, or trait owner. */
const evokerCastRules = Object.freeze({
  availability: {
    id: 'elementalist.evoker-availability',
    order: 30,
    handler: availability
  },
  modifyRechargeDuration
});

/**
 * Evoker's damage/attribute contributions: declarative modifier rules plus the
 * attribute pass that must run before crit and condition scaling are computed.
 */
const evokerAttributeRules = Object.freeze({
  modifyAttributes: modifyEvokerAttributes,
  modifierRules: evokerModifierRules
});

/**
 * Scheduler lifecycle hooks for the specialization. Ordering values interleave
 * Evoker bookkeeping with Core Elementalist handlers; `onCastComplete` runs
 * early (order 5) so familiar/charge settlement precedes Core's completion work.
 */
const evokerSchedulerHooks = Object.freeze({
  initialize: {
    id: 'elementalist.evoker-initialize',
    order: 30,
    handler: initialize
  },
  onCastStart: {
    id: 'elementalist.evoker-start',
    order: 30,
    handler: onCastStart
  },
  afterCast: {
    id: 'elementalist.evoker-after-cast',
    order: 30,
    handler: afterCast
  },
  onCastComplete: {
    id: 'elementalist.evoker-complete',
    order: 5,
    handler: onCastComplete
  },
  onEventScheduled: {
    id: 'elementalist.evoker-charges',
    order: 30,
    handler: onEventScheduled
  }
});

/**
 * The Evoker elite specialization module: catalog contributions (skill
 * mechanics + balance profiles), scheduler/resolver state factories, execution
 * mechanics, and the build-editor UI contract.
 */
export const evokerModule = defineNativeModule({
  id: 'Evoker',
  data: createElementalistModuleData('Evoker', {
    skillMechanics: EVOKER_SKILL_MECHANICS,
    balanceProfiles: EVOKER_BALANCE_PROFILES
  }),
  state: { scheduler: createEvokerState, resolver: createEvokerState },
  mechanics: {
    modifiers: evokerAttributeRules,
    execution: {
      skillHandlers: evokerSkillHandlers,
      castRules: evokerCastRules,
      hooks: evokerSchedulerHooks
    }
  },
  presentation: evokerUi
});
