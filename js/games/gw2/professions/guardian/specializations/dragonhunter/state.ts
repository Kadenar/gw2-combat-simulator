import { defineProfessionSpecializationState } from '#gw2/platform/engine/profession/state.js';
import type { GuardianDragonhunterState } from '#gw2/professions/guardian/types.js';

export function createDragonhunterState(): GuardianDragonhunterState {
  return {
    tetherUntil: 0, // sim time at which the Spear of Justice tether expires; 0 = no tether
    nextShieldOfCourageAegisAt: 0, // tracks passive Aegis tick cadence independently of virtue cooldown
    heavyLightReadyAt: 0 // internal cooldown gate for Heavy Light stability proc
  };
}

/** Keeps Dragonhunter projection ownership beside the state that produces it. */
export const DRAGONHUNTER_PUBLIC_END_STATE_KEYS: readonly (keyof GuardianDragonhunterState)[] = Object.freeze([
  'tetherUntil',
  'heavyLightReadyAt'
]);

export const DRAGONHUNTER_RESOLVER_END_STATE_KEYS = DRAGONHUNTER_PUBLIC_END_STATE_KEYS;

export const DRAGONHUNTER_PUBLIC_END_STATE_DEFAULTS: Readonly<Partial<GuardianDragonhunterState>> = Object.freeze({
  tetherUntil: 0,
  heavyLightReadyAt: 0
});

export const dragonhunterState = defineProfessionSpecializationState('Dragonhunter', createDragonhunterState);
