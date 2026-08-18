import { FIREBRAND_BALANCE_PROFILES, FIREBRAND_BALANCE_PROFILE_IDS as PROFILE } from './profiles.js';

const ashes = FIREBRAND_BALANCE_PROFILES.find((profile) => profile.id === PROFILE.ashes)!;
const burn = (ashes.effects || []).find((effect) => effect.type === 'condition')!;

export const FIREBRAND_MECHANICS = Object.freeze({
  ashesBurn: Object.freeze({
    condition: String(burn.condition),
    stacks: Number(burn.stacks),
    duration: Number(burn.duration),
    // Minimum seconds between consecutive Ashes procs on a single target;
    // this is an internal cooldown enforced via ashesNextTriggerAt, not a GW2
    // API field.
    interval: Number(ashes.internalCooldown)
  })
});
