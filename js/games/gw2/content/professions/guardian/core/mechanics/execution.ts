import { advanceSpearIlluminationState, updateSpearIlluminationState } from '../skills/spear.js';
import { observeGuardianScheduledEvent, updateGuardianTraitCastState } from '../traits/index.js';
import { updateWeaponCastState } from './weapon-state.js';

/** Composes Core Guardian scheduling hooks owned by spear, weapon, and trait concepts. */
export const guardianCoreExecutionHooks = Object.freeze({
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
