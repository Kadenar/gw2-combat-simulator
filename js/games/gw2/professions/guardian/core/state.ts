import { type SkillFlipWindows } from '#gw2/platform/engine/skills/skill-flips.js';
import type { SkillId } from '#gw2/platform/engine/skills/types.js';
import type { RechargeProgress } from '#gw2/platform/engine/skills/recharge.js';
import type { GuardianConfig } from '#gw2/professions/guardian/types.js';
import { boundedNumber } from '#kernel/core/numeric.js';
import { purgeExpiredStacks } from '#gw2/platform/combat/resources/timed-stacks.js';

export interface GuardianCoreState {
  endurance: number;

  enduranceUpdatedAt: number;
  justiceActiveArmed: boolean;
  justiceHitCount: number;
  justiceActiveBurns: number;
  justicePassiveBurns: number;
  virtueReadyAt: Record<'justice' | 'resolve' | 'courage', number>;
  autoattackChains: Record<string, SkillId>;
  availableFlips: SkillFlipWindows;
  symbolicAvengerExpirations: number[];
  symbolIgnitionStartsAt: number;
  symbolIgnitionUntil: number;
  symbolIgnitionReadyAt: number;
  symbolProjectileIgnitionReadyAt: number;
  zealotsResolutionReadyAt: number;
  resolutionUntil: number;
  righteousInstinctsGeneration: number;
  furiousFocusReadyAt: number;
  furiousFocusRecharge: RechargeProgress | null;
  healersResolutionReadyAt: number;
  protectorsRestorationReadyAt: number;
  spearIlluminatedArmed: boolean;
  spearIlluminatedUntil: number;
  spearLuminanceUntil: number;
}

// Create a complete Guardian core state with bounded resources and initialized
// virtue, trait, symbol, and flip bookkeeping.
export function createGuardianCoreState(config: GuardianConfig = {}): GuardianCoreState {
  return {
    endurance: boundedNumber(config.initialEndurance ?? 100, 100, 0, 100),

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
    autoattackChains: {},
    availableFlips: {},
    symbolicAvengerExpirations: [],
    symbolIgnitionStartsAt: -1,
    symbolIgnitionUntil: -1,
    symbolIgnitionReadyAt: 0,
    symbolProjectileIgnitionReadyAt: 0,
    zealotsResolutionReadyAt: 0,
    resolutionUntil: 0,
    righteousInstinctsGeneration: 0,
    furiousFocusReadyAt: 0,
    furiousFocusRecharge: null,
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
const GUARDIAN_CORE_PUBLIC_END_STATE_KEYS: readonly (keyof GuardianCoreState)[] = Object.freeze([
  'endurance',

  'justiceActiveArmed',
  'justiceHitCount',
  'justiceActiveBurns',
  'justicePassiveBurns',
  'virtueReadyAt',
  'autoattackChains',
  'availableFlips',
  'symbolIgnitionStartsAt',
  'symbolIgnitionUntil',
  'symbolIgnitionReadyAt',
  'symbolProjectileIgnitionReadyAt',
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
