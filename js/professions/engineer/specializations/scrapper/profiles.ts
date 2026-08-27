import type { BalanceProfile } from '../../../../platform/engine/types.js';
import { defineTraitProfile as trait } from '../../../../platform/gw2/authoring/balance-profiles.js';
import { ENGINEER_TRAIT_IDS as TRAIT } from '../../data/ids.js';

// Trait IDs double as balance-profile IDs so scheduler and resolver hooks read
// the same patchable durations, thresholds, and internal cooldowns.
export const SCRAPPER_BALANCE_PROFILE_IDS = Object.freeze({
  kineticAccelerators: TRAIT.KINETIC_ACCELERATORS,
  massMomentum: TRAIT.MASS_MOMENTUM,
  speedOfSynergy: TRAIT.SPEED_OF_SYNERGY,
  gyroscopicAcceleration: TRAIT.GYROSCOPIC_ACCELERATION,
  systemShocker: TRAIT.SYSTEM_SHOCKER,
  appliedForce: TRAIT.APPLIED_FORCE
});

// Normalize trait catalog metadata while leaving each profile responsible only
// for the values and effects its behavior consumes.

// Centralizing these values keeps combo prediction, resolved proc attribution,
// and cast-time trait effects aligned under balance overrides.
export const SCRAPPER_BALANCE_PROFILES: readonly BalanceProfile[] = Object.freeze([
  trait(SCRAPPER_BALANCE_PROFILE_IDS.kineticAccelerators, 'Kinetic Accelerators', {
    internalCooldown: 3,
    effects: [
      { type: 'boon', boon: 'quickness', stacks: 1, duration: 3 },
      { type: 'boon', boon: 'might', stacks: 3, duration: 10 }
    ]
  }),
  trait(SCRAPPER_BALANCE_PROFILE_IDS.massMomentum, 'Mass Momentum', {
    pulseInterval: 1,
    effects: [
      { type: 'boon', boon: 'might', stacks: 1, duration: 5 },
      { type: 'boon', boon: 'stability', stacks: 1, duration: 3 }
    ]
  }),
  trait(SCRAPPER_BALANCE_PROFILE_IDS.speedOfSynergy, 'Speed of Synergy', {
    minimumStacks: 7,
    threshold: 7,
    maximumStacks: 12
  }),
  trait(SCRAPPER_BALANCE_PROFILE_IDS.gyroscopicAcceleration, 'Gyroscopic Acceleration', {
    effects: [{ type: 'buff', kind: 'superspeed', stacks: 1, duration: 5 }]
  }),
  trait(SCRAPPER_BALANCE_PROFILE_IDS.systemShocker, 'System Shocker', {
    effects: [{ type: 'control', duration: 1 }]
  }),
  trait(SCRAPPER_BALANCE_PROFILE_IDS.appliedForce, 'Applied Force', {
    maximumStacks: 25,
    threshold: 10,
    internalCooldown: 10,
    attributePerStack: 30,
    effects: [{ type: 'boon', boon: 'stability', stacks: 1, duration: 3 }]
  })
]);
