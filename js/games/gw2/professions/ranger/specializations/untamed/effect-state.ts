import type { BuffStatePolicy } from '#gw2/platform/combat/effect-state.js';
import type { WorkOwner } from '#gw2/platform/simulation/work-contract.js';

// Buff timeline kinds shared by Biorhythm's grants, Vow's modifier, and result rows.
export const BIORHYTHM = 'biorhythm';

export const VOW_OF_THE_UNTAMED = 'vow-of-the-untamed';

/** One fixed owner suffices: every unleash cancels the previous cycle before granting the next. */
export const BIORHYTHM_OWNER: WorkOwner = { id: 'ranger.biorhythm', generation: 0 };

/** Register Untamed's effect rules only when its module is selected. */
export function untamedBuffPolicies(): BuffStatePolicy[] {
  const policies: BuffStatePolicy[] = [
    { kind: BIORHYTHM, name: 'Biorhythm', maximumStacks: 5 },
    { kind: VOW_OF_THE_UNTAMED, name: 'Vow of the Untamed', maximumStacks: 1 }
  ];
  return policies;
}
