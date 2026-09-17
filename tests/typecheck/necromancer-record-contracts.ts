/** Keep Necromancer flip expiries, attribute copies, and scheduled payloads tied to their owned fields. */
import type { NecromancerCanonicalBuild } from '#gw2/professions/necromancer/types.js';
import type { NecromancerCoreState } from '#gw2/professions/necromancer/core/state.js';
import type { cloneNecromancerAttributes } from '#gw2/professions/necromancer/core/traits/modifiers.js';
import type { necromancerGreatswordTaskHandlers } from '#gw2/professions/necromancer/core/execution/greatsword.js';
import type { necromancerSpearTaskHandlers } from '#gw2/professions/necromancer/core/execution/spear.js';
import type { necromancerSwordTaskHandlers } from '#gw2/professions/necromancer/core/mechanics/sword-chain.js';

type Assert<T extends true> = T;
type Attributes = ReturnType<typeof cloneNecromancerAttributes>;
type GreatswordPayload = NonNullable<
  Parameters<(typeof necromancerGreatswordTaskHandlers)['necromancer.nightfall-life-force']>[1]['payload']
>;
type SpearPayload = NonNullable<
  Parameters<(typeof necromancerSpearTaskHandlers)['necromancer.perforate-soul-shard']>[1]['payload']
>;
type SwordPayload = NonNullable<
  Parameters<(typeof necromancerSwordTaskHandlers)['necromancer.sword-autoattack-chain-expire']>[1]['payload']
>;

export type NecromancerRecordAssertions = [
  Assert<string extends keyof Attributes ? false : true>,
  Assert<string extends keyof GreatswordPayload ? false : true>,
  Assert<string extends keyof SpearPayload ? false : true>,
  Assert<string extends keyof SwordPayload ? false : true>,
  Assert<NecromancerCanonicalBuild['assumptions']['alacrity'] extends boolean | undefined ? true : false>
];

declare const attributes: Attributes;
declare const state: NecromancerCoreState;
declare const payload: SpearPayload;
// @ts-expect-error Attribute copies reject misspelled conversion fields.
attributes.conditonDamage;
// @ts-expect-error Flip availability stores expiry timestamps, not arbitrary objects.
state.availableFlips['exit'] = { expiresAt: 10 };
// @ts-expect-error Scheduled shard payloads reject misspelled hit fields.
payload.hitIndx;
