import { prepareGw2BuffCompanionCandidates } from '../../../../../platform/combat/state/allied-players.js';
import { professionCoreState } from '../../../../../platform/engine/profession/state.js';
import type { SimulationEvent, SimulationEventInput } from '../../../../../platform/engine/types.js';
import { snapshotRangerState } from '../../state/index.js';
import type { RangerCastContext, RangerSchedulerContext, RangerSkill } from '../../types.js';
import { applyRangerWeaponSwapTraits, completeRangerTraits } from '../traits/index.js';
import { beginRangerPetCommand, observeRangerPetEvent, rangerPetCompanionId, rangerPetTaskHandlers } from './pets.js';
import { advanceRangerResources } from './resources.js';
import { updateRangerWeaponState } from './weapon-state.js';

/** Composes Core Ranger scheduling hooks owned by pets, resources, weapons, and traits. */
export const rangerCoreExecutionHooks = Object.freeze({
  prepareEvent: {
    id: 'ranger.boon-companion-candidates',
    order: 5,
    // An unmerged active pet competes only after player recipients for shared boons.
    handler: (context: RangerSchedulerContext, event: SimulationEventInput) =>
      prepareGw2BuffCompanionCandidates(
        event,
        professionCoreState(context).petActive ? [rangerPetCompanionId(context)] : []
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
    completeRangerTraits(context, skill);
  },
  // Weapon-swap traits extend the shared transition without reimplementing it.
  onWeaponSwap: applyRangerWeaponSwapTraits
});
