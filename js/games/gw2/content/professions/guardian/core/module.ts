import { defineNativeModule } from '#gw2/integrations/patches/authoring/profession.js';
import { onBuffApplied, onResolvedDamage } from '#gw2/integrations/patches/authoring/mechanics.js';
import { createGuardianModuleData } from '#gw2/content/professions/guardian/catalog/module-data.js';
import { guardianCoreSkillHandlers } from '#gw2/content/professions/guardian/core/skills/execution.js';
import {
  guardianCoreEventHandlers,
  guardianCoreEventReactions
} from '#gw2/content/professions/guardian/core/mechanics/reactions.js';
import {
  guardianCoreAttributeRules,
  guardianCoreCastRules
} from '#gw2/content/professions/guardian/core/traits/modifiers.js';
import {
  GUARDIAN_CORE_EXTRA_SKILLS,
  GUARDIAN_CORE_SKILL_MECHANICS
} from '#gw2/content/professions/guardian/core/skills/index.js';
import {
  advanceSpearIlluminationState,
  updateSpearIlluminationState
} from '#gw2/content/professions/guardian/core/skills/spear.js';
import { createGuardianCoreState } from '#gw2/content/professions/guardian/core/state.js';
import { projectGuardianEndState, snapshotGuardianState } from '#gw2/content/professions/guardian/state.js';
import { bindGuardianCoreUi } from '#gw2/content/professions/guardian/core/presentation.js';
import type { GuardianSchedulerContext } from '#gw2/content/professions/guardian/types.js';
import { GUARDIAN_CORE_BALANCE_PROFILES } from '#gw2/content/professions/guardian/core/profiles.js';
import {
  observeGuardianScheduledEvent,
  updateGuardianTraitCastState
} from '#gw2/content/professions/guardian/core/traits/index.js';
import { updateWeaponCastState } from '#gw2/content/professions/guardian/core/mechanics/weapon-state.js';

/** Registers the ordered Core Guardian hooks while each behavior stays with its owning concept. */
const guardianCoreExecutionHooks = Object.freeze({
  advance: Object.freeze([
    {
      id: 'guardian.spear',
      order: 30,
      handler: advanceSpearIlluminationState
    }
  ]),
  afterCast: Object.freeze([
    {
      id: 'guardian.weapon-state',
      order: 10,
      handler: updateWeaponCastState
    },
    {
      id: 'guardian.spear',
      order: 20,
      handler: updateSpearIlluminationState
    },
    {
      id: 'guardian.core-traits',
      order: 30,
      handler: updateGuardianTraitCastState
    }
  ]),
  onEventScheduled: Object.freeze([
    {
      id: 'guardian.traits',
      order: 10,
      handler: observeGuardianScheduledEvent
    }
  ])
});

export const guardianCoreModule = defineNativeModule({
  id: 'Core',
  data: createGuardianModuleData('Core', {
    skillMechanics: GUARDIAN_CORE_SKILL_MECHANICS,
    extraSkills: GUARDIAN_CORE_EXTRA_SKILLS,
    balanceProfiles: GUARDIAN_CORE_BALANCE_PROFILES
  }),
  state: {
    scheduler: createGuardianCoreState,
    resolver: createGuardianCoreState,
    project: projectGuardianEndState
  },
  mechanics: {
    modifiers: guardianCoreAttributeRules,
    execution: {
      skillHandlers: guardianCoreSkillHandlers,
      castRules: guardianCoreCastRules,
      hooks: {
        ...guardianCoreExecutionHooks,
        snapshot: (context: GuardianSchedulerContext) => snapshotGuardianState(context.state.profession)
      }
    },
    resolution: {
      reactions: [
        ...guardianCoreEventReactions.damage.map(onResolvedDamage),
        ...guardianCoreEventReactions.buff.map(onBuffApplied)
      ],
      hooks: {
        eventHandlers: guardianCoreEventHandlers
      }
    }
  },
  presentation: bindGuardianCoreUi
});
