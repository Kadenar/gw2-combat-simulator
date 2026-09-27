import type { Skill, SkillEffect, CanonicalCatalog } from '#gw2/platform/engine/skills/types.js';
import type { Gw2ResolverEvent } from '#gw2/platform/resolver/types.js';
import type { NativeResolvedDamageDetails } from '#gw2/platform/profession-definition/module-types.js';
import type { Gw2Runtime, RuntimeProfession } from '#gw2/platform/simulation/runtime-state.js';
import { applySideEffect, type SideEffectAction } from '#gw2/platform/simulation/side-effects.js';
import { validateEffectReactions } from '#gw2/platform/engine/skills/side-effect-validation.js';

export type EffectReactionStage = 'damage.resolved' | 'condition.applied' | 'control.resolved';
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
    readonly actor: 'player' | 'summon' | 'effect';
    readonly packets: 'each' | 'first';
    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- Reaction declarations and handler registries erase profession state at the shared dispatch boundary.
    readonly when?: (runtime: Gw2Runtime<any>, trigger: ResolvedEffectTrigger<On>) => boolean;
    readonly do: SideEffectAction | readonly SideEffectAction[];
  };
}[EffectReactionStage];

/** Only serializable provenance travels with a packet; callback declarations stay in its simulation. */
export interface EffectReactionRef {
  readonly group: number;
  readonly packet: number;
}

/** Shared groups are interned by skill and declaration identity, independent of ordinary packet count. */
export function createEffectReactions(
  catalog: CanonicalCatalog,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- Reaction declarations and handler registries erase profession state at the shared dispatch boundary.
  handlers: RuntimeProfession<any>['sideEffectHandlers']
) {
  const groups: { skill: Skill; rules: readonly EffectReaction[] }[] = [];
  const identities = new WeakMap<Skill, WeakMap<readonly EffectReaction[], number>>();
  return {
    register(skill: Skill, effect: SkillEffect): number | undefined {
      if (effect.reactions === undefined) return undefined;
      validateEffectReactions(catalog, skill, effect);
      if (!effect.reactions.length) return undefined;
      let byRules = identities.get(skill);
      const existing = byRules?.get(effect.reactions);
      if (existing !== undefined) return existing;
      for (const rule of effect.reactions)
        for (const action of Array.isArray(rule.do) ? rule.do : [rule.do])
          if (action.type.includes('.') && typeof handlers?.[action.type] !== 'function')
            throw new TypeError(`Skill ${skill.id} has no side-effect handler registered for ${action.type}.`);
      if (!byRules) identities.set(skill, (byRules = new WeakMap()));
      const group = groups.push({ skill, rules: effect.reactions }) - 1;
      byRules.set(effect.reactions, group);
      return group;
    },
    dispatch(
      runtime: Gw2Runtime,
      on: EffectReactionStage,
      event: Gw2ResolverEvent,
      details: NativeResolvedDamageDetails
    ) {
      const ref = event.effectReaction;
      if (!ref) return;
      const group = groups[ref.group];
      if (!group || !Number.isSafeInteger(ref.packet) || ref.packet < 1)
        throw new TypeError('Invalid resolved-effect reaction reference.');
      const { skill, rules } = group;
      for (const rule of rules) {
        if (rule.on !== on || rule.actor !== event.actorType || (rule.packets === 'first' && ref.packet !== 1))
          continue;
        const eligible =
          rule.on === 'damage.resolved'
            ? !rule.when || rule.when(runtime, { on: rule.on, skill, event, details })
            : rule.on === 'condition.applied'
              ? !rule.when || rule.when(runtime, { on: rule.on, skill, event })
              : !rule.when || rule.when(runtime, { on: rule.on, skill, event });
        if (!eligible) continue;
        const trigger: ResolvedEffectTrigger =
          on === 'damage.resolved' ? { on, skill, event, details } : { on, skill, event };
        for (const action of Array.isArray(rule.do) ? rule.do : [rule.do])
          applySideEffect(runtime, { kind: 'effect', skill, trigger }, action, handlers);
      }
    }
  };
}
