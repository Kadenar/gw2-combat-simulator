/** Keep Necromancer flip expiries and canonical mutable stats tied to their owned fields. */
import type { NecromancerCanonicalBuild } from '#gw2/professions/necromancer/types.js';
import type { NecromancerCoreState } from '#gw2/professions/necromancer/core/state.js';
import type { Gw2MutableStats } from '#gw2/platform/combat/stats.js';

type Assert<T extends true> = T;
type Attributes = Gw2MutableStats;

export type NecromancerRecordAssertions = [
  Assert<string extends keyof Attributes ? false : true>,
  Assert<NecromancerCanonicalBuild['assumptions']['alacrity'] extends boolean | undefined ? true : false>
];

declare const attributes: Attributes;
declare const state: NecromancerCoreState;
// @ts-expect-error Attribute copies reject misspelled conversion fields.
attributes.conditonDamage;
// @ts-expect-error Flip availability requires a complete window with identity and readiness.
state.availableFlips['exit'] = { expiresAt: 10 };
