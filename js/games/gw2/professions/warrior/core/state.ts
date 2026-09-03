import type { WarriorConfig, WarriorCoreState } from '#gw2/professions/warrior/types.js';

/** Declares the Core fields exposed by every Warrior end-state projection. */
export const WARRIOR_CORE_PUBLIC_END_STATE_KEYS = Object.freeze([
  'adrenaline',
  'resource',
  'maximumAdrenaline',
  'endurance',
  'maximumEndurance',
  'autoattackChains',
  'availableFlips'
] as const satisfies readonly (keyof WarriorCoreState)[]);

export const WARRIOR_CORE_PUBLIC_END_STATE_DEFAULTS: Readonly<Partial<WarriorCoreState>> = Object.freeze({
  endurance: 100,
  maximumEndurance: 100
});

/** Creates only the state shared by every Warrior build; elite caps initialize in their slices. */
export function createWarriorCoreState(config: WarriorConfig = {}): WarriorCoreState {
  const maximumAdrenaline = 30;
  const adrenaline = Math.max(0, Math.min(maximumAdrenaline, Number(config.initialResource ?? 0)));
  return {
    adrenaline,
    resource: adrenaline,
    maximumAdrenaline,
    lastResourceAt: 0,
    endurance: 100,
    maximumEndurance: 100,
    enduranceUpdatedAt: 0,
    autoattackChains: {},
    availableFlips: {},
    burstPowerExpiries: [],
    signetMasteryExpiries: [],
    signetOfRageNextAt: 0,
    targetControlledUntil: 0,
    soldierFocusReadyAt: 0,
    empowerAlliesNextAt: 0,
    burstHitActivations: {},
    burstPrecisionDurations: {},
    traitProcReadyAt: {},
    armsCriticalProgress: 0,
    bloodlustProgress: 0,
    furiousSurgeExpiries: []
  };
}
