import type { SkillId } from '#gw2/platform/engine/skills/types.js';
import type { GuardianConfig } from '#gw2/professions/guardian/types.js';
import { boundedNumber } from '#kernel/core/numeric.js';
import { purgeExpiredStacks } from '#gw2/platform/combat/resources/timed-stacks.js';

export interface GuardianCoreState {
  endurance: number;
  maximumEndurance: number;
  enduranceUpdatedAt: number;
  justiceActiveArmed: boolean;
  justiceHitCount: number;
  justiceActiveBurns: number;
  justicePassiveBurns: number;
  virtueReadyAt: Record<'justice' | 'resolve' | 'courage', number>;
  lastVirtuePassiveWasReady: boolean;
  autoattackChains: Record<string, SkillId>;
  availableFlips: Record<string, number>;
  symbolicAvengerExpirations: number[];
  symbolIgnitionStartsAt: number;
  symbolIgnitionUntil: number;
  symbolIgnitionReadyAt: number;
  symbolProjectileIgnitionReadyAt: number;
  zealotsResolutionReadyAt: number;
  resolutionUntil: number;
  righteousNextMightAt: number;
  furiousFocusReadyAt: number;
  healersResolutionReadyAt: number;
  protectorsRestorationReadyAt: number;
  spearIlluminatedArmed: boolean;
  spearIlluminatedUntil: number;
  spearLuminanceUntil: number;
}

/** Compatibility mirrors are derived at output boundaries, never maintained in combat state. */
export interface GuardianCorePublicState extends GuardianCoreState {
  justiceArmed: boolean;
  justiceBurns: number;
  symbolicAvengerStacks: number;
}

// Create a complete Guardian core state with bounded resources and initialized
// virtue, trait, symbol, and flip bookkeeping.
export function createGuardianCoreState(config: GuardianConfig = {}): GuardianCoreState {
  return {
    endurance: boundedNumber(config.initialEndurance ?? 100, 100, 0, 100),
    maximumEndurance: 100,
    enduranceUpdatedAt: 0,
    justiceActiveArmed: false,
    justiceHitCount: 0,
    justiceActiveBurns: 0,
    justicePassiveBurns: 0,
    virtueReadyAt: {
      justice: 0,
      resolve: 0,
      courage: 0
    },
    lastVirtuePassiveWasReady: false,
    autoattackChains: {},
    availableFlips: {},
    symbolicAvengerExpirations: [],
    symbolIgnitionStartsAt: -1,
    symbolIgnitionUntil: -1,
    symbolIgnitionReadyAt: 0,
    symbolProjectileIgnitionReadyAt: 0,
    zealotsResolutionReadyAt: 0,
    resolutionUntil: 0,
    righteousNextMightAt: 0,
    furiousFocusReadyAt: 0,
    healersResolutionReadyAt: 0,
    protectorsRestorationReadyAt: 0,
    spearIlluminatedArmed: false,
    spearIlluminatedUntil: 0,
    spearLuminanceUntil: 0
  };
}

/** Each Symbolic Avenger stack expires independently, including between symbol hits. */
export function activeSymbolicAvengerExpirations(state: Partial<GuardianCoreState>, at: number): number[] {
  return purgeExpiredStacks(state.symbolicAvengerExpirations || [], at);
}

/** Declares the Core-owned portion of Guardian's stable public end-state contract. */
export const GUARDIAN_CORE_PUBLIC_END_STATE_KEYS: readonly (keyof GuardianCorePublicState)[] = Object.freeze([
  'endurance',
  'maximumEndurance',
  'justiceArmed',
  'justiceActiveArmed',
  'justiceHitCount',
  'justiceBurns',
  'justiceActiveBurns',
  'justicePassiveBurns',
  'virtueReadyAt',
  'autoattackChains',
  'availableFlips',
  'symbolIgnitionStartsAt',
  'symbolIgnitionUntil',
  'symbolIgnitionReadyAt',
  'symbolProjectileIgnitionReadyAt',
  'symbolicAvengerStacks',
  'symbolicAvengerExpirations',
  'zealotsResolutionReadyAt',
  'resolutionUntil',
  'spearIlluminatedArmed',
  'spearIlluminatedUntil',
  'spearLuminanceUntil'
]);

// Core fields have no inactive fallbacks; their values come from the live state.
export const GUARDIAN_CORE_PUBLIC_STATE_PROJECTION = Object.freeze({
  keys: GUARDIAN_CORE_PUBLIC_END_STATE_KEYS,
  defaults: {}
});

/** Identifies Core fields whose chronological resolver values supersede scheduler snapshots. */
export const GUARDIAN_CORE_RESOLVER_END_STATE_KEYS: readonly (keyof GuardianCoreState)[] = Object.freeze([
  'justiceActiveArmed',
  'justiceHitCount',
  'justiceActiveBurns',
  'justicePassiveBurns',
  'virtueReadyAt',
  'symbolicAvengerExpirations',
  'zealotsResolutionReadyAt',
  'resolutionUntil'
]);
