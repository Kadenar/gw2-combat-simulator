export const FIREBRAND_MECHANICS = Object.freeze({
  ashesBurn: Object.freeze({
    condition: "Burning",
    stacks: 1,
    duration: 2,
    // Minimum seconds between consecutive Ashes procs on a single target;
    // this is an internal cooldown enforced via ashesNextTriggerAt, not a GW2
    // API field.
    interval: 1,
  }),
});
