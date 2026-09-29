/** Mechanic and skill-variant tuning for Catalyst; traits own their profiles under traits/. */
import type { BalanceProfile } from '#gw2/platform/engine/skills/types.js';
import { ELEMENTALIST_SKILL_IDS as ID } from '#gw2/professions/elementalist/data/ids.js';

/** Stable mechanic and skill-variant patch identities. */
export const CATALYST_BALANCE_PROFILE_IDS = Object.freeze({
  resources: 'elementalist.catalyst.resources',
  shatteringIce: 'elementalist.catalyst.shattering-ice'
});

/** Energy accounting and Shattering Ice packets keep their independent mechanic and skill profiles. */
export const CATALYST_BALANCE_PROFILES: readonly BalanceProfile[] = Object.freeze([
  {
    id: CATALYST_BALANCE_PROFILE_IDS.resources,
    name: 'Catalyst Energy',
    profileKind: 'mechanic',
    maximumStacks: 30,
    resourceCost: 10,
    resourceGain: 1,
    effects: []
  },
  {
    id: CATALYST_BALANCE_PROFILE_IDS.shatteringIce,
    parentId: ID.SHATTERING_ICE,
    name: 'Shattering Ice - Triggered Packet',
    profileKind: 'skill-variant',
    internalCooldown: 1,
    effects: [
      { name: 'Shattering Ice - Triggered Packet', type: 'strike', coefficient: 0.6, hits: 1 },
      { name: 'Chilled', type: 'condition', condition: 'Chilled', stacks: 1, duration: 1 }
    ]
  }
]);
