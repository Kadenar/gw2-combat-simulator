import { ACTOR } from '#gw2/platform/constants.js';
import { type SideEffectAction } from '#gw2/platform/effects/actions.js';
import type { Gw2ResolverEvent } from '#gw2/platform/events/resolver-event.js';
import type { MechanicQueryContext } from '#gw2/platform/profession-definition/mechanic-context.js';
import type { NativeResolvedDamageDetails } from '#gw2/platform/profession-definition/module-types.js';
import type { Skill } from '#gw2/platform/skills/types.js';

export type EffectReactionStage =
  'damage.resolved' | 'condition.applied' | 'control.resolved' | 'combo.resolved' | 'buff.applied';

export type ResolvedEffectTrigger<Stage extends EffectReactionStage = EffectReactionStage> = {
  [On in Stage]: {
    readonly on: On;
    readonly event: Gw2ResolverEvent;
    readonly skill: Skill;
  } & (On extends 'damage.resolved' ? { readonly details: NativeResolvedDamageDetails } : object);
}[Stage];

export type EffectReaction = {
  [On in EffectReactionStage]: {
    readonly on: On;
    readonly actor: typeof ACTOR.PLAYER | typeof ACTOR.SUMMON | typeof ACTOR.EFFECT;
    readonly packets: 'each' | 'first';
    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- Reaction declarations and handler registries erase profession state at the shared dispatch boundary.
    readonly when?: (runtime: MechanicQueryContext<any>, trigger: ResolvedEffectTrigger<On>) => boolean;
    readonly do: SideEffectAction | readonly SideEffectAction[];
  };
}[EffectReactionStage];

/** Only serializable provenance travels with a packet; callback declarations stay in its simulation. */
export interface EffectReactionRef {
  readonly group: number;
  readonly packet: number;
}
