import type { ResourceKey } from '#gw2/platform/combat/resources/resource-policy.js';
import type { EffectEventBase } from '#gw2/platform/effects/materializer.js';
import type { ResolvedEffectTrigger } from '#gw2/platform/effects/reactions.js';
import type { SkillEffect } from '#gw2/platform/effects/types.js';
import type { RuntimeCast } from '#gw2/platform/execution/cast-contracts.js';
import type { MechanicQueryContext } from '#gw2/platform/profession-definition/mechanic-context.js';
import type { Skill, SkillId } from '#gw2/platform/skills/types.js';

export type ProfileAmount = number | { readonly profile: SkillId; readonly field: string };

// Resource grants may read the accepted skill's live tuning without duplicating it in a balance profile.
export type ResourceGrantAmount = ProfileAmount | { readonly skillField: string };

export type SideEffectAction =
  | { readonly type: 'rechargeReset'; readonly skillIds: readonly SkillId[] }
  | { readonly type: 'ammoRestore'; readonly skillIds: readonly SkillId[]; readonly count: ProfileAmount }
  | {
      readonly type: 'resourceGrant';
      readonly resource: ResourceKey | 'endurance';
      readonly amount: ResourceGrantAmount;
    }
  | {
      readonly type: 'flipArm';
      readonly skillId: SkillId;
      /** Null keeps the flip exposed until its owner consumes it; omission uses the skill's flipDuration. */
      readonly durationSec?: ProfileAmount | null;
      readonly expiryPriority?: number;
    }
  | { readonly type: 'flipConsume'; readonly skillId: SkillId }
  | {
      readonly type: 'emitProfile';
      readonly profileId: SkillId;
      /** Select the trigger's own effects from a shared profile without duplicating its balance data. */
      readonly effects?: (effect: SkillEffect) => boolean;
      /** Preserve the existing proc label when a skill moves onto profile emission. */
      readonly attribution?: Partial<EffectEventBase> & { readonly name?: string };
    }
  | { readonly type: `${string}.${string}`; readonly amount?: ProfileAmount };

/** Actions receive their actual trigger; impact work never fabricates a cast reservation. */
export type ActionContext<TSkill extends Skill = Skill> =
  | { readonly kind: 'cast'; readonly skill: TSkill; readonly cast: RuntimeCast<TSkill> }
  | { readonly kind: 'effect'; readonly skill: TSkill; readonly trigger: ResolvedEffectTrigger };

export interface SkillSideEffect {
  readonly on: 'castStart' | 'castCommit';
  readonly order?: number;
  readonly when?: (runtime: MechanicQueryContext, cast: RuntimeCast) => boolean;
  readonly do: SideEffectAction;
}
