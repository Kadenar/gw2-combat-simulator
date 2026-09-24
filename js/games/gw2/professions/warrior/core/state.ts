import { type SkillFlipWindows } from '#gw2/platform/engine/skills/skill-flips.js';
import type { Gw2Config } from '#gw2/platform/simulation/config.js';
import type { SkillId } from '#gw2/platform/engine/skills/types.js';
import { boundedNumber } from '#kernel/core/numeric.js';

export interface WarriorCoreState {
  adrenaline: number;
  maximumAdrenaline: number;
  endurance: number;

  enduranceUpdatedAt: number;
  autoattackChains: Record<string, SkillId>;
  availableFlips: SkillFlipWindows;
  targetControlledUntil: number;
  soldierFocusReadyAt: number;
  burstHitActivations: Record<string, boolean>;
  burstPrecisionDurations: Record<string, number>;
  traitProcReadyAt: Record<string, number>;
  armsCriticalProgress: number;
  axeMasteryProgress: number;
  forcefulGreatswordProgress: number;
  bloodlustProgress: number;
}

/** Declares the Core fields exposed by every Warrior end-state projection. */
const WARRIOR_CORE_PUBLIC_END_STATE_KEYS = Object.freeze([
  'adrenaline',
  'maximumAdrenaline',
  'endurance',

  'autoattackChains',
  'availableFlips'
] as const satisfies readonly (keyof WarriorCoreState)[]);

// Public fields and inactive fallbacks intentionally differ; preserve both sets.
export const WARRIOR_CORE_PUBLIC_STATE_PROJECTION = Object.freeze({
  keys: WARRIOR_CORE_PUBLIC_END_STATE_KEYS,
  defaults: Object.freeze({
    endurance: 100
  } satisfies Partial<WarriorCoreState>)
});

/** Creates only the state shared by every Warrior build; elite caps initialize in their slices. */
export function createWarriorCoreState(config: Gw2Config = {}): WarriorCoreState {
  const maximumAdrenaline = 30;
  const adrenaline = boundedNumber(config.initialResource ?? 0, 0, 0, maximumAdrenaline);
  return {
    adrenaline,
    maximumAdrenaline,
    endurance: 100,

    enduranceUpdatedAt: 0,
    autoattackChains: {},
    availableFlips: {},
    targetControlledUntil: 0,
    soldierFocusReadyAt: 0,
    burstHitActivations: {},
    burstPrecisionDurations: {},
    traitProcReadyAt: {},
    armsCriticalProgress: 0,
    axeMasteryProgress: 0,
    forcefulGreatswordProgress: 0,
    bloodlustProgress: 0
  };
}
