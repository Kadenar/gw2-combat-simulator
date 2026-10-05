import type { BuffStatePolicy } from '#gw2/platform/combat/effect-state.js';

/** Only the selected conduit installs its effect stacking policies. */
export function conduitBuffPolicies(): BuffStatePolicy[] {
  return [
    { kind: 'cosmic-wisdom', maximumStacks: 1 },
    { kind: 'cosmic-wisdom-extension', maximumStacks: 1 }
  ];
}
