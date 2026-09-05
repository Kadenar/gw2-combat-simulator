import { defineNativeModule } from '#gw2/platform/profession-definition/profession.js';
import {
  onBuffApplied,
  onResolvedControl,
  onResolvedCriticalHit,
  onResolvedDamage
} from '#gw2/platform/profession-definition/mechanics.js';
import { createRangerModuleData } from '#gw2/professions/ranger/catalog/module-data.js';
import {
  rangerCoreSkillHandlers,
  rangerCoreSkillMechanicHandlers
} from '#gw2/professions/ranger/core/execution/index.js';
import { rangerCoreAttributeRules, rangerCoreCastRules } from '#gw2/professions/ranger/core/traits/modifiers.js';
import {
  RANGER_CORE_BASE_SKILL_MECHANICS,
  RANGER_CORE_EXTRA_SKILLS
} from '#gw2/professions/ranger/core/skills/index.js';
import { projectRangerEndState } from '#gw2/professions/ranger/state.js';
import { createRangerCoreState } from '#gw2/professions/ranger/core/state.js';
import { bindRangerCoreUi } from '#gw2/professions/ranger/core/presentation.js';
import { rangerCoreEventHandlers, rangerCoreEventReactions } from '#gw2/professions/ranger/core/mechanics/reactions.js';
import { RANGER_CORE_BALANCE_PROFILES } from '#gw2/professions/ranger/core/profiles.js';
import { prepareGw2BuffCompanionCandidates } from '#gw2/platform/combat/state/allied-players.js';
import { professionCoreState } from '#gw2/platform/engine/profession/state.js';
import type { SimulationEvent, SimulationEventInput } from '#gw2/platform/engine/events/types.js';
import { snapshotRangerState } from '#gw2/professions/ranger/state.js';
import type { RangerCastContext, RangerSchedulerContext, RangerSkill } from '#gw2/professions/ranger/types.js';
import { applyRangerWeaponSwapTraits, completeRangerTraits } from '#gw2/professions/ranger/core/traits/index.js';
import {
  beginRangerPetCommand,
  observeRangerPetEvent,
  prepareRangerPetEvent,
  rangerPetCompanionId,
  rangerPetTaskHandlers
} from '#gw2/professions/ranger/core/mechanics/pets.js';
import { advanceRangerResources } from '#gw2/professions/ranger/core/mechanics/resources.js';
import {
  completeRangerWeaponSkill,
  updateRangerWeaponState
} from '#gw2/professions/ranger/core/mechanics/weapon-state.js';

/** Registers ordered Core Ranger hooks while behavior remains owned by pets, resources, weapons, and traits. */
const rangerCoreExecutionHooks = Object.freeze({
  prepareEvent: {
    id: 'ranger.boon-companion-candidates',
    order: 5,
    handler: (context: RangerSchedulerContext, event: SimulationEventInput) =>
      prepareRangerPetEvent(
        context,
        prepareGw2BuffCompanionCandidates(
          event,
          professionCoreState(context).petActive ? [rangerPetCompanionId(context)] : []
        )
      )
  },
  advance: {
    id: 'ranger.core-resources',
    order: 10,
    handler: advanceRangerResources
  },
  onCastStart: {
    id: 'ranger.pet-command',
    order: 10,
    handler: beginRangerPetCommand
  },
  onEventScheduled: {
    id: 'ranger.core-events',
    order: 10,
    handler(context: RangerSchedulerContext, event: SimulationEvent): void {
      observeRangerPetEvent(context, event);
    }
  },
  taskHandlers: rangerPetTaskHandlers,
  snapshot: (context: RangerSchedulerContext) => snapshotRangerState(context.state.profession),
  afterCast: {
    id: 'ranger.weapon-state',
    order: 10,
    handler: updateRangerWeaponState
  },
  onCastComplete(context: RangerCastContext, skill: RangerSkill): void {
    completeRangerWeaponSkill(context, skill);
    completeRangerTraits(context, skill);
  },
  onWeaponSwap: applyRangerWeaponSwapTraits
});

export const rangerCoreModule = defineNativeModule({
  id: 'Core',
  data: createRangerModuleData('Core', {
    skillMechanics: RANGER_CORE_BASE_SKILL_MECHANICS,
    balanceProfiles: RANGER_CORE_BALANCE_PROFILES,
    extraSkills: RANGER_CORE_EXTRA_SKILLS
  }),
  state: {
    scheduler: createRangerCoreState,
    resolver: createRangerCoreState,
    project: projectRangerEndState
  },
  mechanics: {
    modifiers: rangerCoreAttributeRules,
    execution: {
      skillHandlers: rangerCoreSkillHandlers,
      castRules: rangerCoreCastRules,
      skillMechanicHandlers: rangerCoreSkillMechanicHandlers,
      hooks: rangerCoreExecutionHooks
    },
    resolution: {
      hooks: { eventHandlers: rangerCoreEventHandlers },
      reactions: [
        ...rangerCoreEventReactions.critical.map(onResolvedCriticalHit),
        ...rangerCoreEventReactions.damage.map(onResolvedDamage),
        ...rangerCoreEventReactions.control.map(onResolvedControl),
        ...rangerCoreEventReactions.buff.map(onBuffApplied)
      ]
    }
  },
  presentation: bindRangerCoreUi
});
