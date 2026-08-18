import { defineProfessionSpecializationState } from '../../../../platform/engine/profession.js';
import type { GuardianDragonhunterState } from '../../types.js';

export function createDragonhunterState(): GuardianDragonhunterState {
  return {
    tetherUntil: 0, // sim time at which the Spear of Justice tether expires; 0 = no tether
    nextShieldOfCourageAegisAt: 0, // tracks passive Aegis tick cadence independently of virtue cooldown
    heavyLightReadyAt: 0 // internal cooldown gate for Heavy Light stability proc
  };
}

export const dragonhunterState = defineProfessionSpecializationState('Dragonhunter', createDragonhunterState);
