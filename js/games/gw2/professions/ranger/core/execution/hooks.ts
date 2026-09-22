import { prepareGw2BuffCompanionCandidates } from '#gw2/platform/combat/state/allied-players.js';
import { professionCoreState } from '#gw2/platform/engine/profession/state.js';
import type { SimulationEvent, SimulationEventBase } from '#gw2/platform/engine/events/events.js';
import { completeRangerHealingSkill } from '#gw2/professions/ranger/core/execution/index.js';

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
import { prepareRangerTrapEvent, triggerRangerPrecastTrap } from '#gw2/professions/ranger/core/mechanics/traps.js';
import {
  completeRangerWeaponSkill,
  beginRangerStealthAttack,
  rangerStealthReaction,
  updateRangerWeaponState
} from '#gw2/professions/ranger/core/mechanics/weapon-state.js';

/** Registers ordered Core Ranger hooks while behavior remains owned by pets, resources, weapons, and traits. */
export const rangerCoreExecutionHooks = Object.freeze({
  prepareEvent: {
    id: 'ranger.boon-companion-candidates',
    order: 5,
    handler: (context: RangerSchedulerContext, event: SimulationEventBase) =>
      prepareRangerPetEvent(
        context,
        prepareGw2BuffCompanionCandidates(
          prepareRangerTrapEvent(context, event),
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
    handler(context: RangerCastContext, skill: RangerSkill): void {
      beginRangerPetCommand(context, skill);
      beginRangerStealthAttack(context, skill);
    }
  },
  onEventScheduled: {
    id: 'ranger.core-events',
    order: 10,
    handler(context: RangerSchedulerContext, event: SimulationEvent): void {
      triggerRangerPrecastTrap(context, event);
      observeRangerPetEvent(context, event);
      rangerStealthReaction.onEventScheduled.handler(context, event);
    }
  },
  taskHandlers: { ...rangerPetTaskHandlers, ...rangerStealthReaction.taskHandlers },
  afterCast: {
    id: 'ranger.weapon-state',
    order: 10,
    handler: updateRangerWeaponState
  },
  onCastComplete(context: RangerCastContext, skill: RangerSkill): void {
    completeRangerWeaponSkill(context, skill);
    completeRangerHealingSkill(context, skill);
    completeRangerTraits(context, skill);
  },
  onWeaponSwap: applyRangerWeaponSwapTraits
});
