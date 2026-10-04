import type { BuffStatePolicy } from '#gw2/platform/combat/effect-state.js';

/** Only the selected herald installs its effect stacking policies. */
export function heraldBuffPolicies(): BuffStatePolicy[] {
  return [{ kind: 'burst-of-strength', maximumStacks: 1 }];
}
