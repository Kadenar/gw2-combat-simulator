import type { BuffStatePolicy } from '#gw2/platform/combat/effect-state.js';

/** Only the selected vindicator installs its effect stacking policies. */
export function vindicatorBuffPolicies(): BuffStatePolicy[] {
  return [
    { kind: 'reavers-curse', maximumStacks: 1 },
    { kind: 'forerunner-of-death', maximumStacks: 1 },
    // Repeated Luxon activations refresh the bonus without increasing its strength.
    { kind: 'friend-of-the-luxons', maximumStacks: 1 }
  ];
}
