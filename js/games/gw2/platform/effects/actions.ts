import type { ResourceKey } from '#gw2/platform/combat/resources/resource-policy.js';
import type { EffectEventBase } from '#gw2/platform/effects/materializer.js';
import type { ResolvedEffectTrigger } from '#gw2/platform/effects/reactions.js';
import type { SkillEffect } from '#gw2/platform/effects/types.js';
import type { RuntimeCast } from '#gw2/platform/execution/cast-contracts.js';
import type { MechanicQueryContext } from '#gw2/platform/profession-definition/mechanic-context.js';
import type { Skill, SkillId } from '#gw2/platform/skills/types.js';

export type ProfileAmount = number | { readonly profile: SkillId; readonly field: string };

// Resource grants and recharge rules read the selected skill's tuning without duplicating it in a balance profile.
export type ResourceGrantAmount = ProfileAmount | { readonly skillField: string };

/** The owner resolves authored tuning using read-only facts; the platform only grants the returned pool units. */
export interface ResourceGrantRecipe {
  readonly parameters: Readonly<Record<string, unknown>>;
  readonly resolve: (
    runtime: MechanicQueryContext,
    context: ActionContext,
    parameters: Readonly<Record<string, unknown>>
  ) => number;
  readonly validate: (parameters: Readonly<Record<string, unknown>>, on?: string) => void;
}

/** Profession handlers own execution; their inline payloads use the ordinary effect schema and patch identities. */
export interface CustomSideEffectAction {
  readonly type: `${string}.${string}`;
  /** Stable authoring identity, required for inline effects and independent of the dispatch handler. */
  readonly id?: string;
  readonly amount?: ProfileAmount;
  /** Handler-owned component data: immediate rewards, deferred packets, or selection templates. Never auto-emitted. */
  readonly effects?: readonly SkillEffect[];
  readonly removedEffectKeys?: readonly string[];
}

export type SideEffectAction =
  | { readonly type: 'rechargeReset'; readonly skillIds: readonly SkillId[] }
  | { readonly type: 'ammoRestore'; readonly skillIds: readonly SkillId[]; readonly count: ProfileAmount }
  | {
      readonly type: 'resourceGrant';
      readonly resource: ResourceKey | 'endurance';
      readonly id?: string;
      readonly label?: string;
      readonly amount: ResourceGrantAmount | ResourceGrantRecipe;
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
  | CustomSideEffectAction;

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

/** Recognize custom dispatch declarations consistently, including malformed payloads that validation must reject. */
export function isCustomSideEffectAction(value: unknown): value is CustomSideEffectAction {
  return (
    !!value &&
    typeof value === 'object' &&
    'type' in value &&
    typeof value.type === 'string' &&
    /^[\w-]+(?:\.[\w-]+)+$/.test(value.type)
  );
}

/** A custom action that owns an inline effect payload. */
export type PayloadSideEffectAction = CustomSideEffectAction & { readonly effects: readonly SkillEffect[] };

/** Only inline effect arrays are payloads; emitProfile's effects predicate is a different existing action field. */
export function hasActionEffects(value: unknown): value is PayloadSideEffectAction {
  return isCustomSideEffectAction(value) && Array.isArray(value.effects);
}

/**
 * Every inline action payload on a skill, in declaration order. Presentation reads these alongside ordinary effects;
 * the cast itself never emits them, because each action's handler decides when its payload applies.
 */
export function skillActionEffects(skill: Skill): readonly SkillEffect[] {
  return (skill.sideEffects ?? []).flatMap(({ do: action }) => (hasActionEffects(action) ? action.effects : []));
}

/**
 * Resolve one payload action by its stable id on the selected (possibly patched) skill. Handlers and deferred tasks
 * read their rewards through this, so a missing declaration fails loudly instead of granting nothing.
 */
export function requireSkillAction(skill: Skill, id: string): PayloadSideEffectAction {
  for (const { do: action } of skill.sideEffects ?? []) if (hasActionEffects(action) && action.id === id) return action;

  throw new TypeError(`Skill ${skill.id} (${skill.name}) has no payload action ${id}.`);
}
