import { type SkillFlipWindows } from '#gw2/platform/execution/skill-flips.js';
import { createResourceClock } from '#gw2/platform/combat/resources/resource-policy.js';
import type { ResourceClock } from '#gw2/platform/combat/resources/clock.js';
import type { SkillId } from '#gw2/platform/skills/types.js';

export interface WarriorCoreState {
  adrenaline: ResourceClock;
  endurance: number;
  enduranceUpdatedAt: number;

  autoattackChains: Record<string, SkillId>;
  availableFlips: SkillFlipWindows;

  burstHitActivations: Record<string, boolean>;
  /** Readiness waits for the next actual signet pulse instead of crediting future adrenaline. */
  nextSignetPulseAt: number;
}

/** Declares the Core fields exposed by every Warrior end-state projection. */
const WARRIOR_CORE_PUBLIC_END_STATE_KEYS = Object.freeze([
  'adrenaline',
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

/** Creates only the state shared by every Warrior build; selected resource policies supply pool values and caps. */
export function createWarriorCoreState(): WarriorCoreState {
  return {
    adrenaline: createResourceClock(),
    endurance: 100,
    enduranceUpdatedAt: 0,

    autoattackChains: {},
    availableFlips: {},

    burstHitActivations: {},
    nextSignetPulseAt: Infinity
  };
}
