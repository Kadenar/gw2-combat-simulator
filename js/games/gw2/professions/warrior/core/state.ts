import { type SkillFlipWindows } from '#gw2/platform/engine/skills/skill-flips.js';
import type { WarriorConfig } from '#gw2/professions/warrior/types.js';
import type { SkillId } from '#gw2/platform/engine/skills/types.js';
import { boundedNumber } from '#kernel/core/numeric.js';

export interface WarriorCoreState {
  adrenaline: number;
  resource: number;
  maximumAdrenaline: number;
  endurance: number;
  maximumEndurance: number;
  enduranceUpdatedAt: number;
  autoattackChains: Record<string, SkillId>;
  availableFlips: SkillFlipWindows;
  signetOfRageNextAt: number;
  targetControlledUntil: number;
  soldierFocusReadyAt: number;
  empowerAlliesNextAt: number;
  burstHitActivations: Record<string, boolean>;
  burstPrecisionDurations: Record<string, number>;
  traitProcReadyAt: Record<string, number>;
  armsCriticalProgress: number;
  axeMasteryProgress: number;
  forcefulGreatswordProgress: number;
  bloodlustProgress: number;
}

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

// Public fields and inactive fallbacks intentionally differ; preserve both sets.
export const WARRIOR_CORE_PUBLIC_STATE_PROJECTION = Object.freeze({
  keys: WARRIOR_CORE_PUBLIC_END_STATE_KEYS,
  defaults: Object.freeze({
    endurance: 100,
    maximumEndurance: 100
  } satisfies Partial<WarriorCoreState>)
});

/** Creates only the state shared by every Warrior build; elite caps initialize in their slices. */
export function createWarriorCoreState(config: WarriorConfig = {}): WarriorCoreState {
  const maximumAdrenaline = 30;
  const adrenaline = boundedNumber(config.initialResource ?? 0, 0, 0, maximumAdrenaline);
  return {
    adrenaline,
    resource: adrenaline,
    maximumAdrenaline,
    endurance: 100,
    maximumEndurance: 100,
    enduranceUpdatedAt: 0,
    autoattackChains: {},
    availableFlips: {},
    signetOfRageNextAt: 0,
    targetControlledUntil: 0,
    soldierFocusReadyAt: 0,
    empowerAlliesNextAt: 0,
    burstHitActivations: {},
    burstPrecisionDurations: {},
    traitProcReadyAt: {},
    armsCriticalProgress: 0,
    axeMasteryProgress: 0,
    forcefulGreatswordProgress: 0,
    bloodlustProgress: 0
  };
}
