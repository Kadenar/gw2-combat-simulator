import type { BuffStatePolicy } from '#gw2/platform/combat/effect-state.js';
import {
  WEAVER_SPEAR_FOLLOWUPS,
  WEAVER_SPEAR_SKILL_MECHANICS
} from '#gw2/professions/elementalist/specializations/weaver/skills/weapons/spear.js';

/** Register Weaver's effect rules only when its module is selected. */
export function weaverBuffPolicies(): BuffStatePolicy[] {
  const policies: BuffStatePolicy[] = [
    { kind: 'perfect weave', maximumStacks: 1 },
    { kind: 'weave self air', maximumStacks: 1 },
    { kind: 'weave self fire', maximumStacks: 1 },
    { kind: 'weave self water', maximumStacks: 1 },
    { kind: 'weave self earth', maximumStacks: 1 },
    { kind: 'elements of rage', maximumStacks: 1 },
    // Each spear dual holds one charge; reapplication refreshes it without adding another strike.
    ...Object.entries(WEAVER_SPEAR_FOLLOWUPS).map(([id, kind]) => ({
      kind,
      name: WEAVER_SPEAR_SKILL_MECHANICS[Number(id)].name,
      maximumStacks: 1
    }))
  ];
  return policies;
}
